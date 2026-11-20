import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { dbRepository } from "../db/index.js";
import { getRoleAllowedToolNames, UserRole } from "../services/tools/toolRegistry.js";

export const authRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-employee-assistant-jwt-key-2026";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    name: string;
    companyId: string;
  };
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// POST /api/auth/login
authRouter.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    let user = await dbRepository.users.findByEmail(email);
    // Allow seamless alias for founder email if changed in DB
    if (!user && (email === "sohail@sohail.world" || email === "sohailansari483@gmail.com")) {
      user = (await dbRepository.users.findByEmail("sohailansari483@gmail.com")) ||
             (await dbRepository.users.findByEmail("sohail@sohail.world"));
    }
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isMatch = bcrypt.compareSync(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        companyId: user.companyId,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const allowedTools = getRoleAllowedToolNames(user.role as UserRole);

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        title: user.title,
        avatarUrl: user.avatarUrl,
        githubUsername: user.githubUsername,
        companyId: user.companyId,
      },
      allowedTools,
    });
  } catch (err: any) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal server error during login" });
  }
});

// GET /api/auth/me
authRouter.get("/me", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const user = await dbRepository.users.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const allowedTools = getRoleAllowedToolNames(user.role as UserRole);

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        title: user.title,
        avatarUrl: user.avatarUrl,
        githubUsername: user.githubUsername,
        companyId: user.companyId,
      },
      allowedTools,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/demo-users (For Judges & Instant 1-Click Evaluation)
authRouter.get("/demo-users", async (req: Request, res: Response) => {
  const users = await dbRepository.users.listByCompany();
  const demoUsers = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    title: u.title,
    avatarUrl: u.avatarUrl,
    allowedTools: getRoleAllowedToolNames(u.role as UserRole),
  }));

  return res.json({
    users: demoUsers,
    defaultPassword: "Password123!",
  });
});

// POST /api/auth/switch-role (Instant & Seamless Role Switch for Judges & Voice Navigation)
authRouter.post("/switch-role", async (req: Request, res: Response) => {
  try {
    const { role } = req.body;
    if (!role) {
      return res.status(400).json({ error: "Role is required" });
    }

    const users = await dbRepository.users.listByCompany();
    let user = users.find((u) => u.role === role);

    // If switching to admin, match admin role or founder email
    if (role === "admin" && !user) {
      user = users.find(
        (u) =>
          u.email === "sohailansari483@gmail.com" ||
          u.email === "sohail@sohail.world" ||
          u.role === "admin"
      );
    }

    if (!user) {
      return res.status(404).json({ error: `No active user found with role ${role}` });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        companyId: user.companyId,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const allowedTools = getRoleAllowedToolNames(user.role as UserRole);

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        title: user.title,
        avatarUrl: user.avatarUrl,
        githubUsername: user.githubUsername,
        companyId: user.companyId,
      },
      allowedTools,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
