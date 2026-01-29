IT Ticketing System - Sprint Plan (from IT.pdf v1.1, Dec 22, 2025)

Purpose
- Capture the delivery plan and sprint scope from IT.pdf so we can track where we are and what is next.

Project Objectives (from IT.pdf)
- Single place to request help and track progress.
- Correct routing to teams quickly and consistently.
- Meet first response + resolution SLAs with automatic escalation.
- Operational visibility via dashboards, backlog aging, trends.
- Reliable notifications and full audit trail.

Phase 1 Scope (in-scope)
- Requester portal: create ticket, view status, replies, attachments.
- Email intake: create/append tickets from inbound emails.
- Agent console: triage, assign, internal notes, resolve/close.
- Team-based routing and assignment (rules + round-robin).
- SLA: first response + resolution timers with pause rules.
- Notifications: email; optional Teams/Slack later.
- Reporting: backlog + SLA compliance + basic metrics.
- Audit trail: immutable ticket events and access logs.

Out of Scope (initially)
- CMDB/asset management.
- Voice/SMS omnichannel.
- Multi-tenant SaaS model.
- Full ITIL change/problem modules.

Status Reference
- Sprint 1-3 completed (foundation, core ticketing, routing + attachments + audit).
- Sprint 4 is next.

Sprint Roadmap (12 weeks, 2-week sprints)
Sprint 1 (Weeks 1-2): Discovery and Foundations
- Requirements, workflows, roles, categories, SLAs.
- Repo/CI/CD/envs, auth (SSO), DB migrations.
- Ticket + Message core schema and basic API skeleton.
Exit criteria: Signed scope + backlog + architecture.

Sprint 2 (Weeks 3-4): Ticketing Core + Agent Console
- Ticket creation (portal) + list/detail.
- Agent backlog, assignment, status transitions.
- Internal notes vs public replies; watchers.
- Outbox + queue wiring; basic outbound email.
Exit criteria: Create/assign/reply/resolve works end-to-end.

Sprint 3 (Weeks 5-6): Routing + Attachments + Audit
- Routing rules engine (team routing + assignment strategies).
- Attachment upload/download + malware scanning integration.
- TicketEvent audit stream for state changes.
- Basic admin: teams, membership, categories, routing rules CRUD.
Exit criteria: Routing + attachments + audit flows working.

Sprint 4 (Weeks 7-8): Email Inbound + SLA Engine (NEXT)
Core deliverables
- Inbound email parsing + ticket threading tokens. (Deferred to Sprint 5)
- SLA policy model + per-ticket SLA instance creation/updates.
- Breach detection worker + escalation actions.
- Edge cases: reopen on reply, waiting statuses, transfer effects.
Acceptance criteria
- Inbound email creates/threads correctly (incl. attachments).
- SLA timers start/pause/resume per status rules.
- Breach events trigger defined escalations (notify lead, on-call, priority bump).
- Reopen-on-reply behavior matches configuration.

Sprint 5 (Weeks 9-10): Reporting + Performance Hardening
- Dashboards (backlog aging, SLA compliance, volume trends).
- DB index tuning + caching for ticket list endpoints.
- Rate limiting, idempotency keys, concurrency control.
- Security review: access checks, audit coverage, retention plan draft.
- Inbound email intake (parsing + threading + attachments).

Sprint 6 (Weeks 11-12): UAT, Rollout, Stabilization
- UAT per team, bug fixes.
- Training + admin handbook + runbooks.
- Prod cutover plan + monitoring alerts.
- 30-day stabilization with weekly metrics review.
- Teams message intake (create tickets from Teams messages).

Key Functional Requirements to Validate During Sprints
- Ticket lifecycle statuses: New, Triaged, Assigned, In Progress, Waiting on Requester,
  Waiting on Vendor, Resolved, Closed, Reopened (configurable).
- Routing: rules by category/keyword/department/location/VIP.
- Assignment strategies: queue-only, round-robin, skill-based, on-call.
- SLA: first response + resolution timers with pause on waiting statuses.
- Notifications: requester + assignee/team on key events.
- Attachments: secure upload, scan, permission-checked downloads.
- Audit trail: immutable TicketEvents + admin change logs.

Non-Functional Targets (reference)
- Ticket list p95 <= 400ms with pagination + indexed filters.
- Ticket detail p95 <= 300ms (excluding large attachments).
- Email ingestion to ticket update <= 2 minutes for 99% of messages.
- Reliability via outbox + retries + DLQ.

Testing Guidance (from IT.pdf)
- Unit: workflow transitions, routing rules, SLA calculations.
- Integration: email ingestion, notifications, attachment scanning.
- Load: list filtering, message posting, burst notifications.
- Security: auth matrix, audit completeness, OWASP checks.
- UAT: scenario scripts per team.

Risks to Track (selection)
- Routing rules mis-route tickets -> log rule decisions, tune weekly with leads.
- SLA timers incorrect due to business hours/holidays -> centralized calendar logic + UAT.
- Email threading failures -> tokenized reply-to + fallback subject parsing.
- Reporting load on DB -> read replicas/aggregates, off-peak jobs.
- Permission bugs expose internal notes -> strict visibility + automated tests.

Architecture Notes (context)
- Modular monolith: Ticket, Messaging, Routing, SLA, Notification, Admin.
- Async backbone: queue/event bus + transactional outbox publisher.
- Data stores: Postgres + Redis + object storage; search optional later.

Next Steps
- Start Sprint 4 workstream: inbound email + SLA engine.
- Define SLA policy schema, SLA instance model, and breach worker behavior.
- Decide email provider flow (inbound webhook + outbound SMTP/API).
