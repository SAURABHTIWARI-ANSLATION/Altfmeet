import {
  closePeerMedia,
  createWebRtcTransport,
  getOrCreatePeer,
  getOrCreateRoomMedia,
  getProducer,
  getProducerRecord,
  listProducersForRoom,
} from "./sfu.service.js";

function ack(callback, payload) {
  if (typeof callback === "function") callback(payload);
}

function fail(callback, err) {
  const message = err instanceof Error ? err.message : String(err);
  ack(callback, { error: message });
}

export function setupMedia(io) {
  io.on("connection", (socket) => {
    socket.on("sfu:get-router-rtp-capabilities", (_payload, callback) => {
      ack(callback, { rtpCapabilities: io.mediasoupRouter?.rtpCapabilities });
    });

    socket.on("sfu:create-transport", async ({ roomId, direction } = {}, callback) => {
      try {
        if (!roomId) throw new Error("Missing roomId");
        const { transport, params } = await createWebRtcTransport(io.mediasoupRouter);
        const peer = getOrCreatePeer(roomId, socket);
        peer.transports.set(transport.id, transport);

        transport.appData = {
          roomId,
          socketId: socket.id,
          direction: direction || "unknown",
        };
        transport.on("dtlsstatechange", (state) => {
          if (state === "closed") transport.close();
        });

        ack(callback, params);
      } catch (err) {
        fail(callback, err);
      }
    });

    socket.on("sfu:connect-transport", async ({ roomId, transportId, dtlsParameters } = {}, callback) => {
      try {
        const peer = getOrCreatePeer(roomId, socket);
        const transport = peer.transports.get(transportId);
        if (!transport) throw new Error("Transport not found");
        await transport.connect({ dtlsParameters });
        ack(callback, { connected: true });
      } catch (err) {
        fail(callback, err);
      }
    });

    socket.on("sfu:produce", async ({ roomId, transportId, kind, rtpParameters, source } = {}, callback) => {
      try {
        const room = getOrCreateRoomMedia(roomId);
        const peer = getOrCreatePeer(roomId, socket);
        const transport = peer.transports.get(transportId);
        if (!transport) throw new Error("Transport not found");

        const producer = await transport.produce({
          kind,
          rtpParameters,
          appData: {
            source: source || kind,
            socketId: socket.id,
            roomId,
            name: socket.data.name || socket.id,
          },
        });

        peer.producers.set(producer.id, producer);
        room.producers.set(producer.id, {
          producer,
          socketId: socket.id,
          kind,
          source: source || kind,
          name: socket.data.name || socket.id,
        });

        producer.on("transportclose", () => {
          peer.producers.delete(producer.id);
          room.producers.delete(producer.id);
        });
        producer.on("close", () => {
          peer.producers.delete(producer.id);
          room.producers.delete(producer.id);
          socket.to(roomId).emit("sfu:producer-closed", {
            producerId: producer.id,
            socketId: socket.id,
            source: source || kind,
          });
        });

        socket.to(roomId).emit("sfu:new-producer", {
          producerId: producer.id,
          socketId: socket.id,
          kind,
          source: source || kind,
          name: socket.data.name || socket.id,
        });

        ack(callback, { id: producer.id });
      } catch (err) {
        fail(callback, err);
      }
    });

    socket.on("sfu:list-producers", ({ roomId } = {}, callback) => {
      try {
        ack(callback, { producers: listProducersForRoom(roomId, socket.id) });
      } catch (err) {
        fail(callback, err);
      }
    });

    socket.on("sfu:consume", async ({ roomId, transportId, producerId, rtpCapabilities } = {}, callback) => {
      try {
        const peer = getOrCreatePeer(roomId, socket);
        const transport = peer.transports.get(transportId);
        const producer = getProducer(roomId, producerId);
        const record = getProducerRecord(roomId, producerId);
        if (!transport) throw new Error("Transport not found");
        if (!producer || !record) throw new Error("Producer not found");
        if (!io.mediasoupRouter.canConsume({ producerId, rtpCapabilities })) {
          throw new Error("Cannot consume producer");
        }

        const consumer = await transport.consume({
          producerId,
          rtpCapabilities,
          paused: true,
        });

        peer.consumers.set(consumer.id, consumer);
        consumer.on("transportclose", () => peer.consumers.delete(consumer.id));
        consumer.on("producerclose", () => {
          peer.consumers.delete(consumer.id);
          socket.emit("sfu:producer-closed", {
            producerId,
            socketId: record.socketId,
            source: record.source,
          });
        });

        ack(callback, {
          id: consumer.id,
          producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
          socketId: record.socketId,
          source: record.source,
          name: record.name,
        });
      } catch (err) {
        fail(callback, err);
      }
    });

    socket.on("sfu:resume-consumer", async ({ roomId, consumerId } = {}, callback) => {
      try {
        const peer = getOrCreatePeer(roomId, socket);
        const consumer = peer.consumers.get(consumerId);
        if (!consumer) throw new Error("Consumer not found");
        await consumer.resume();
        ack(callback, { resumed: true });
      } catch (err) {
        fail(callback, err);
      }
    });

    socket.on("sfu:close-producer", ({ roomId, producerId } = {}, callback) => {
      try {
        const room = getOrCreateRoomMedia(roomId);
        const peer = getOrCreatePeer(roomId, socket);
        const producer = peer.producers.get(producerId);
        if (!producer) throw new Error("Producer not found");
        peer.producers.delete(producerId);
        room.producers.delete(producerId);
        producer.close();
        ack(callback, { closed: true });
      } catch (err) {
        fail(callback, err);
      }
    });

    socket.on("disconnect", () => {
      const roomId = closePeerMedia(socket.id);
      if (roomId) {
        socket.to(roomId).emit("sfu:peer-closed", { socketId: socket.id });
      }
    });
  });
}
