import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";
import {
  SEED_COMPANY,
  SEED_USERS,
  SEED_JOB_APPLICANTS,
  SEED_GITHUB_ISSUES,
  SEED_ISSUE_COMMENTS,
  SEED_DAILY_SCHEDULES,
  SEED_DOCUMENTS,
} from "./seedData.js";
import {
  Company,
  User,
  JobApplicant,
  GithubIssue,
  IssueComment,
  DailySchedule,
  CompanyDocument,
  AuditLog,
} from "./schema.js";

const { Pool } = pg;

export let db: any = null;
export let isPostgresConnected = false;

// In-Memory store initialized with rich seed data for immediate zero-config runtime & testing
class InMemoryStore {
  companies: Company[] = [JSON.parse(JSON.stringify(SEED_COMPANY))];
  users: User[] = JSON.parse(JSON.stringify(SEED_USERS));
  jobApplicants: JobApplicant[] = JSON.parse(JSON.stringify(SEED_JOB_APPLICANTS));
  githubIssues: GithubIssue[] = JSON.parse(JSON.stringify(SEED_GITHUB_ISSUES));
  issueComments: IssueComment[] = JSON.parse(JSON.stringify(SEED_ISSUE_COMMENTS));
  dailySchedules: DailySchedule[] = JSON.parse(JSON.stringify(SEED_DAILY_SCHEDULES));
  companyDocuments: CompanyDocument[] = JSON.parse(JSON.stringify(SEED_DOCUMENTS));
  auditLogs: AuditLog[] = [];
}

const memoryStore = new InMemoryStore();

export async function initDatabase() {
  const connectionString = process.env.DATABASE_URL;

  if (connectionString && !connectionString.includes("sample")) {
    try {
      const pool = new Pool({
        connectionString,
        ssl: connectionString.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
      });

      // Quick test query
      const client = await pool.connect();
      await client.query("SELECT 1;");
      client.release();

      db = drizzle(pool, { schema });
      isPostgresConnected = true;
      console.log(" Connected to Neon PostgreSQL via Drizzle ORM successfully!");

      // Sync memoryStore with live database if data exists
      try {
        const dbCompanies = await db.select().from(schema.companies);
        if (dbCompanies && dbCompanies.length > 0) {
          memoryStore.companies = dbCompanies;
        }

        const dbUsers = await db.select().from(schema.users);
        if (dbUsers && dbUsers.length > 0) {
          memoryStore.users = dbUsers;
        }

        const dbApplicants = await db.select().from(schema.jobApplicants);
        if (dbApplicants && dbApplicants.length > 0) {
          memoryStore.jobApplicants = dbApplicants;
        }

        const dbIssues = await db.select().from(schema.githubIssues);
        if (dbIssues && dbIssues.length > 0) {
          memoryStore.githubIssues = dbIssues;
        }

        const dbComments = await db.select().from(schema.issueComments);
        if (dbComments && dbComments.length > 0) {
          memoryStore.issueComments = dbComments;
        }

        const dbSchedules = await db.select().from(schema.dailySchedules);
        if (dbSchedules && dbSchedules.length > 0) {
          memoryStore.dailySchedules = dbSchedules;
        }

        const dbDocs = await db.select().from(schema.companyDocuments);
        if (dbDocs && dbDocs.length > 0) {
          memoryStore.companyDocuments = dbDocs;
        }
        console.log(" Live Neon PostgreSQL records loaded into runtime state.");
      } catch (syncErr: any) {
        console.warn("Neon live sync warning (tables may be empty or unmigrated):", syncErr.message);
      }
      return;
    } catch (err: any) {
      console.warn("⚠️ Neon PostgreSQL connection failed or unreachable. Falling back to high-fidelity In-Memory Store:", err.message);
      isPostgresConnected = false;
    }
  } else {
    console.log("ℹ️ No DATABASE_URL set. Running on pre-seeded In-Memory Store with full Neon Drizzle schema compatibility.");
  }
}

// Unified Repository Layer for all Business Workflows
export const dbRepository = {
  companies: {
    get: async (id: string = "comp_onecorp_01"): Promise<Company | null> => {
      return memoryStore.companies.find((c) => c.id === id) || memoryStore.companies[0] || null;
    },
    create: async (data: Partial<Company>): Promise<Company> => {
      const newComp: Company = {
        id: data.id || `comp_${Date.now()}`,
        name: data.name || "One Corp",
        domain: data.domain || "onecorp.ai",
        founderName: data.founderName || "Sohail Ansari",
        founderEmail: data.founderEmail || "sohailansari483@gmail.com",
        githubRepo: data.githubRepo || "thecodephilic-guy/doc-assistant",
        githubToken: data.githubToken || "",
        createdAt: new Date(),
      };
      memoryStore.companies.push(newComp);
      if (isPostgresConnected && db) {
        db.insert(schema.companies).values(newComp).catch((e: any) => console.warn("Neon comp insert note:", e.message));
      }
      return newComp;
    },
    update: async (id: string, data: Partial<Company>): Promise<Company | null> => {
      const comp = memoryStore.companies.find((c) => c.id === id);
      if (comp) {
        Object.assign(comp, data);
        return comp;
      }
      return null;
    },
  },

  users: {
    findByEmail: async (email: string): Promise<User | null> => {
      const normalized = email.toLowerCase().trim();
      return memoryStore.users.find((u) => u.email.toLowerCase() === normalized) || null;
    },
    findById: async (id: string): Promise<User | null> => {
      return memoryStore.users.find((u) => u.id === id) || null;
    },
    listByCompany: async (companyId?: string): Promise<User[]> => {
      return memoryStore.users;
    },
    create: async (data: Omit<User, "id" | "createdAt">): Promise<User> => {
      const newUser: User = {
        id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ...data,
        createdAt: new Date(),
      };
      memoryStore.users.push(newUser);
      if (isPostgresConnected && db) {
        db.insert(schema.users).values(newUser).catch((e: any) => console.warn("Neon user insert note:", e.message));
      }
      return newUser;
    },
  },

  jobApplicants: {
    listByCompany: async (): Promise<JobApplicant[]> => {
      return memoryStore.jobApplicants;
    },
    getTopCandidates: async (role: string = "Backend Engineer", limit = 3): Promise<JobApplicant[]> => {
      const matched = memoryStore.jobApplicants.filter(
        (a) => a.roleApplied.toLowerCase().includes(role.toLowerCase()) || role.toLowerCase().includes(a.roleApplied.toLowerCase())
      );
      return matched.sort((a, b) => b.score - a.score).slice(0, limit);
    },
    updateStatus: async (applicantId: string, status: string): Promise<JobApplicant | null> => {
      const app = memoryStore.jobApplicants.find((a) => a.id === applicantId);
      if (app) {
        app.status = status;
        return app;
      }
      return null;
    },
  },

  githubIssues: {
    listByCompany: async (): Promise<GithubIssue[]> => {
      return [...memoryStore.githubIssues].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    },
    findById: async (id: string): Promise<GithubIssue | null> => {
      return memoryStore.githubIssues.find((i) => i.id === id) || null;
    },
    findByIssueNumber: async (issueNumber: number): Promise<GithubIssue | null> => {
      return memoryStore.githubIssues.find((i) => i.issueNumber === issueNumber) || null;
    },
    findByAssignee: async (assigneeId: string): Promise<GithubIssue[]> => {
      return memoryStore.githubIssues.filter((i) => i.assigneeId === assigneeId);
    },
    create: async (data: {
      title: string;
      body: string;
      priority?: string;
      assigneeId?: string;
      assigneeName: string;
      companyId?: string;
      githubUrl?: string;
    }): Promise<GithubIssue> => {
      const nextNumber = Math.max(0, ...memoryStore.githubIssues.map((i) => i.issueNumber)) + 1;
      const newIssue: GithubIssue = {
        id: `iss_${Date.now()}`,
        companyId: data.companyId || "comp_onecorp_01",
        issueNumber: nextNumber,
        title: data.title,
        body: data.body,
        status: "OPEN",
        priority: (data.priority as any) || "MEDIUM",
        assigneeId: data.assigneeId || null,
        assigneeName: data.assigneeName,
        githubUrl: data.githubUrl || `https://github.com/thecodephilic-guy/doc-assistant/issues/${nextNumber}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryStore.githubIssues.unshift(newIssue);
      if (isPostgresConnected && db) {
        db.insert(schema.githubIssues).values(newIssue).catch((e: any) => console.warn("Neon issue insert note:", e.message));
      }
      return newIssue;
    },
    updateStatus: async (issueNumber: number, status: string): Promise<GithubIssue | null> => {
      const issue = memoryStore.githubIssues.find((i) => i.issueNumber === issueNumber);
      if (issue) {
        issue.status = status;
        issue.updatedAt = new Date();
        return issue;
      }
      return null;
    },
  },

  issueComments: {
    listByIssue: async (issueId: string): Promise<IssueComment[]> => {
      return memoryStore.issueComments.filter((c) => c.issueId === issueId);
    },
    create: async (data: {
      issueId: string;
      authorId?: string;
      authorName: string;
      commentBody: string;
      isSyncedToGithub?: boolean;
    }): Promise<IssueComment> => {
      const newComment: IssueComment = {
        id: `com_${Date.now()}`,
        issueId: data.issueId,
        authorId: data.authorId || null,
        authorName: data.authorName,
        commentBody: data.commentBody,
        isSyncedToGithub: data.isSyncedToGithub ?? true,
        createdAt: new Date(),
      };
      memoryStore.issueComments.push(newComment);
      if (isPostgresConnected && db) {
        db.insert(schema.issueComments).values(newComment).catch((e: any) => console.warn("Neon comment insert note:", e.message));
      }
      return newComment;
    },
  },

  dailySchedules: {
    listByUser: async (userId: string): Promise<DailySchedule[]> => {
      return memoryStore.dailySchedules.filter((s) => s.userId === userId);
    },
    create: async (data: {
      userId: string;
      title: string;
      timeSlot: string;
      date?: string;
    }): Promise<DailySchedule> => {
      const newSchedule: DailySchedule = {
        id: `sch_${Date.now()}`,
        userId: data.userId,
        title: data.title,
        timeSlot: data.timeSlot,
        isCompleted: false,
        date: data.date || new Date().toISOString().split("T")[0],
        createdAt: new Date(),
      };
      memoryStore.dailySchedules.push(newSchedule);
      if (isPostgresConnected && db) {
        db.insert(schema.dailySchedules).values(newSchedule).catch((e: any) => console.warn("Neon schedule insert note:", e.message));
      }
      return newSchedule;
    },
    toggleCompleted: async (id: string): Promise<DailySchedule | null> => {
      const item = memoryStore.dailySchedules.find((s) => s.id === id);
      if (item) {
        item.isCompleted = !item.isCompleted;
        return item;
      }
      return null;
    },
  },

  companyDocuments: {
    listByCompany: async (): Promise<CompanyDocument[]> => {
      return memoryStore.companyDocuments;
    },
    searchDocuments: async (query: string): Promise<CompanyDocument[]> => {
      const q = query.toLowerCase();
      return memoryStore.companyDocuments.filter(
        (doc) =>
          doc.title.toLowerCase().includes(q) ||
          doc.content.toLowerCase().includes(q) ||
          doc.category.toLowerCase().includes(q)
      );
    },
    create: async (data: Omit<CompanyDocument, "id" | "createdAt">): Promise<CompanyDocument> => {
      const newDoc: CompanyDocument = {
        id: `doc_${Date.now()}`,
        ...data,
        createdAt: new Date(),
      };
      memoryStore.companyDocuments.push(newDoc);
      if (isPostgresConnected && db) {
        db.insert(schema.companyDocuments).values(newDoc).catch((e: any) => console.warn("Neon doc insert note:", e.message));
      }
      return newDoc;
    },
  },

  auditLogs: {
    create: async (data: Omit<AuditLog, "id" | "createdAt">): Promise<AuditLog> => {
      const log: AuditLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ...data,
        createdAt: new Date(),
      };
      memoryStore.auditLogs.unshift(log);
      if (isPostgresConnected && db) {
        db.insert(schema.auditLogs).values(log).catch((e: any) => console.warn("Neon audit log insert note:", e.message));
      }
      return log;
    },
    listRecent: async (limit = 20): Promise<AuditLog[]> => {
      return memoryStore.auditLogs.slice(0, limit);
    },
  },
};
