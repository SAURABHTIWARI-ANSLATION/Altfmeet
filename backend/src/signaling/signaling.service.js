// signaling.service.js
export function initSignaling(io) {
  import("./signaling.gateway.js").then(({ default: gateway }) => {
    gateway(io).catch(err => console.error("Signaling gateway error:", err));
  }).catch(err => console.error("Failed to import signaling.gateway:", err));
}
