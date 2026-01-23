-- Add persistent display id for tickets
ALTER TABLE "Ticket" ADD COLUMN "displayId" TEXT;

CREATE UNIQUE INDEX "Ticket_displayId_key" ON "Ticket"("displayId");
