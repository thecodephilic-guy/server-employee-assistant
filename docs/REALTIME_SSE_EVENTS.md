# Real-time Reactive Dashboard with Server-Sent Events (SSE)

## Overview
Every voice interaction and tool execution in the workplace assistant emits real-time events over an HTTP Server-Sent Events (SSE) stream (`/api/events`). The Next.js dashboard subscribes to this stream, allowing judges and employees to watch cards, forms, and badges react in real-time as words are spoken.

## Event Specifications

| Event Name | Trigger | Payload Contents | Client UI Response |
|---|---|---|---|
| `FORM_FIELD_UPDATED` | Founder speaks company details | `{ fields: { companyName, founderName... } }` | Live inputs fill on the onboarding form |
| `TOOL_CALL_STARTED` | Assistant begins executing an action | `{ toolName, status }` | Voice Orb pulses, action indicator appears |
| `TOOL_CONFIRMATION_REQUESTED` | Critical tool requires confirmation | `{ toolName, args, prompt }` | Confirmation dialog/banner renders with action buttons |
| `TOOL_CALL_COMPLETED` | Tool completes execution | `{ toolName, result }` | Success celebration, data refreshed |
| `CANDIDATES_SHORTLISTED_LIVE` | HR asks for top 3 candidates | `{ role, candidates, count }` | Top 3 candidate cards appear with scores & tags |
| `ISSUE_CREATED` | EM creates a GitHub task | `{ issue, repo }` | Issue board updates live with new ticket |
| `EMAIL_DISPATCHED` | Email sent via Resend/Nodemailer | `{ to, subject, snippet, provider }` | Toast notification pops up in top-right corner |
| `SCHEDULE_UPDATED` | HR toggles a checklist task | `{ task }` | Daily checklist item toggles visually |
| `DASHBOARD_REFRESH` | General data modification | `{ source }` | Background refetch of dashboard summary |
