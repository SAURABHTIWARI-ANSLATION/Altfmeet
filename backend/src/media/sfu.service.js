export const roomMediaMap = {};
export function initRoomMedia(roomId) {
  if (!roomMediaMap[roomId]) {
    roomMediaMap[roomId] = {
      transports: {},  
      audioProducers: {},
      videoProducers: {},
      screenProducers: {},
      consumers: {},
    };
  }
}



export async function createWebRtcTransport(router) {
  const transportOptions = {
    listenIps: [{ ip: "0.0.0.0", announcedIp: process.env.PUBLIC_IP }],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: 1000000,
  };

  const transport = await router.createWebRtcTransport(transportOptions);
  await transport.setMaxIncomingBitrate(1500000);

  return {
    transport,
    params: {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    },
  };
}

export async function createProducer(io, socket, roomId, transport, kind, rtpParameters, type = kind) {
  const producer = await transport.produce({
    kind,
    rtpParameters,
    appData: { type }, // 'audio', 'video', or 'screen'
  });

  producer.on("close", () => {
    io.to(roomId).emit(`${type.toUpperCase()}_STOPPED`, {
      socketId: socket.id,
    });
  });

  return producer;
}

export async function createConsumer(router, transport, producer, rtpCapabilities) {
  if (!router.canConsume({ producerId: producer.id, rtpCapabilities })) {
    throw new Error("Cannot consume this producer");
  }

  const consumer = await transport.consume({
    producerId: producer.id,
    rtpCapabilities,
    paused: false,
  });

  return {
    consumer,
    params: {
      id: consumer.id,
      producerId: producer.id,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      type: producer.appData.type,
    },
  };
}

export function getTransport(roomId, transportId) {
  const room = roomMediaMap[roomId];
  if (!room) throw new Error("Room not initialized");

  const transport = Object.values(room.transports || {}).find(t => t.id === transportId);
  if (!transport) throw new Error("Transport not found");

  return transport;
}

export function getConsumerTransport(roomId, socketId) {
  const room = roomMediaMap[roomId];
  if (!room || !room.consumers || !room.consumers[socketId]) {
    throw new Error("Consumer transport not found");
  }
  return room.consumers[socketId].transport;
}

export function getProducer(roomId, producerId) {
  const room = roomMediaMap[roomId];
  if (!room) throw new Error("Room not found");

  const allProducers = {
    ...room.audioProducers,
    ...room.videoProducers,
    ...room.screenProducers,
  };

  const producer = allProducers[producerId];
  if (!producer) throw new Error("Producer not found");

  return producer;
}

