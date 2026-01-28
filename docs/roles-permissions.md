# Roles & Permissions (Sprint 1 Baseline)

This document defines the baseline access model for the ticketing system.

## Roles
- **EMPLOYEE (Requester)**
- **AGENT**
- **LEAD**
- **ADMIN**

## Core Rules
- Requesters can only view and reply to their own tickets.
- Agents can view tickets in their team scope and update status/assignment.
- Leads can view and manage all tickets in their team; can reassign and transfer.
- Admins have full access across teams and configuration modules.
- Cross-team read-only access can be granted via TicketAccess records.

## Permissions Matrix (Baseline)

### Requester (Employee)
- Create ticket
- View own tickets
- Add public reply to own tickets
- Cannot assign, transfer, or change status

### Agent
- View team tickets (assigned + unassigned)
- Assign to self or other team member (per policy)
- Transition status (except restricted transitions)
- Add public replies + internal notes
- Transfer to another team (if policy allows)

### Lead
- All Agent permissions
- Assign across team, override queue ownership
- Approve transfer and manage escalations
- View team metrics

### Admin
- All Lead permissions
- Manage teams, memberships, categories, routing rules
- Configure SLAs and notification settings
- View global reports and audit logs

## Notes
- Team membership is the primary access boundary.
- Transfers should create a read-only access grant for the prior team.
- All role changes should be audited.

