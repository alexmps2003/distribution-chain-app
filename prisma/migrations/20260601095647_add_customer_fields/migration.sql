-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "contactPerson" TEXT,
ADD COLUMN     "creditLimit" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_code_key" ON "Customer"("code");
