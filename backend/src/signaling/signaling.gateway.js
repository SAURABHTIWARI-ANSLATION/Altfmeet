// src/signaling/signaling.gateway.js
import { SIGNALING_EVENTS } from "./signaling.events.js";
import {
  createProducer,
  createConsumer,
  getProducer,
  getConsumerTransport,
} from "../media/sfu.service.js";

// const roomMediaMap = {};

export function setupSignaling(io) {
  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on(SIGNALING_EVENTS.JOIN_MEETING, ({ meetingId, userId }) => {
      socket.join(meetingId);
      socket.to(meetingId).emit(SIGNALING_EVENTS.USER_JOINED, {
        userId,
        socketId: socket.id,
      });
    });

    socket.on(SIGNALING_EVENTS.OFFER, ({ target, sdp, from }) => {
      io.to(target).emit(SIGNALING_EVENTS.OFFER, { sdp, from });
    });

    socket.on(SIGNALING_EVENTS.ANSWER, ({ target, sdp, from }) => {
      io.to(target).emit(SIGNALING_EVENTS.ANSWER, { sdp, from });
    });

    socket.on(SIGNALING_EVENTS.ICE_CANDIDATE, ({ target, candidate, from }) => {
      io.to(target).emit(SIGNALING_EVENTS.ICE_CANDIDATE, { candidate, from });
    });

    socket.on("disconnect", () => {
      Object.keys(roomMediaMap).forEach((roomId) => {
        const room = roomMediaMap[roomId];
        delete room.transports[socket.id];
        delete room.consumers[socket.id];
      });
    });

    socket.on(
      "produce",
      async ({ roomId, transportId, kind, rtpParameters }, callback) => {
        try {
          const producer = await createProducer(
            io,
            roomId,
            socket.id,
            transportId,
            kind,
            rtpParameters
          );

          // Notify others if it's a screen share
          if (kind === "video" && rtpParameters.appData?.type === "screen") {
            socket.to(roomId).emit("SCREEN_SHARE_STARTED", {
              producerId: producer.id,
              socketId: socket.id,
            });
          }

          callback({ id: producer.id });
        } catch (err) {
          console.error("Produce error:", err);
          callback({ error: err.message });
        }
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
