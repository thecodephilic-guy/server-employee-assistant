# Role-Based Access Control (RBAC) & Tool Registry

## Architecture
In a high-security enterprise environment, an AI assistant must never allow unauthorized tool execution. The workplace assistant implements **Strict Role-Based Tool Access (RBAC)** across four explicit employee roles:

1. **Admin (Founder)**
2. **HR Manager (HR)**
3. **Engineering Manager (EM)**
4. **Software Engineer (SWE)**

## Tool Manifest by Role

| Tool Name | Allowed Roles | Description | Confirmation Required? |
|---|---|---|---|
| `send_email` | Admin, HR, EM, SWE | Sends real email via Resend / Nodemailer | Yes |
| `query_company_knowledge` | Admin, HR, EM, SWE | LangChain RAG over company policies & guides | No |
| `get_my_profile` | Admin, HR, EM, SWE | Returns employee information & permissions | No |
| `update_onboarding_form` | Admin | Real-time voice form updates for new workspace | No |
| `finalize_workspace` | Admin | Creates workspace and founder user | Yes |
| `provision_employee` | Admin | Creates employee, sets password, sends credentials | Yes |
| `get_company_pulse` | Admin | Headcount, open issues, active applicants | No |
| `get_daily_schedule` | HR | Greets HR & loads interactive daily checklist | No |
| `toggle_schedule_task` | HR | Checks/unchecks schedule checklist items | No |
| `shortlist_candidates` | HR | Queries job applicants, ranks top 3, emails invites | Yes |
| `get_team_repo_visibility` | EM, Admin | Lists open issues, assignees, priorities | No |
| `assign_github_task` | EM | Creates GitHub issue via REST API, assigns, emails | Yes |
| `get_assigned_work_and_briefing` | SWE | Fetches assigned issues and summarizes comments | No |
| `post_issue_update_and_standup` | SWE | Comments on issue & emails standup to manager | Yes |

## Dual-Layer Enforcement
1. **Manifest Filter**: When a voice session starts, only tools matching `user.role` are registered in the LLM tool schema. A Software Engineer literally cannot receive HR or Admin tools in their function calling manifest.
2. **Execution Boundary**: `executeToolWithRBAC()` verifies the role at the backend barrier before invoking any business logic. If an unauthorized tool invocation is attempted, it immediately rejects the call, throws an RBAC permission error, and records a security audit log in the database.
