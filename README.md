# Unified Ticketing System

Enterprise ticketing platform for multi-department operations (IT, HR, AI, Medicaid Pending, White Gloves). This repo ships a NestJS API and a modern React UI that can scale into a production-grade workflow.

## Stack
- API: NestJS + Prisma + Postgres
- Web: React (Vite) + TypeScript
- Infra: Docker (Postgres + Redis)

## Quick start
1) Install dependencies
```
npm install
```

2) Start local infrastructure
```
docker compose up -d
```

3) Configure API environment
```
copy apps\api\.env.example apps\api\.env
```
If you’re using Supabase, update `DATABASE_URL` and `DIRECT_URL` in `apps\api\.env` with your project connection strings.

Optional: configure the web app API base URL
```
copy apps\web\.env.example apps\web\.env
```
Edit `apps\web\.env` to set `VITE_DEMO_USER_EMAIL` to a seeded user if you want the UI to hit the API directly.

4) Create schema + seed sample data
```
npm run db:migrate -w apps/api
npm run db:seed -w apps/api
```

5) Run the full stack
```
npm run dev
```

- API: http://localhost:3000/api
- API health: http://localhost:3000/api/health
- Web: http://localhost:5173

## Tests
If you want to use local Docker for tests:
```
npm run test:db:up
```

Reset and seed the test database, then run integration tests:
```
npm test
```

Test DB config lives in `apps\api\.env.test`. Update it to your Supabase test database connection string (use a dedicated test project).

## Auth headers (temporary)
Until Azure AD is wired in, the API expects one of these headers on protected routes:
- `x-user-id: <user-id>`
- `x-user-email: <user-email>`

Seeded users (from `apps/api/prisma/seed.ts`) include:
- `jane.doe@company.com` (Employee)
- `alex.park@company.com` (Agent)
- `maria.chen@company.com` (Lead)
- `sam.rivera@company.com` (Admin)

## Next steps
- Wire Azure AD (Entra ID) SSO
- Add Microsoft 365 inbound email ingestion
- Implement SLA engine + routing rules UI
- Add audit log viewer + compliance retention policies
