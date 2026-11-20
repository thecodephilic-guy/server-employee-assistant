import { pgTable, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const companies = pgTable("companies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  domain: text("domain"),
  founderName: text("founder_name").notNull(),
  founderEmail: text("founder_email").notNull(),
  githubRepo: text("github_repo"),
  githubToken: text("github_token"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  companyId: text("company_id").references(() => companies.id),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(), // 'admin' | 'hr' | 'engineering_manager' | 'software_engineer'
  title: text("title").notNull(),
  avatarUrl: text("avatar_url"),
  githubUsername: text("github_username"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const jobApplicants = pgTable("job_applicants", {
  id: text("id").primaryKey(),
  companyId: text("company_id").references(() => companies.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  roleApplied: text("role_applied").notNull(),
  status: text("status").notNull().default("NEW"), // 'NEW' | 'REVIEWING' | 'SHORTLISTED' | 'INTERVIEWED' | 'OFFERED' | 'REJECTED'
  resumeSummary: text("resume_summary").notNull(),
  skills: text("skills").notNull(), // comma-separated or JSON
  experienceYears: integer("experience_years").notNull(),
  score: integer("score").notNull(),
  matchReasons: text("match_reasons").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const githubIssues = pgTable("github_issues", {
  id: text("id").primaryKey(),
  companyId: text("company_id").references(() => companies.id),
  issueNumber: integer("issue_number").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("OPEN"), // 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  priority: text("priority").notNull().default("MEDIUM"), // 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  assigneeId: text("assignee_id").references(() => users.id),
  assigneeName: text("assignee_name").notNull(),
  githubUrl: text("github_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const issueComments = pgTable("issue_comments", {
  id: text("id").primaryKey(),
  issueId: text("issue_id").references(() => githubIssues.id),
  authorId: text("author_id").references(() => users.id),
  authorName: text("author_name").notNull(),
  commentBody: text("comment_body").notNull(),
  isSyncedToGithub: boolean("is_synced_to_github").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dailySchedules = pgTable("daily_schedules", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  title: text("title").notNull(),
  timeSlot: text("time_slot").notNull(),
  isCompleted: boolean("is_completed").default(false).notNull(),
  date: text("date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const companyDocuments = pgTable("company_documents", {
  id: text("id").primaryKey(),
  companyId: text("company_id").references(() => companies.id),
  title: text("title").notNull(),
  category: text("category").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  companyId: text("company_id"),
  userId: text("user_id"),
  userName: text("user_name").notNull(),
  userRole: text("user_role").notNull(),
  action: text("action").notNull(),
  details: text("details").notNull(),
  toolName: text("tool_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Company = typeof companies.$inferSelect;
export type User = typeof users.$inferSelect;
export type JobApplicant = typeof jobApplicants.$inferSelect;
export type GithubIssue = typeof githubIssues.$inferSelect;
export type IssueComment = typeof issueComments.$inferSelect;
export type DailySchedule = typeof dailySchedules.$inferSelect;
export type CompanyDocument = typeof companyDocuments.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
