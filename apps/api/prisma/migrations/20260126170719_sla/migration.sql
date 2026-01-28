-- DropForeignKey
ALTER TABLE "SlaPolicy" DROP CONSTRAINT "SlaPolicy_teamId_fkey";

-- AlterTable
ALTER TABLE "SlaPolicy" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "SlaPolicy" ADD CONSTRAINT "SlaPolicy_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
