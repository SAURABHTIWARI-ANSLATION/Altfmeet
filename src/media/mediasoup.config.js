import mediasoup from "mediasoup";

let worker;
let router;

export async function setupMediasoup(io) {
  try {
    worker = await mediasoup.createWorker({
      rtcMinPort: 40000,
      rtcMaxPort: 49999,
    });

    console.log("Mediasoup worker created");

    router = await worker.createRouter({
      mediaCodecs: [
        {
          kind: "audio",
          mimeType: "audio/opus",
          clockRate: 48000,
          channels: 2,
          
          parameters: {
            useinbandfec: 1, 
            minptime: 10, 
            maxplaybackrate: 48000,
          },
        },
        {
          kind: "video",
          mimeType: "video/VP8",
          clockRate: 90000,
          parameters: {},
        },
      ],
    });

    console.log("Mediasoup router created");
    io.mediasoupRouter = router;
  } catch (err) {
    console.error("Mediasoup setup failed:", err);
  }
}
