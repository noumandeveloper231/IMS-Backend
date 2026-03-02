import { createServer } from "http";
import { Server } from "socket.io";
import connectDB from "./config/db.js";
import app from "./app.js";
import { attachScannerSocket } from "./socket/scannerSocket.js";

const PORT = process.env.PORT || 8000;
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:5174").split(",");

// Local: start server with DB connection + Socket.io. Vercel: use api/index.js (serverless, no Socket.io).
if (process.env.NODE_ENV !== "production") {
  (async () => {
    await connectDB(process.env.MONGO_URI);
    const server = createServer(app);
    const io = new Server(server, {
      cors: { origin: CORS_ORIGINS },
      path: "/socket.io/",
    });
    attachScannerSocket(io);
    server.listen(PORT, "0.0.0.0", () => console.log(`✅ Server running on port ${PORT} (Socket.io enabled)`));
  })();
}

export default app;
