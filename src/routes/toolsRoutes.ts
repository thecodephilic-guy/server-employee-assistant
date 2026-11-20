import { Router, Request, Response } from "express";
import { TOOL_REGISTRY, executeToolWithRBAC, UserRole } from "../services/tools/toolRegistry.js";
import { authMiddleware, AuthenticatedRequest } from "./authRoutes.js";

export const toolsRouter = Router();

// GET /api/tools/manifest
toolsRouter.get("/manifest", (req: Request, res: Response) => {
  const role = (req.query.role as UserRole) || "admin";
  const manifest = Object.values(TOOL_REGISTRY)
    .filter((t) => t.allowedRoles.includes(role))
    .map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
      requiresConfirmation: !!t.requiresConfirmation,
    }));

  return res.json({ role, tools: manifest });
});

// POST /api/tools/execute (Webhook for Agora Conversational AI agent or authenticated user)
toolsRouter.post("/execute", async (req: Request, res: Response) => {
  try {
    const { toolName, args, userId = "usr_admin_01", userRole = "admin", userName = "Sohail Ansari", userEmail = "sohailansari483@gmail.com", companyId = "comp_onecorp_01" } = req.body;

    if (!toolName) {
      return res.status(400).json({ error: "toolName is required" });
    }

    const result = await executeToolWithRBAC(toolName, args || {}, {
      userId,
      userRole: userRole as UserRole,
      userName,
      userEmail,
      companyId,
      confirmed: true,
    });

    return res.json({
      success: true,
      toolName,
      result,
    });
  } catch (err: any) {
    console.error(`Tool execution error [${req.body.toolName}]:`, err.message);
    return res.status(403).json({
      error: err.message,
    });
  }
});
