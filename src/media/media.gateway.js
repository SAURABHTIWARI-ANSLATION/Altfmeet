// src/media/media.gateway.js
import {
  createWebRtcTransport,
  createProducer,
  createConsumer,
  getTransport,
  getConsumerTransport,
  getProducer,
  initRoomMedia
} from "./sfu.service.js";

export function setupMedia(io) {
  io.on("connection", (socket) => {
    socket.on("create-transport", async ({ roomId }, callback) => {
      const router = io.mediasoupRouter;
      const { transport, params } = await createWebRtcTransport(router);
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

    socket.on("create-transport", async ({ roomId }, callback) => {
      const router = io.mediasoupRouter;
      const { transport, params } = await createWebRtcTransport(router);

      //Store transport explicitly
      if (!roomMediaMap[roomId]) initRoomMedia(roomId);
      roomMediaMap[roomId].transports[socket.id] = transport;

      callback(params);
    });

  });
}
