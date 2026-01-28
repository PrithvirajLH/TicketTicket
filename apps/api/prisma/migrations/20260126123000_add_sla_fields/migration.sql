-- Add SLA tracking fields
ALTER TABLE "Ticket"
ADD COLUMN "firstResponseDueAt" TIMESTAMP(3),
ADD COLUMN "firstResponseAt" TIMESTAMP(3),
ADD COLUMN "slaPausedAt" TIMESTAMP(3);
