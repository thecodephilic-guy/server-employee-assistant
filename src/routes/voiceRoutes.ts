import { Router, Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "./authRoutes.js";
import { voiceOrchestrator } from "../services/voice/voiceOrchestrator.js";

export const voiceRouter = Router();

// POST /api/voice/interact
voiceRouter.post("/interact", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { transcript, confirmed, pendingAction } = req.body;

    if (!transcript && !confirmed && !pendingAction) {
      return res.status(400).json({ error: "Transcript or confirmation is required" });
    }

    const result = await voiceOrchestrator.processVoiceInput({
      transcript: transcript || (confirmed ? "yes" : ""),
      userId: user.id,
      userRole: user.role,
      userName: user.name,
      userEmail: user.email,
      companyId: user.companyId,
      confirmed: !!confirmed,
      pendingAction,
    });

    return res.json(result);
  } catch (err: any) {
    console.error("Voice interaction error:", err);
    return res.status(500).json({
      error: err.message,
      spokenText: `I encountered an issue executing your request: ${err.message}`,
    });
  }
});

// POST /api/voice/onboard (Public for hybrid company onboarding before registration)
voiceRouter.post("/onboard", async (req, res) => {
  try {
    const { transcript, confirmed, pendingAction } = req.body;

    const result = await voiceOrchestrator.processVoiceInput({
      transcript: transcript || (confirmed ? "looks good, create the workspace" : ""),
      userId: "usr_onboarding",
      userRole: "admin",
      userName: "Founder",
      userEmail: "founder@newcompany.com",
      companyId: "comp_new",
      confirmed: !!confirmed,
      pendingAction,
    });

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
