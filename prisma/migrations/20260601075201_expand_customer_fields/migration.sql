-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "area" TEXT,
ADD COLUMN     "assignedCollector" TEXT,
ADD COLUMN     "assignedSalesRep" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "openingOutstanding" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "ownerName" TEXT,
ADD COLUMN     "paymentTermsDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "routeName" TEXT,
ADD COLUMN     "whatsappNumber" TEXT;
