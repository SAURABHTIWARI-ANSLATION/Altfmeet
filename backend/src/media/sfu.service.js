export const roomMediaMap = new Map();

export function initRoomMedia(roomId) {
  return getOrCreateRoomMedia(roomId);
}

export function getOrCreateRoomMedia(roomId) {
  if (!roomMediaMap.has(roomId)) {
    roomMediaMap.set(roomId, {
      peers: new Map(),
      producers: new Map(),
    });
  }
  return roomMediaMap.get(roomId);
}

export function getOrCreatePeer(roomId, socket) {
  const room = getOrCreateRoomMedia(roomId);
  if (!room.peers.has(socket.id)) {
    room.peers.set(socket.id, {
      socketId: socket.id,
      userId: socket.data.userId || socket.id,
      name: socket.data.name || socket.id,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
    });
  }
  return room.peers.get(socket.id);
}

export async function createWebRtcTransport(router) {
  const listenIp = process.env.MEDIASOUP_LISTEN_IP || "0.0.0.0";
  const announcedIp = process.env.PUBLIC_IP || process.env.MEDIASOUP_ANNOUNCED_IP;

  const transport = await router.createWebRtcTransport({
    listenIps: [{ ip: listenIp, announcedIp }],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: Number(process.env.SFU_INITIAL_BITRATE || 1200000),
    enableSctp: false,
  });

  await transport.setMaxIncomingBitrate(Number(process.env.SFU_MAX_INCOMING_BITRATE || 1800000));

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

export function listProducersForRoom(roomId, excludeSocketId) {
  const room = roomMediaMap.get(roomId);
  if (!room) return [];

  return Array.from(room.producers.values())
    .filter(({ socketId }) => socketId !== excludeSocketId)
    .map(({ producer, socketId, kind, source, name }) => ({
      producerId: producer.id,
      socketId,
      kind,
      source,
      name,
    }));
}

export function getProducer(roomId, producerId) {
  const room = roomMediaMap.get(roomId);
  const record = room?.producers.get(producerId);
  return record?.producer || null;
}

export function getProducerRecord(roomId, producerId) {
  return roomMediaMap.get(roomId)?.producers.get(producerId) || null;
}

export function closePeerMedia(socketId) {
  for (const [roomId, room] of roomMediaMap.entries()) {
    const peer = room.peers.get(socketId);
    if (!peer) continue;

    peer.consumers.forEach((consumer) => consumer.close());
    peer.producers.forEach((producer) => {
      room.producers.delete(producer.id);
      producer.close();
    });
    peer.transports.forEach((transport) => transport.close());
    room.peers.delete(socketId);

    if (room.peers.size === 0) {
      roomMediaMap.delete(roomId);
    }

    return roomId;
  }

  return null;
}
