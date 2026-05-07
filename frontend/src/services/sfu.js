import { Device } from "mediasoup-client";
import { getSocket } from "./socket";

const request = (event, payload = {}) => new Promise((resolve, reject) => {
  const socket = getSocket();
  if (!socket) {
    reject(new Error("Socket is not connected"));
    return;
  }

  socket.timeout(10000).emit(event, payload, (err, response) => {
    if (err) {
      reject(err);
      return;
    }
    if (response?.error) {
      reject(new Error(response.error));
      return;
    }
    resolve(response);
  });
});

export class SfuSession {
  constructor({ roomId, onTrack, onProducerClosed, maxCameraConsumers = 12 }) {
    this.roomId = roomId;
    this.onTrack = onTrack;
    this.onProducerClosed = onProducerClosed;
    this.maxCameraConsumers = maxCameraConsumers;
    this.device = null;
    this.sendTransport = null;
    this.recvTransport = null;
    this.producers = new Map();
    this.consumers = new Map();
    this.consumedProducers = new Set();
    this.handleNewProducer = this.handleNewProducer.bind(this);
    this.handleProducerClosed = this.handleProducerClosed.bind(this);
    this.handlePeerClosed = this.handlePeerClosed.bind(this);
  }

  async init() {
    const { rtpCapabilities } = await request("sfu:get-router-rtp-capabilities", {});
    this.device = new Device();
    await this.device.load({ routerRtpCapabilities: rtpCapabilities });
    this.sendTransport = await this.createTransport("send");
    this.recvTransport = await this.createTransport("recv");

    const socket = getSocket();
    socket.on("sfu:new-producer", this.handleNewProducer);
    socket.on("sfu:producer-closed", this.handleProducerClosed);
    socket.on("sfu:peer-closed", this.handlePeerClosed);
  }

  async createTransport(direction) {
    const params = await request("sfu:create-transport", { roomId: this.roomId, direction });
    const transport = direction === "send"
      ? this.device.createSendTransport(params)
      : this.device.createRecvTransport(params);

    transport.on("connect", ({ dtlsParameters }, callback, errback) => {
      request("sfu:connect-transport", {
        roomId: this.roomId,
        transportId: transport.id,
        dtlsParameters,
      }).then(callback).catch(errback);
    });

    if (direction === "send") {
      transport.on("produce", ({ kind, rtpParameters, appData }, callback, errback) => {
        request("sfu:produce", {
          roomId: this.roomId,
          transportId: transport.id,
          kind,
          rtpParameters,
          source: appData?.source || kind,
        }).then(({ id }) => callback({ id })).catch(errback);
      });
    }

    return transport;
  }

  async publishTrack(track, source) {
    if (!track || !this.sendTransport) return null;
    const producer = await this.sendTransport.produce({
      track,
      appData: { source },
      stopTracks: false,
    });
    this.producers.set(source, producer);
    producer.on("trackended", () => this.closeProducer(source));
    return producer;
  }

  async replaceProducerTrack(source, track) {
    const producer = this.producers.get(source);
    if (!producer) return this.publishTrack(track, source);
    await producer.replaceTrack({ track });
    return producer;
  }

  closeProducer(source) {
    const producer = this.producers.get(source);
    if (!producer) return;
    this.producers.delete(source);
    request("sfu:close-producer", {
      roomId: this.roomId,
      producerId: producer.id,
    }).catch(() => {});
    producer.close();
  }

  async consumeExistingProducers() {
    const { producers = [] } = await request("sfu:list-producers", { roomId: this.roomId });
    await Promise.all(producers.map((producer) => this.consumeProducer(producer)));
  }

  async handleNewProducer(producer) {
    await this.consumeProducer(producer);
  }

  handleProducerClosed({ producerId, socketId, source }) {
    const consumer = this.consumers.get(producerId);
    if (consumer) {
      consumer.close();
      this.consumers.delete(producerId);
      this.consumedProducers.delete(producerId);
    }
    this.onProducerClosed?.({ producerId, socketId, source });
  }

  handlePeerClosed({ socketId }) {
    for (const [producerId, consumer] of this.consumers.entries()) {
      if (consumer.appData?.socketId === socketId) {
        consumer.close();
        this.consumers.delete(producerId);
        this.consumedProducers.delete(producerId);
      }
    }
    this.onProducerClosed?.({ socketId });
  }

  async consumeProducer({ producerId, source, kind }) {
    if (!producerId || this.consumedProducers.has(producerId)) return;
    const currentCameraConsumers = Array.from(this.consumers.values())
      .filter((consumer) => consumer.appData?.source === "video").length;
    if (kind === "video" && source === "video" && currentCameraConsumers >= this.maxCameraConsumers) {
      return;
    }
    this.consumedProducers.add(producerId);

    const params = await request("sfu:consume", {
      roomId: this.roomId,
      transportId: this.recvTransport.id,
      producerId,
      rtpCapabilities: this.device.rtpCapabilities,
    });

    const consumer = await this.recvTransport.consume({
      id: params.id,
      producerId: params.producerId,
      kind: params.kind,
      rtpParameters: params.rtpParameters,
      appData: {
        socketId: params.socketId,
        source: params.source,
        name: params.name,
      },
    });

    this.consumers.set(producerId, consumer);
    this.onTrack?.({
      producerId,
      consumerId: consumer.id,
      socketId: params.socketId,
      source: params.source,
      name: params.name,
      kind: params.kind,
      track: consumer.track,
    });

    await request("sfu:resume-consumer", {
      roomId: this.roomId,
      consumerId: consumer.id,
    });
  }

  close() {
    const socket = getSocket();
    socket?.off("sfu:new-producer", this.handleNewProducer);
    socket?.off("sfu:producer-closed", this.handleProducerClosed);
    socket?.off("sfu:peer-closed", this.handlePeerClosed);
    this.producers.forEach((producer) => producer.close());
    this.consumers.forEach((consumer) => consumer.close());
    this.sendTransport?.close();
    this.recvTransport?.close();
    this.producers.clear();
    this.consumers.clear();
    this.consumedProducers.clear();
  }
}
