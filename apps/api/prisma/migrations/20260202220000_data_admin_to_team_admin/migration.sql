-- Data: migrate existing ADMIN users to TEAM_ADMIN and set primaryTeamId from first team membership
UPDATE "User" u
SET role = 'TEAM_ADMIN',
    "primaryTeamId" = COALESCE(
      (SELECT tm."teamId" FROM "TeamMember" tm WHERE tm."userId" = u.id LIMIT 1),
      u."primaryTeamId"
    )
WHERE u.role = 'ADMIN';
