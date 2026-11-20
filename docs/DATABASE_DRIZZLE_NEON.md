# Neon PostgreSQL Database & Drizzle ORM

## Database Stack
- **Engine**: PostgreSQL hosted on **Neon Serverless**
- **ORM**: **Drizzle ORM** (`drizzle-orm`, `drizzle-kit`)
- **Connection**: Connection pooling via `@neondatabase/serverless` and `pg.Pool`

## Database Schema (`src/db/schema.ts`)
1. **`companies`**: Workspace details, founder information, and repository configurations.
2. **`users`**: Multi-user accounts with bcrypt password hashes, assigned role (`admin`, `hr`, `engineering_manager`, `software_engineer`), job title, and GitHub usernames.
3. **`job_applicants`**: Candidates applying for roles (e.g. Backend Engineer) with resume summaries, skill tags, experience years, matching scores (0-100), and statuses (`NEW`, `REVIEWING`, `SHORTLISTED`, `OFFERED`).
4. **`github_issues`**: Tracked engineering issues with issue numbers, titles, bodies, priorities (`LOW`, `MEDIUM`, `HIGH`, `URGENT`), and assigned engineers.
5. **`issue_comments`**: Discussion threads on issues, synchronized bidirectionally with GitHub.
6. **`daily_schedules`**: Time-slotted HR schedules and daily action checklists.
7. **`company_documents`**: Internal knowledge base articles for LangChain RAG.
8. **`audit_logs`**: System audit trail logging all voice actions, email dispatches, and RBAC checks.

## Dual-Adapter Repository
The `dbRepository` exposes a clean async interface. If `DATABASE_URL` is configured, it operates directly on Neon PostgreSQL; otherwise, it boots an authentic in-memory store pre-populated with realistic company seed data for instant zero-friction judging and testing.
