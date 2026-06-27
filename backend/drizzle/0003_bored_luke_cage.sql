ALTER TABLE "Customer" ALTER COLUMN "creditLimit" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "Customer" ALTER COLUMN "openingOutstanding" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "Customer" ALTER COLUMN "paymentTermsDays" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "Customer" ALTER COLUMN "isActive" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "Customer" ALTER COLUMN "createdAt" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "Invoice" ALTER COLUMN "createdAt" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "PaymentPart" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "Payment" ALTER COLUMN "paymentDate" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "Payment" ALTER COLUMN "createdAt" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "PaymentPart" ADD COLUMN "reversedAt" timestamp;--> statement-breakpoint
ALTER TABLE "PaymentPart" ADD COLUMN "reversalReason" text;--> statement-breakpoint
ALTER TABLE "PaymentPart" ADD COLUMN "createdAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "Payment" ADD COLUMN "status" "PaymentStatus" DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "Payment" ADD COLUMN "reversedAt" timestamp;--> statement-breakpoint
ALTER TABLE "Payment" ADD COLUMN "reversalReason" text;