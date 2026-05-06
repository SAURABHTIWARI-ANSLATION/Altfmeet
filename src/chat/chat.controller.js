import * as ChatService from "./chat.service.js";

// POST /chat/:meetingId
export async function postMessage(req, res, next) {
  try {
    const { meetingId } = req.params;
    const { message } = req.body;
    const userId = req.user.id;
    const time = new Date();
    
    if (!message || typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({ error: "Invalid message" });
    }
    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "Invalid userId" });
    }
    

    const msg = await ChatService.sendMessage({
      meetingId,
      userId,
      message,
      time,
    });
    res.json({ success: true, data: msg });
  } catch (err) {
    console.error("postMessage error:", err);
    next(err);
  }
}

// GET /chat/:meetingId
export async function getChatHistory(req, res, next) {
  try {
    const { meetingId } = req.params;
    const messages = await ChatService.getMessages(meetingId, 50); // last 50 messages
    res.json({ success: true, data: messages });
  } catch (err) {
    console.error("getChatHistory error:", err);
    next(err);
  }
}
