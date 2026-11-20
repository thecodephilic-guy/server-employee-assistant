import { Router, Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "./authRoutes.js";
import { dbRepository } from "../db/index.js";
import { sseService } from "../services/events/sseService.js";
import { githubService } from "../services/github/githubService.js";
import bcrypt from "bcryptjs";

export const dashboardRouter = Router();

// GET /api/dashboard/summary
dashboardRouter.get("/summary", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const company = await dbRepository.companies.get(user.companyId);
    const users = await dbRepository.users.listByCompany();
    const issues = await dbRepository.githubIssues.listByCompany();
    const applicants = await dbRepository.jobApplicants.listByCompany();
    const schedules = await dbRepository.dailySchedules.listByUser(user.id);
    const documents = await dbRepository.companyDocuments.listByCompany();
    const auditLogs = await dbRepository.auditLogs.listRecent(15);
    const repos = await githubService.getUserRepositories();

    // Filter assigned issues for SWE
    const assignedIssues = issues.filter(
      (i) => i.assigneeId === user.id || i.assigneeName.toLowerCase().includes(user.name.toLowerCase())
    );

    // Fetch comments for all issues
    const issuesWithComments = await Promise.all(
      issues.map(async (iss) => {
        const comments = await dbRepository.issueComments.listByIssue(iss.id);
        return { ...iss, comments };
      })
    );

    return res.json({
      role: user.role,
      user,
      company,
      stats: {
        totalEmployees: users.length,
        openIssuesCount: issues.filter((i) => i.status !== "CLOSED").length,
        activeApplicantsCount: applicants.filter((a) => a.status === "REVIEWING" || a.status === "SHORTLISTED").length,
        pendingScheduleCount: schedules.filter((s) => !s.isCompleted).length,
      },
      team: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        title: u.title,
        avatarUrl: u.avatarUrl,
        githubUsername: u.githubUsername,
      })),
      issues: issuesWithComments,
      assignedIssues: issuesWithComments.filter(
        (i) => i.assigneeId === user.id || i.assigneeName.toLowerCase().includes(user.name.toLowerCase())
      ),
      applicants,
      schedules,
      documents,
      auditLogs,
      repos,
    });
  } catch (err: any) {
    console.error("Dashboard summary error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/repos
dashboardRouter.get("/repos", authMiddleware, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const repos = await githubService.getUserRepositories();
    return res.json({ repos });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/dashboard/checklist/toggle
dashboardRouter.post("/checklist/toggle", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { taskId } = req.body;
    if (!taskId) return res.status(400).json({ error: "taskId is required" });

    const updated = await dbRepository.dailySchedules.toggleCompleted(taskId);
    if (!updated) return res.status(404).json({ error: "Task not found" });

    sseService.sendToUser(req.user!.id, "SCHEDULE_UPDATED", { task: updated });
    return res.json({ success: true, task: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/dashboard/onboard/register (Standout Flow Manual Fallback)
dashboardRouter.post("/onboard/register", async (req, res) => {
  try {
    const { companyName, founderName, founderEmail, password, githubRepo, githubToken } = req.body;
    if (!companyName || !founderName || !founderEmail) {
      return res.status(400).json({ error: "companyName, founderName, and founderEmail are required" });
    }

    const company = await dbRepository.companies.create({
      name: companyName,
      founderName,
      founderEmail,
      githubRepo: githubRepo || "thecodephilic-guy/doc-assistant",
      githubToken: githubToken || "",
    });

    const rawPassword = password || "Password123!";
    const passwordHash = bcrypt.hashSync(rawPassword, 10);

    const founderUser = await dbRepository.users.create({
      companyId: company.id,
      name: founderName,
      email: founderEmail,
      passwordHash,
      role: "admin",
      title: "Founder & CEO",
      avatarUrl: "https://avatars.githubusercontent.com/u/65657371?v=4",
      githubUsername: founderName.toLowerCase().replace(/\s+/g, "") + "-onecorp",
    });

    sseService.broadcast("WORKSPACE_INITIALIZED", { company, founder: founderUser });

    return res.json({
      success: true,
      company,
      founder: founderUser,
      message: `Workspace '${company.name}' provisioned successfully!`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
