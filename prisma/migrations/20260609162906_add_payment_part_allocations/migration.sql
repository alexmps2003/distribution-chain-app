-- AlterTable
ALTER TABLE "PaymentAllocation" ADD COLUMN     "paymentPartId" TEXT;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentPartId_fkey" FOREIGN KEY ("paymentPartId") REFERENCES "PaymentPart"("id") ON DELETE SET NULL ON UPDATE CASCADE;
