-- DropForeignKey
ALTER TABLE "TicketFollower" DROP CONSTRAINT "TicketFollower_ticketId_fkey";

-- DropForeignKey
ALTER TABLE "TicketFollower" DROP CONSTRAINT "TicketFollower_userId_fkey";

-- AddForeignKey
ALTER TABLE "TicketFollower" ADD CONSTRAINT "TicketFollower_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketFollower" ADD CONSTRAINT "TicketFollower_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
