CREATE TABLE "PaymentAllocation" (
	"id" text PRIMARY KEY NOT NULL,
	"paymentId" text NOT NULL,
	"invoiceId" text NOT NULL,
	"paymentPartId" text,
	"amount" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "PaymentPart" (
	"id" text PRIMARY KEY NOT NULL,
	"paymentId" text NOT NULL,
	"method" "PaymentMethod" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"status" "PaymentStatus" DEFAULT 'ACTIVE',
	"chequeNumber" text,
	"chequeBank" text,
	"chequeDate" timestamp,
	"bankReference" text,
	"cardReference" text
);
--> statement-breakpoint
CREATE TABLE "Payment" (
	"id" text PRIMARY KEY NOT NULL,
	"customerId" text NOT NULL,
	"paymentDate" timestamp NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"paymentMethod" text NOT NULL,
	"notes" text,
	"createdAt" timestamp NOT NULL
);
