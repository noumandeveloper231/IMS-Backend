import connectDB from "./config/db.js";
import app from "./app.js";

const PORT = process.env.PORT || 8000;

// Local: start server with DB connection. Vercel: use api/index.js (serverless).
if (process.env.NODE_ENV !== "production") {
  (async () => {
    await connectDB(process.env.MONGO_URI);
    app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
  })();
}

export default app;
