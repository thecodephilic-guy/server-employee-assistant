import { Router, Response } from "express";
import { agoraService } from "../services/agora/agoraService.js";
import { authMiddleware, AuthenticatedRequest } from "./authRoutes.js";

export const agoraRouter = Router();

// POST /api/agora/token
agoraRouter.post("/token", authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { channelName, uid, isPublisher = true } = req.body;
  if (!channelName || uid === undefined) {
    return res.status(400).json({ error: "channelName and uid are required" });
  }

  const token = agoraService.generateRtcToken(channelName, Number(uid), isPublisher);
  return res.json({
    token,
    appId: process.env.AGORA_APP_ID || "mock_agora_app_id",
    channelName,
    uid,
  });
});

// POST /api/agora/session/start
agoraRouter.post("/session/start", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const channelName = req.body.channelName || `emp-session-${user.id.substring(0, 8)}`;
    const userUid = req.body.userUid || 1001;
    const agentUid = req.body.agentUid || 9999;

    const session = await agoraService.startConversationalAgent({
      channelName,
      userId: user.id,
      userRole: user.role,
      userUid,
      agentUid,
    });

    return res.json({
      success: true,
      session,
    });
  } catch (err: any) {
    console.error("Error starting Agora session:", err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/agora/session/stop
agoraRouter.post("/session/stop", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { channelName, agentUid } = req.body;
    if (!channelName) {
      return res.status(400).json({ error: "channelName is required" });
    }

    const result = await agoraService.stopConversationalAgent(channelName, agentUid);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
