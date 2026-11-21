import { Router, Request, Response } from "express";
import { sseService } from "../services/events/sseService.js";

export const eventsRouter = Router();

// GET /api/events (Server-Sent Events)
eventsRouter.get("/", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disables buffering in Cloudflare Tunnel, Nginx, and proxies
  res.flushHeaders?.();

  const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const userId = req.query.userId as string | undefined;
  const companyId = req.query.companyId as string | undefined;

  sseService.addClient(clientId, res, userId, companyId);

  // Send keep-alive ping every 25 seconds
  const keepAlive = setInterval(() => {
    res.write(": keepalive\n\n");
  }, 25000);

  req.on("close", () => {
    clearInterval(keepAlive);
    sseService.removeClient(clientId);
  });
});
