// src/media/media.gateway.js
import {
  createWebRtcTransport,
  createProducer,
  createConsumer,
  getTransport,
  getConsumerTransport,
  getProducer,
  initRoomMedia,
  roomMediaMap,
} from "./sfu.service.js";

export function setupMedia(io) {
  io.on("connection", (socket) => {
    socket.on("create-transport", async ({ roomId }, callback) => {
      const router = io.mediasoupRouter;
      const { transport, params } = await createWebRtcTransport(router);
      if (!roomMediaMap[roomId]) initRoomMedia(roomId);
      roomMediaMap[roomId].transports[transport.id] = transport;
      roomMediaMap[roomId].transports[socket.id] = transport;
      callback(params);
    });

    socket.on(
      "produce",
      async ({ roomId, transportId, kind, rtpParameters }, callback) => {
        const transport = getTransport(roomId, transportId);
        const producer = await createProducer(
          io,
          socket,
          roomId,
          transport,
          kind,
          rtpParameters
        );
        callback({ id: producer.id });
      }
    );

    socket.on(
      "consume",
      async ({ producerId, rtpCapabilities, roomId }, callback) => {
        const transport = getConsumerTransport(roomId, socket.id);
        const producer = getProducer(roomId, producerId);
        const { consumer, params } = await createConsumer(
          io.mediasoupRouter,
          transport,
          producer,
          rtpCapabilities
        );
        callback(params);
      }
    );
  });
}
