# Sprint Status

Status derived from IT.pdf (Sprint Plan) and current codebase. Updated: 2026-01-26.

Legend: ✅ complete · 🟡 partial · ❌ pending

## Sprint 1 (Weeks 1–2) — Discovery and Foundations
- 🟡 Finalize requirements, categories, priority definitions, and SLAs per team.
  - Notes: Requirements baseline exists; categories CRUD exists; SLA policies exist but final thresholds still TBD per docs.
- ✅ Define workflows and permissions; draft UI wireframes.
  - Notes: Roles/permissions + wireframes docs exist; access rules implemented.
- 🟡 Set up repo, CI/CD, environments, auth (SSO), database migrations.
  - Notes: Repo + migrations done; CI/CD not present; SSO not implemented (demo header auth).
- ✅ Implement Ticket + Message core schema and basic API skeleton.

## Sprint 2 (Weeks 3–4) — Ticketing Core + Agent Console
- ✅ Ticket creation (portal) and ticket list/detail views.
- ✅ Agent console backlog, assignment, status transitions.
- ✅ Internal notes vs public replies; watchers.
  - Notes: Internal notes, public replies, and followers implemented.
- ❌ Outbox + queue wiring; email outbound notifications (basic).

## Sprint 3 (Weeks 5–6) — Routing + Attachments + Audit
- ✅ Routing rules engine (team routing + assignment strategies).
  - Notes: Keyword routing + round‑robin auto‑assignment implemented; skill/on‑call strategies still pending.
- 🟡 Attachments upload/download with malware scanning integration.
  - Notes: Upload/download implemented with scan status placeholder (no real AV integration yet).
- ✅ TicketEvent audit stream for ticket state changes (status, assignment, transfer, messages, attachments).
- ✅ Basic admin: teams, membership, categories, routing rules CRUD (API complete; UI for team settings still minimal).
