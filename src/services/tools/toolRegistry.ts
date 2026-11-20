import { dbRepository } from "../../db/index.js";
import { emailService } from "../email/emailService.js";
import { githubService } from "../github/githubService.js";
import { ragService } from "../rag/ragService.js";
import { sseService } from "../events/sseService.js";
import bcrypt from "bcryptjs";

export type UserRole = "admin" | "hr" | "engineering_manager" | "software_engineer";

export interface ToolExecutionContext {
  userId: string;
  userRole: UserRole;
  userName: string;
  userEmail: string;
  companyId?: string;
  confirmed?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  allowedRoles: UserRole[];
  requiresConfirmation?: boolean;
  execute: (args: any, context: ToolExecutionContext) => Promise<any>;
}

export const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  // ============================================================================
  // 0. UNIVERSAL TOOLS (All 4 Roles)
  // ============================================================================
  send_email: {
    name: "send_email",
    description: "Send an authentic email to an employee, candidate, or external contact. Always confirm recipient and summary before sending.",
    allowedRoles: ["admin", "hr", "engineering_manager", "software_engineer"],
    requiresConfirmation: true,
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email address" },
        subject: { type: "string", description: "Email subject line" },
        body: { type: "string", description: "Email message body content" },
      },
      required: ["to", "subject", "body"],
    },
    execute: async (args, context) => {
      console.log(` Universal Tool 'send_email' invoked by ${context.userName} (${context.userRole})`);
      const result = await emailService.sendEmail({
        to: args.to,
        subject: args.subject,
        body: args.body,
        senderName: context.userName,
      });

      await dbRepository.auditLogs.create({
        companyId: context.companyId || "comp_onecorp_01",
        userId: context.userId,
        userName: context.userName,
        userRole: context.userRole,
        action: "EMAIL_SENT",
        details: `Sent email to ${args.to} with subject "${args.subject}"`,
        toolName: "send_email",
      });

      return {
        success: true,
        recipient: args.to,
        subject: args.subject,
        preview: result.preview,
        message: `Email successfully dispatched to ${args.to}`,
      };
    },
  },

  query_company_knowledge: {
    name: "query_company_knowledge",
    description: "RAG lookup over internal company documents, HR leave policies, sprint guidelines, expense limits, and architecture standards.",
    allowedRoles: ["admin", "hr", "engineering_manager", "software_engineer"],
    parameters: {
      type: "object",
      properties: {
        question: { type: "string", description: "The internal policy or process question" },
      },
      required: ["question"],
    },
    execute: async (args, context) => {
      console.log(` Universal Tool 'query_company_knowledge' invoked: "${args.question}"`);
      const ragResult = await ragService.answerPolicyQuestion(args.question, context.companyId);

      sseService.sendToUser(context.userId, "KNOWLEDGE_LOOKUP_COMPLETED", {
        question: args.question,
        answer: ragResult.answer,
        sources: ragResult.sources,
      });

      return ragResult;
    },
  },

  get_my_profile: {
    name: "get_my_profile",
    description: "Retrieve current employee profile details, permissions, and assigned company.",
    allowedRoles: ["admin", "hr", "engineering_manager", "software_engineer"],
    parameters: { type: "object", properties: {} },
    execute: async (args, context) => {
      const user = await dbRepository.users.findById(context.userId);
      return {
        user,
        permissions: getRoleAllowedToolNames(context.userRole),
      };
    },
  },

  // ============================================================================
  // 1. STANDOUT FLOW: HYBRID VOICE ONBOARDING
  // ============================================================================
  update_onboarding_form: {
    name: "update_onboarding_form",
    description: "Live fills the company registration form on screen as the founder speaks during the onboarding interview.",
    allowedRoles: ["admin"],
    parameters: {
      type: "object",
      properties: {
        companyName: { type: "string" },
        founderName: { type: "string" },
        founderEmail: { type: "string" },
        githubRepo: { type: "string" },
        githubToken: { type: "string" },
      },
    },
    execute: async (args, context) => {
      console.log(` Hybrid Onboarding Form Live Update:`, args);
      sseService.broadcast("FORM_FIELD_UPDATED", {
        fields: args,
        timestamp: new Date().toISOString(),
      });
      return { success: true, updatedFields: args };
    },
  },

  finalize_workspace: {
    name: "finalize_workspace",
    description: "Finalize and provision the new company workspace after the voice interview and form review.",
    allowedRoles: ["admin"],
    parameters: {
      type: "object",
      properties: {
        companyName: { type: "string" },
        founderName: { type: "string" },
        founderEmail: { type: "string" },
        githubRepo: { type: "string" },
      },
      required: ["companyName", "founderName", "founderEmail"],
    },
    execute: async (args, context) => {
      const comp = await dbRepository.companies.create({
        name: args.companyName,
        founderName: args.founderName,
        founderEmail: args.founderEmail,
        githubRepo: args.githubRepo || "thecodephilic-guy/doc-assistant",
      });

      sseService.broadcast("WORKSPACE_INITIALIZED", { company: comp });
      return { success: true, company: comp, message: `Workspace '${comp.name}' created successfully.` };
    },
  },

  // ============================================================================
  // 2. ROLE 1: ADMIN (FOUNDER) TOOLS
  // ============================================================================
  provision_employee: {
    name: "provision_employee",
    description: "Voice-provision a new team member. Generates a secure password, adds them to DB, and sends them their onboarding email immediately.",
    allowedRoles: ["admin"],
    requiresConfirmation: true,
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name of the new employee" },
        email: { type: "string", description: "Email address of the new employee" },
        role: {
          type: "string",
          enum: ["hr", "engineering_manager", "software_engineer"],
          description: "Role to assign",
        },
        title: { type: "string", description: "Job title (e.g. HR Manager, Senior Engineer)" },
      },
      required: ["name", "email", "role"],
    },
    execute: async (args, context) => {
      console.log(` Admin Tool 'provision_employee' executing for ${args.name} (${args.role})`);
      const rawPassword = `OneCorp${Math.floor(1000 + Math.random() * 9000)}!`;
      const passwordHash = bcrypt.hashSync(rawPassword, 10);

      const titleMap: Record<string, string> = {
        hr: "HR Talent Manager",
        engineering_manager: "Engineering Manager",
        software_engineer: "Software Engineer",
      };

      const newUser = await dbRepository.users.create({
        companyId: context.companyId || "comp_onecorp_01",
        name: args.name,
        email: args.email,
        passwordHash,
        role: args.role,
        title: args.title || titleMap[args.role] || "Employee",
        avatarUrl: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
        githubUsername: args.name.toLowerCase().replace(/\s+/g, "") + "-onecorp",
      });

      // Automated Onboarding Email
      const emailBody = `Welcome to One Corp, ${args.name}!

Your employee account has been provisioned by Sohail Ansari (Founder).
You can now log in to the One Corp Workplace Voice AI Assistant:

Login URL: ${process.env.CLIENT_URL || "http://localhost:3000"}/login
Email: ${args.email}
Temporary Password: ${rawPassword}
Assigned Role: ${newUser.title} (${args.role.toUpperCase()})

Please log in and test your role-restricted voice productivity tools.

Best regards,
One Corp Admin & People Team`;

      // Automated Onboarding Email (dispatched concurrently so voice response stays instantaneous)
      emailService
        .sendEmail({
          to: args.email,
          subject: `Welcome to One Corp - Your Account Credentials`,
          body: emailBody,
          senderName: "Sohail Ansari (Founder)",
        })
        .catch((e: any) => console.warn("Email dispatch note:", e.message));

      await dbRepository.auditLogs.create({
        companyId: context.companyId || "comp_onecorp_01",
        userId: context.userId,
        userName: context.userName,
        userRole: context.userRole,
        action: "EMPLOYEE_PROVISIONED",
        details: `Provisioned ${args.name} (${args.email}) as ${newUser.title}`,
        toolName: "provision_employee",
      });

      sseService.broadcast("EMPLOYEE_PROVISIONED", { user: newUser });
      sseService.broadcast("DASHBOARD_REFRESH", { source: "TEAM" });

      return {
        success: true,
        user: newUser,
        temporaryPassword: rawPassword,
        message: `Successfully provisioned ${args.name} as ${newUser.title}. Onboarding email sent to ${args.email}.`,
      };
    },
  },

  get_company_pulse: {
    name: "get_company_pulse",
    description: "Provide the founder with an instant pulse summary of team headcount, open GitHub issues, and recent company activity.",
    allowedRoles: ["admin"],
    parameters: { type: "object", properties: {} },
    execute: async (args, context) => {
      const usersList = await dbRepository.users.listByCompany();
      const issues = await dbRepository.githubIssues.listByCompany();
      const applicants = await dbRepository.jobApplicants.listByCompany();
      const recentLogs = await dbRepository.auditLogs.listRecent(5);

      const openIssues = issues.filter((i) => i.status === "OPEN" || i.status === "IN_PROGRESS");
      const highPriorityIssues = issues.filter((i) => i.priority === "URGENT" || i.priority === "HIGH");

      const pulseData = {
        totalEmployees: usersList.length,
        employeesByRole: {
          admin: usersList.filter((u) => u.role === "admin").length,
          hr: usersList.filter((u) => u.role === "hr").length,
          engineering_manager: usersList.filter((u) => u.role === "engineering_manager").length,
          software_engineer: usersList.filter((u) => u.role === "software_engineer").length,
        },
        openIssuesCount: openIssues.length,
        highPriorityIssuesCount: highPriorityIssues.length,
        activeApplicants: applicants.filter((a) => a.status === "REVIEWING" || a.status === "SHORTLISTED").length,
        recentActivity: recentLogs.map((l) => `${l.userName} (${l.userRole}): ${l.details}`),
      };

      sseService.sendToUser(context.userId, "COMPANY_PULSE_UPDATED", pulseData);

      return {
        success: true,
        summary: `One Corp currently has ${pulseData.totalEmployees} team members across 4 roles, with ${pulseData.openIssuesCount} open GitHub issues (${pulseData.highPriorityIssuesCount} high/urgent priority), and ${pulseData.activeApplicants} active job candidates in pipeline.`,
        data: pulseData,
      };
    },
  },

  // ============================================================================
  // 3. ROLE 2: HR TOOLS
  // ============================================================================
  get_daily_schedule: {
    name: "get_daily_schedule",
    description: "Fetch HR's daily schedule from database and render/update the interactive daily checklist on screen by voice.",
    allowedRoles: ["hr"],
    parameters: { type: "object", properties: {} },
    execute: async (args, context) => {
      const schedules = await dbRepository.dailySchedules.listByUser(context.userId);
      const pending = schedules.filter((s) => !s.isCompleted);

      sseService.sendToUser(context.userId, "SCHEDULE_LOADED", { schedules });

      return {
        success: true,
        greeting: `Good day ${context.userName}! You have ${schedules.length} scheduled items today, with ${pending.length} remaining to be completed.`,
        checklist: schedules,
      };
    },
  },

  toggle_schedule_task: {
    name: "toggle_schedule_task",
    description: "Toggle completion status of an HR daily checklist task by ID or title.",
    allowedRoles: ["hr"],
    parameters: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "The task id to toggle" },
      },
      required: ["taskId"],
    },
    execute: async (args, context) => {
      const updated = await dbRepository.dailySchedules.toggleCompleted(args.taskId);
      if (updated) {
        sseService.sendToUser(context.userId, "SCHEDULE_UPDATED", { task: updated });
        return { success: true, task: updated };
      }
      return { success: false, message: "Task not found" };
    },
  },

  shortlist_candidates: {
    name: "shortlist_candidates",
    description: "Query and rank candidate resumes from job_applicants table for a given role (e.g. Backend Engineer), render the Top 3 Cards on screen live, mark them SHORTLISTED, and dispatch interview invites.",
    allowedRoles: ["hr"],
    requiresConfirmation: true,
    parameters: {
      type: "object",
      properties: {
        role: { type: "string", description: "The job role to shortlist for (e.g. Backend Engineer)" },
        sendInvites: { type: "boolean", description: "Whether to dispatch real interview invite emails" },
      },
      required: ["role"],
    },
    execute: async (args, context) => {
      console.log(` HR Tool 'shortlist_candidates' query for: ${args.role}`);
      const candidates = await dbRepository.jobApplicants.getTopCandidates(args.role, 3);

      // Render Top 3 Cards live on screen via SSE
      sseService.broadcast("CANDIDATES_SHORTLISTED_LIVE", {
        role: args.role,
        candidates,
        count: candidates.length,
        timestamp: new Date().toISOString(),
      });

      // Mark status as SHORTLISTED
      for (const cand of candidates) {
        await dbRepository.jobApplicants.updateStatus(cand.id, "SHORTLISTED");

        if (args.sendInvites !== false) {
          const inviteBody = `Dear ${cand.name},

Congratulations! The Talent Team at One Corp has reviewed your background for the ${args.role} position. Based on your impressive expertise in ${cand.skills}, we are pleased to shortlist you for our technical interview rounds.

Please pick a suitable interview slot via our calendar link: https://calendly.com/onecorp/interview-${cand.id}

Best regards,
Sarah Jenkins
Head of People & Talent, One Corp`;

          await emailService.sendEmail({
            to: cand.email,
            subject: `Interview Invitation: ${args.role} at One Corp`,
            body: inviteBody,
            senderName: "Sarah Jenkins (HR)",
          });
        }
      }

      await dbRepository.auditLogs.create({
        companyId: context.companyId || "comp_onecorp_01",
        userId: context.userId,
        userName: context.userName,
        userRole: context.userRole,
        action: "CANDIDATES_SHORTLISTED",
        details: `Shortlisted top 3 candidates for ${args.role}: ${candidates.map((c) => `${c.name} (${c.score}%)`).join(", ")}`,
        toolName: "shortlist_candidates",
      });

      sseService.broadcast("DASHBOARD_REFRESH", { source: "RECRUITING" });

      return {
        success: true,
        role: args.role,
        candidates,
        message: `Found top 3 candidates: ${candidates.map((c) => `${c.name} (Score ${c.score})`).join(", ")}. Marked them as SHORTLISTED and dispatched interview invitations.`,
      };
    },
  },

  // ============================================================================
  // 4. ROLE 3: ENGINEERING MANAGER (EM) TOOLS
  // ============================================================================
  get_team_repo_visibility: {
    name: "get_team_repo_visibility",
    description: "Provide EM with complete visibility into open repository issues, current assignees, and active engineering priorities.",
    allowedRoles: ["engineering_manager", "admin"],
    parameters: { type: "object", properties: {} },
    execute: async (args, context) => {
      const issues = await dbRepository.githubIssues.listByCompany();
      const openIssues = issues.filter((i) => i.status !== "CLOSED");

      sseService.sendToUser(context.userId, "REPO_VISIBILITY_UPDATED", { issues: openIssues });

      const issueHighlights = openIssues
        .slice(0, 3)
        .map((i) => `"${i.title}", assigned to ${i.assigneeName}`)
        .join("; ");

      const voiceSummary = openIssues.length > 0
        ? `We have ${openIssues.length} open issues in the repository. Notably: ${issueHighlights}.`
        : `All issues are currently resolved. The repository has zero open tickets.`;

      return {
        success: true,
        openCount: openIssues.length,
        issues: openIssues,
        summary: voiceSummary,
      };
    },
  },

  assign_github_task: {
    name: "assign_github_task",
    description: "Cross-Role Hero Flow: Create a GitHub issue on the repository, assign it to an engineer (e.g. Rohan), save to DB, and send them a real notification email.",
    allowedRoles: ["engineering_manager"],
    requiresConfirmation: true,
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Issue title (e.g. 'Fix payment webhook timeout')" },
        assigneeName: { type: "string", description: "Engineer name to assign (e.g. 'Rohan' or 'Rohan Verma')" },
        assigneeEmail: { type: "string", description: "Engineer email address" },
        body: { type: "string", description: "Issue description and reproduction details" },
        priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"], description: "Issue priority" },
      },
      required: ["title", "assigneeName"],
    },
    execute: async (args, context) => {
      console.log(` EM Cross-Role Tool 'assign_github_task' executing: "${args.title}" -> ${args.assigneeName}`);

      // 1. Resolve Assignee from DB
      const usersList = await dbRepository.users.listByCompany();
      const assignee = usersList.find(
        (u) =>
          u.name.toLowerCase().includes(args.assigneeName.toLowerCase()) ||
          args.assigneeName.toLowerCase().includes(u.name.toLowerCase())
      );

      const targetEmail = args.assigneeEmail || assignee?.email || "rohan@onecorp.ai";
      const targetName = assignee?.name || args.assigneeName;
      const targetGithubUsername = assignee?.githubUsername || "thecodephilic-guy";

      // 2. Call GitHub REST API / save to DB
      const newIssue = await githubService.createIssue({
        title: args.title,
        body: args.body || `Task created and assigned by Engineering Manager ${context.userName} via Voice Assistant.`,
        assigneeName: targetName,
        assigneeGithubUsername: targetGithubUsername,
        priority: args.priority || "HIGH",
        companyId: context.companyId,
      });

      // 3. Send Rohan a real notification email
      const emailContent = `Hi ${targetName},

You have been assigned a new high-priority GitHub issue by Engineering Manager ${context.userName}:

Issue #${newIssue.issueNumber}: ${args.title}
Repository: thecodephilic-guy/doc-assistant
Priority: ${newIssue.priority}
Link: ${newIssue.githubUrl}

Details:
${newIssue.body}

Please acknowledge this ticket and provide updates during standup or via your Employee Voice Assistant.

Best,
${context.userName}
Engineering Manager`;

      await emailService.sendEmail({
        to: targetEmail,
        subject: `New GitHub Assignment: Issue #${newIssue.issueNumber} - ${args.title}`,
        body: emailContent,
        senderName: `${context.userName} (EM)`,
      });

      await dbRepository.auditLogs.create({
        companyId: context.companyId || "comp_onecorp_01",
        userId: context.userId,
        userName: context.userName,
        userRole: context.userRole,
        action: "GITHUB_ISSUE_ASSIGNED",
        details: `Created Issue #${newIssue.issueNumber} "${args.title}", assigned to ${targetName}, and dispatched email to ${targetEmail}`,
        toolName: "assign_github_task",
      });

      return {
        success: true,
        issue: newIssue,
        assignee: targetName,
        emailSentTo: targetEmail,
        message: `Successfully created GitHub Issue #${newIssue.issueNumber} "${args.title}", assigned to ${targetName}, and emailed notification to ${targetEmail}.`,
      };
    },
  },

  // ============================================================================
  // 5. ROLE 4: SOFTWARE ENGINEER (SWE) TOOLS
  // ============================================================================
  get_assigned_work_and_briefing: {
    name: "get_assigned_work_and_briefing",
    description: "SWE Tool: Query all GitHub issues assigned to the logged-in engineer (including issues just assigned by EM), read recent discussion comments, and summarize the thread.",
    allowedRoles: ["software_engineer"],
    parameters: { type: "object", properties: {} },
    execute: async (args, context) => {
      console.log(` SWE Tool 'get_assigned_work_and_briefing' for ${context.userName}`);
      const assignedIssues = await githubService.getAssignedIssuesWithComments(context.userName);

      sseService.sendToUser(context.userId, "SWE_ASSIGNED_WORK_LOADED", { issues: assignedIssues });

      const issueBriefings = assignedIssues.map((iss) => {
        const commentSummaries = iss.comments.length > 0
          ? iss.comments.map((c) => `  - [${c.authorName}]: ${c.commentBody}`).join("\n")
          : "  (No comments yet)";
        return `• Issue #${iss.issueNumber}: "${iss.title}" [${iss.priority}]
Status: ${iss.status}
Recent Comments:\n${commentSummaries}`;
      });

      return {
        success: true,
        assignedCount: assignedIssues.length,
        issues: assignedIssues,
        briefing: `You have ${assignedIssues.length} assigned issues in core-platform:\n\n${issueBriefings.join("\n\n")}`,
      };
    },
  },

  post_issue_update_and_standup: {
    name: "post_issue_update_and_standup",
    description: "Hands-Free Status Update: Post a comment on a GitHub issue, and send a standup summary email to the Engineering Manager.",
    allowedRoles: ["software_engineer"],
    requiresConfirmation: true,
    parameters: {
      type: "object",
      properties: {
        issueNumber: { type: "number", description: "The GitHub issue number to comment on (e.g. 12)" },
        comment: { type: "string", description: "Comment body (e.g. 'Found root cause, PR coming today')" },
        managerEmail: { type: "string", description: "Manager email address (defaults to marcus@onecorp.ai)" },
        standupSummary: { type: "string", description: "Summary text for the daily standup email" },
      },
      required: ["issueNumber", "comment"],
    },
    execute: async (args, context) => {
      console.log(` SWE Tool 'post_issue_update_and_standup' executing on Issue #${args.issueNumber}`);

      // 1. Post real comment to GitHub issue
      const commentRecord = await githubService.addComment({
        issueNumber: Number(args.issueNumber),
        commentBody: args.comment,
        authorName: context.userName,
        authorId: context.userId,
        companyId: context.companyId,
      });

      // 2. Dispatch standup update email to manager Marcus
      const targetManagerEmail = args.managerEmail || "marcus@onecorp.ai";
      const standupBody = `Hi Marcus,

Here is my daily standup update submitted via Employee Voice Assistant:

Issue #${args.issueNumber} Update:
"${args.comment}"

Standup Summary:
${args.standupSummary || `Root cause diagnosed on Issue #${args.issueNumber}. Fix implementation is in progress and PR will be submitted for code review today.`}

Best regards,
${context.userName}
Software Engineer, One Corp`;

      await emailService.sendEmail({
        to: targetManagerEmail,
        subject: `Standup & Ticket Update: Issue #${args.issueNumber} - ${context.userName}`,
        body: standupBody,
        senderName: `${context.userName} (SWE)`,
      });

      await dbRepository.auditLogs.create({
        companyId: context.companyId || "comp_onecorp_01",
        userId: context.userId,
        userName: context.userName,
        userRole: context.userRole,
        action: "GITHUB_COMMENT_POSTED",
        details: `Posted comment on Issue #${args.issueNumber}: "${args.comment}" and emailed standup to ${targetManagerEmail}`,
        toolName: "post_issue_update_and_standup",
      });

      sseService.broadcast("DASHBOARD_REFRESH", { source: "GITHUB_COMMENT" });

      return {
        success: true,
        issueNumber: args.issueNumber,
        comment: commentRecord,
        managerEmail: targetManagerEmail,
        message: `Posted comment on GitHub Issue #${args.issueNumber} and emailed standup update to ${targetManagerEmail}.`,
      };
    },
  },
};

export function getRoleAllowedTools(role: UserRole): ToolDefinition[] {
  return Object.values(TOOL_REGISTRY).filter((tool) => tool.allowedRoles.includes(role));
}

export function getRoleAllowedToolNames(role: UserRole): string[] {
  return getRoleAllowedTools(role).map((t) => t.name);
}

export async function executeToolWithRBAC(
  toolName: string,
  args: any,
  context: ToolExecutionContext
): Promise<any> {
  const tool = TOOL_REGISTRY[toolName];
  if (!tool) {
    throw new Error(`Tool '${toolName}' does not exist in registry.`);
  }

  // Strict RBAC Enforcement
  if (!tool.allowedRoles.includes(context.userRole)) {
    const errorMsg = `🔒 RBAC Permission Denied: Role '${context.userRole}' is strictly forbidden from executing tool '${toolName}'. Permitted roles are: [${tool.allowedRoles.join(", ")}].`;
    console.error(errorMsg);

    await dbRepository.auditLogs.create({
      companyId: context.companyId || "comp_onecorp_01",
      userId: context.userId,
      userName: context.userName,
      userRole: context.userRole,
      action: "RBAC_VIOLATION_BLOCKED",
      details: errorMsg,
      toolName,
    });

    throw new Error(errorMsg);
  }

  return await tool.execute(args, context);
}
