/**
 * Scanner pairing & scan events over Socket.io.
 * Room = sessionId. Desktop and mobile join same room; mobile emits "scan", server broadcasts to room.
 */
const SESSION_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const sessionTimers = new Map();

function clearSessionTimer(sessionId) {
  const t = sessionTimers.get(sessionId);
  if (t) {
    clearTimeout(t);
    sessionTimers.delete(sessionId);
  }
}

function scheduleSessionExpiry(io, sessionId) {
  clearSessionTimer(sessionId);
  const timer = setTimeout(() => {
    sessionTimers.delete(sessionId);
    io.to(sessionId).emit("session_expired", { message: "Pairing session expired" });
    io.in(sessionId).fetchSockets().then((sockets) => {
      sockets.forEach((s) => s.leave(sessionId));
    });
  }, SESSION_EXPIRY_MS);
  sessionTimers.set(sessionId, timer);
}

export function attachScannerSocket(io) {
  io.on("connection", (socket) => {
    socket.on("join_scanner_room", (sessionId) => {
      if (!sessionId || typeof sessionId !== "string") return;
      const room = sessionId.trim();
      socket.join(room);
      socket.scannerSessionId = room;
      scheduleSessionExpiry(io, room);
    });

    socket.on("scan", (data) => {
      const sessionId = socket.scannerSessionId;
      if (!sessionId) return;
      const sku = data?.sku != null ? String(data.sku).trim() : null;
      if (!sku) return;
      io.to(sessionId).emit("scan", { sku, at: new Date().toISOString() });
    });

    socket.on("disconnect", () => {
      if (socket.scannerSessionId) {
        // Optionally clear timer if room is empty (we keep 5min expiry regardless)
      }
    });
  });
}
