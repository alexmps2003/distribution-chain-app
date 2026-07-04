CREATE TABLE "Invoice" (
	"id" text PRIMARY KEY NOT NULL,
	"invoiceNumber" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"invoiceDate" timestamp NOT NULL,
	"dueDate" timestamp,
	"status" "InvoiceStatus" DEFAULT 'UNPAID' NOT NULL,
	"customerId" text NOT NULL,
	"createdAt" timestamp NOT NULL,
	CONSTRAINT "Invoice_invoiceNumber_unique" UNIQUE("invoiceNumber")
);
