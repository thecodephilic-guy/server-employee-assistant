import dotenv from "dotenv";
dotenv.config();

import { initDatabase, db, isPostgresConnected } from "./index.js";
import {
  companies,
  users,
  jobApplicants,
  githubIssues,
  issueComments,
  dailySchedules,
  companyDocuments,
  auditLogs,
} from "./schema.js";
import {
  SEED_COMPANY,
  SEED_USERS,
  SEED_JOB_APPLICANTS,
  SEED_GITHUB_ISSUES,
  SEED_ISSUE_COMMENTS,
  SEED_DAILY_SCHEDULES,
  SEED_DOCUMENTS,
} from "./seedData.js";

async function main() {
  console.log("🚀 Initializing Neon PostgreSQL Database reset & seeding for One Corp...");
  await initDatabase();

  if (!isPostgresConnected || !db) {
    console.log("ℹ️ No active Neon PostgreSQL connection found in DATABASE_URL. In-memory data store is fully seeded and ready.");
    process.exit(0);
  }

  try {
    console.log("🧹 Clearing old database records in foreign-key order...");
    await db.delete(auditLogs);
    await db.delete(issueComments);
    await db.delete(githubIssues);
    await db.delete(dailySchedules);
    await db.delete(companyDocuments);
    await db.delete(jobApplicants);
    await db.delete(users);
    await db.delete(companies);
    console.log("✅ Database cleared cleanly.");

    console.log("🏢 Inserting One Corp company record...");
    await db.insert(companies).values(SEED_COMPANY);

    console.log("👥 Inserting One Corp core team (Sohail, Sarah, Marcus, Rohan)...");
    await db.insert(users).values(SEED_USERS);

    console.log("📋 Inserting job applicants for One Corp...");
    await db.insert(jobApplicants).values(SEED_JOB_APPLICANTS);

    console.log("🐙 Inserting real GitHub issues for thecodephilic-guy/doc-assistant...");
    await db.insert(githubIssues).values(SEED_GITHUB_ISSUES);

    console.log("💬 Inserting issue comments...");
    await db.insert(issueComments).values(SEED_ISSUE_COMMENTS);

    console.log("📅 Inserting daily schedules...");
    await db.insert(dailySchedules).values(SEED_DAILY_SCHEDULES);

    console.log("📚 Inserting One Corp company knowledge documents...");
    await db.insert(companyDocuments).values(SEED_DOCUMENTS);

    console.log("🎉 Neon PostgreSQL database reset and seeded with real One Corp data successfully!");
  } catch (err: any) {
    console.error("❌ Seeding failed:", err.message);
  }
  process.exit(0);
}

main();
