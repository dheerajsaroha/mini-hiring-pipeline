import express from "express";
import cors from "cors";
import { router } from "./api/routes.js";
import { initDb, closeDb } from "./db/database.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use("/api", router);

app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

// Initialize DB on startup
initDb();

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

process.on("SIGINT", () => {
  console.log("Shutting down...");
  closeDb();
  server.close(() => process.exit(0));
});

process.on("SIGTERM", () => {
  console.log("Shutting down...");
  closeDb();
  server.close(() => process.exit(0));
});

export { app };