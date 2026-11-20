import bcrypt from "bcryptjs";
import {
  Company,
  User,
  JobApplicant,
  GithubIssue,
  IssueComment,
  DailySchedule,
  CompanyDocument,
} from "./schema.js";

const DEFAULT_HASH = bcrypt.hashSync("Password123!", 10);

export const SEED_COMPANY: Company = {
  id: "comp_onecorp_01",
  name: "One Corp",
  domain: "onecorp.ai",
  founderName: "Sohail Ansari",
  founderEmail: "sohailansari483@gmail.com",
  githubRepo: "thecodephilic-guy/doc-assistant",
  githubToken: process.env.GITHUB_TOKEN || "",
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

export const SEED_USERS: User[] = [
  {
    id: "usr_admin_01",
    companyId: "comp_onecorp_01",
    name: "Sohail Ansari",
    email: "sohailansari483@gmail.com",
    passwordHash: DEFAULT_HASH,
    role: "admin",
    title: "Founder & CEO",
    avatarUrl: "https://avatars.githubusercontent.com/u/65657371?v=4",
    githubUsername: "thecodephilic-guy",
    createdAt: new Date("2026-01-01T00:00:00Z"),
  },
  {
    id: "usr_hr_01",
    companyId: "comp_onecorp_01",
    name: "Sarah Jenkins",
    email: "sarah@onecorp.ai",
    passwordHash: DEFAULT_HASH,
    role: "hr",
    title: "Head of People & Talent",
    avatarUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80",
    githubUsername: "sarah-onecorp",
    createdAt: new Date("2026-01-15T00:00:00Z"),
  },
  {
    id: "usr_em_01",
    companyId: "comp_onecorp_01",
    name: "Marcus Vance",
    email: "marcus@onecorp.ai",
    passwordHash: DEFAULT_HASH,
    role: "engineering_manager",
    title: "Engineering Manager - Platform & Infrastructure",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    githubUsername: "marcus-onecorp",
    createdAt: new Date("2026-01-20T00:00:00Z"),
  },
  {
    id: "usr_swe_01",
    companyId: "comp_onecorp_01",
    name: "Rohan Verma",
    email: "rohan@onecorp.ai",
    passwordHash: DEFAULT_HASH,
    role: "software_engineer",
    title: "Senior Fullstack Engineer",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    githubUsername: "thecodephilic-guy",
    createdAt: new Date("2026-02-01T00:00:00Z"),
  },
];

export const SEED_JOB_APPLICANTS: JobApplicant[] = [
  {
    id: "app_01",
    companyId: "comp_onecorp_01",
    name: "Alex Chen",
    email: "alex.chen.dev@gmail.com",
    roleApplied: "Backend Engineer",
    status: "REVIEWING",
    resumeSummary: "6 years designing fault-tolerant distributed systems in Go and Node.js. Built high-throughput transaction pipelines processing 45k RPS at Stripe scale.",
    skills: "Go, Node.js, Distributed Systems, Kafka, PostgreSQL, Redis, Kubernetes",
    experienceYears: 6,
    score: 96,
    matchReasons: "Exceptional distributed systems experience, deep PostgreSQL query optimization track record, authored open-source Kafka client tools.",
    createdAt: new Date("2026-11-10T10:00:00Z"),
  },
  {
    id: "app_02",
    companyId: "comp_onecorp_01",
    name: "Priya Nair",
    email: "priya.nair.tech@outlook.com",
    roleApplied: "Backend Engineer",
    status: "REVIEWING",
    resumeSummary: "5 years building cloud-native microservices with Rust and TypeScript. Lead backend architect at a Series-B fintech startup.",
    skills: "Rust, TypeScript, Express, PostgreSQL, AWS, Docker, gRPC",
    experienceYears: 5,
    score: 93,
    matchReasons: "Strong background in fintech payment gateway integrations, clean API design, excellent concurrent programming expertise.",
    createdAt: new Date("2026-11-12T14:30:00Z"),
  },
  {
    id: "app_03",
    companyId: "comp_onecorp_01",
    name: "David Kim",
    email: "david.kim.eng@yahoo.com",
    roleApplied: "Backend Engineer",
    status: "REVIEWING",
    resumeSummary: "4 years building scalable APIs and event-driven architectures with Node.js and GraphQL on AWS serverless.",
    skills: "Node.js, TypeScript, GraphQL, DynamoDB, AWS Lambda, Terraform",
    experienceYears: 4,
    score: 89,
    matchReasons: "Rapid execution speed, certified AWS Solutions Architect, established strong CI/CD automation pipelines.",
    createdAt: new Date("2026-11-14T09:15:00Z"),
  },
  {
    id: "app_04",
    companyId: "comp_onecorp_01",
    name: "Maya Patel",
    email: "maya.patel.code@gmail.com",
    roleApplied: "Backend Engineer",
    status: "NEW",
    resumeSummary: "3 years developing REST APIs and data processing jobs with Python FastAPI and PostgreSQL.",
    skills: "Python, FastAPI, Docker, PostgreSQL, Celery, Redis",
    experienceYears: 3,
    score: 84,
    matchReasons: "Solid foundational knowledge, great passion for AI engineering, strong team collaboration feedback.",
    createdAt: new Date("2026-11-16T16:20:00Z"),
  },
];

export const SEED_GITHUB_ISSUES: GithubIssue[] = [
  {
    id: "iss_01",
    companyId: "comp_onecorp_01",
    issueNumber: 1,
    title: "Fix document indexing pipeline latency and vector search timeout",
    body: "The document ingestion pipeline times out when indexing large markdown manuals. Needs chunking optimization and async background worker queue.",
    status: "OPEN",
    priority: "HIGH",
    assigneeId: "usr_swe_01",
    assigneeName: "Rohan Verma",
    githubUrl: "https://github.com/thecodephilic-guy/doc-assistant/issues/1",
    createdAt: new Date("2026-11-18T10:00:00Z"),
    updatedAt: new Date("2026-11-19T08:00:00Z"),
  },
  {
    id: "iss_02",
    companyId: "comp_onecorp_01",
    issueNumber: 2,
    title: "Implement rate-limiting middleware for auth and agent endpoints",
    body: "Add sliding window rate-limiting on /api/auth/login and /api/voice/interact to protect against request storms. Leverage Redis cluster counter.",
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    assigneeId: "usr_em_01",
    assigneeName: "Marcus Vance",
    githubUrl: "https://github.com/thecodephilic-guy/doc-assistant/issues/2",
    createdAt: new Date("2026-11-17T11:30:00Z"),
    updatedAt: new Date("2026-11-18T15:20:00Z"),
  },
  {
    id: "iss_03",
    companyId: "comp_onecorp_01",
    issueNumber: 3,
    title: "Neon PostgreSQL connection pooling spike optimization",
    body: "Database connection pool maxes out under concurrent voice agent SSE connections. Configure Neon serverless pooler timeouts and connection reuse.",
    status: "OPEN",
    priority: "URGENT",
    assigneeId: "usr_swe_01",
    assigneeName: "Rohan Verma",
    githubUrl: "https://github.com/thecodephilic-guy/doc-assistant/issues/3",
    createdAt: new Date("2026-11-19T06:00:00Z"),
    updatedAt: new Date("2026-11-19T06:00:00Z"),
  },
];

export const SEED_ISSUE_COMMENTS: IssueComment[] = [
  {
    id: "com_01",
    issueId: "iss_01",
    authorId: "usr_em_01",
    authorName: "Marcus Vance",
    commentBody: "Hey @thecodephilic-guy, indexing retries are dropping after 5000ms. Check the embedding worker and offload heavy vector calculations to background job.",
    isSyncedToGithub: true,
    createdAt: new Date("2026-11-18T11:00:00Z"),
  },
  {
    id: "com_02",
    issueId: "iss_01",
    authorId: "usr_swe_01",
    authorName: "Rohan Verma",
    commentBody: "Investigating now. Traced the bottleneck to synchronous parsing in the ingestion handler. PR is in progress.",
    isSyncedToGithub: true,
    createdAt: new Date("2026-11-18T14:30:00Z"),
  },
];

export const SEED_DAILY_SCHEDULES: DailySchedule[] = [
  {
    id: "sch_01",
    userId: "usr_hr_01",
    title: "Morning sync with Engineering Manager on Q4 headcount",
    timeSlot: "10:00 AM - 10:30 AM",
    isCompleted: true,
    date: "2026-11-19",
    createdAt: new Date("2026-11-19T08:00:00Z"),
  },
  {
    id: "sch_02",
    userId: "usr_hr_01",
    title: "Review Backend Engineer applicant pipeline (Target: Top 3 Shortlist)",
    timeSlot: "11:30 AM - 12:30 PM",
    isCompleted: false,
    date: "2026-11-19",
    createdAt: new Date("2026-11-19T08:00:00Z"),
  },
  {
    id: "sch_03",
    userId: "usr_hr_01",
    title: "Culture fit interview with Priya Nair (Senior Backend Candidate)",
    timeSlot: "02:00 PM - 03:00 PM",
    isCompleted: false,
    date: "2026-11-19",
    createdAt: new Date("2026-11-19T08:00:00Z"),
  },
  {
    id: "sch_04",
    userId: "usr_hr_01",
    title: "Send offer letter and welcome kit to new Frontend Engineer",
    timeSlot: "04:30 PM - 05:00 PM",
    isCompleted: false,
    date: "2026-11-19",
    createdAt: new Date("2026-11-19T08:00:00Z"),
  },
];

export const SEED_DOCUMENTS: CompanyDocument[] = [
  {
    id: "doc_01",
    companyId: "comp_onecorp_01",
    title: "Engineering Sprint Cadence & On-Call Guidelines",
    category: "Engineering Guideline",
    content: `
# One Corp Engineering Sprint Cadence & On-Call Guidelines
- **Sprint Cycle**: We operate in 2-week sprints starting every alternate Tuesday at 10:00 AM IST.
- **Standups**: Daily async standups in #eng-standups channel by 10:30 AM, or verbal standup submission via Employee Voice Assistant.
- **PR Review SLA**: P0/P1 issues must have PR reviews within 4 hours. Regular PRs have an 8-hour review turnaround.
- **On-Call Rotation**: 1 primary engineer and 1 secondary engineer per weekly cycle. PagerDuty alerts escalate after 5 minutes of no ack.
- **Deployment Freeze**: No production deployments after 4:00 PM on Fridays without explicit sign-off from Marcus Vance (EM) or Sohail Ansari (Founder).
    `.trim(),
    createdAt: new Date("2026-01-01T00:00:00Z"),
  },
  {
    id: "doc_02",
    companyId: "comp_onecorp_01",
    title: "Comprehensive Leave, Wellness & Remote Work Policy",
    category: "HR Policy",
    content: `
# One Corp Comprehensive Leave & Remote Work Policy
- **Paid Time Off (PTO)**: 24 days annual paid time off per calendar year, accrued monthly.
- **Sick & Wellness Leave**: Unlimited sick leave with no medical certificate required for up to 3 consecutive days.
- **Remote Work Setup**: $2,500 initial home office stipend upon joining (monitor, ergonomic chair, desk). Monthly $100 internet/co-working allowance.
- **Flexi-Fridays**: Deep focus work on Fridays with zero scheduled internal meetings.
- **Parental Leave**: 16 weeks fully paid parental leave for primary caregivers, 6 weeks for secondary caregivers.
    `.trim(),
    createdAt: new Date("2026-01-01T00:00:00Z"),
  },
  {
    id: "doc_03",
    companyId: "comp_onecorp_01",
    title: "Travel & Expense Reimbursement Policy",
    category: "Benefits",
    content: `
# One Corp Travel & Expense Reimbursement Policy
- **Daily Meal Allowance**: Up to $80/day per diem during approved company business travel.
- **Team Social Dinners**: $50 per person per month for team connection dinners and bonding.
- **Learning & Conference Budget**: $1,500 per year per employee for technical conferences, certifications, and educational books.
- **Submission Process**: Submit expense receipts within 30 days of transaction via finance portal or tell the Employee Voice Assistant "File reimbursement for [amount]".
    `.trim(),
    createdAt: new Date("2026-01-01T00:00:00Z"),
  },
  {
    id: "doc_04",
    companyId: "comp_onecorp_01",
    title: "GitHub Repository Standards & Architecture Protocol",
    category: "Engineering Guideline",
    content: `
# One Corp GitHub Repository Standards & Architecture Protocol
- **Primary Repository**: thecodephilic-guy/doc-assistant
- **Branch Naming**: Use format \`feature/<ticket-number>-short-description\` or \`fix/<ticket-number>-short-description\`.
- **Commit Messages**: Conventional commits format: \`feat:\`, \`fix:\`, \`chore:\`, \`docs:\`, \`refactor:\`.
- **Database Migrations**: All schema updates must use Drizzle ORM migrations, reviewed by backend leads before merging.
- **Microservices Architecture**: Communication between services happens via gRPC internally or asynchronous events. Neon PostgreSQL connection pooling must be maintained using connection limit settings.
    `.trim(),
    createdAt: new Date("2026-01-01T00:00:00Z"),
  },
];
