import "dotenv/config";
import express from "express";
import cors from "cors";
import { initDatabase } from "./db/index.js";
import { authRouter } from "./routes/authRoutes.js";
import { agoraRouter } from "./routes/agoraRoutes.js";
import { voiceRouter } from "./routes/voiceRoutes.js";
import { dashboardRouter } from "./routes/dashboardRoutes.js";
import { eventsRouter } from "./routes/eventsRoutes.js";
import { toolsRouter } from "./routes/toolsRoutes.js";

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

// Routes
app.use("/api/auth", authRouter);
app.use("/api/agora", agoraRouter);
app.use("/api/voice", voiceRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/events", eventsRouter);
app.use("/api/tools", toolsRouter);

// Health Check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Apex Workplace Voice AI Assistant Backend",
    hackathon: "Build With Agora (Bengaluru 2026)",
    technologies: {
      llm: "Google Gemini",
      voiceEngine: "Agora Conversational AI + Agora RTC",
      tts: "Murf AI Falcon TTS",
      database: "PostgreSQL on Neon + Drizzle ORM",
      knowledgeRAG: "LangChain RAG (Google Gemini)",
      integrations: ["GitHub REST API", "Resend / Nodemailer", "SSE Realtime Events"],
    },
    timestamp: new Date().toISOString(),
  });
});

async function startServer() {
  await initDatabase();

  app.listen(PORT, () => {
    console.log(`
======================================================================
🚀 APEX EMPLOYEE PRODUCTIVITY VOICE AI SERVER
======================================================================
📡 Port:           http://localhost:${PORT}
🎙️ Voice AI:       Agora Conversational AI + Murf AI Falcon TTS
🗄️ Database:       Neon PostgreSQL + Drizzle ORM
🛡️ RBAC Tools:     Admin, HR, EM, SWE Roles Loaded
⚡ Realtime SSE:   http://localhost:${PORT}/api/events
======================================================================
    `);
  });
}

startServer();
