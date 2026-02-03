-- Ensure Owner user exists (for environments that ran migrations but not the full seed)
-- Uses a fixed UUID to avoid requiring pgcrypto / gen_random_uuid()
INSERT INTO "User" (id, email, "displayName", department, location, role, "createdAt", "updatedAt")
SELECT 'a0000001-0001-4001-8001-000000000001'::uuid, 'owner@company.com', 'Owner', null, 'Remote', 'OWNER', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "User" WHERE email = 'owner@company.com');
