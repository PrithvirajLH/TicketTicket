-- DropForeignKey
ALTER TABLE "SlaInstance" DROP CONSTRAINT "SlaInstance_ticketId_fkey";

-- AlterTable
ALTER TABLE "SlaInstance" ADD COLUMN     "firstResponseAtRiskNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "resolutionAtRiskNotifiedAt" TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "SlaInstance" ADD CONSTRAINT "SlaInstance_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
