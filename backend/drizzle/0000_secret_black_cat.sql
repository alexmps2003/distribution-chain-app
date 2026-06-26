CREATE TYPE "public"."InvoiceStatus" AS ENUM('UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."PaymentMethod" AS ENUM('CASH', 'CHEQUE', 'BANK_TRANSFER', 'CARD');--> statement-breakpoint
CREATE TYPE "public"."PaymentStatus" AS ENUM('ACTIVE', 'REVERSED');--> statement-breakpoint
CREATE TABLE "Customer" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"contactPerson" text,
	"ownerName" text,
	"phone" text,
	"whatsappNumber" text,
	"email" text,
	"address" text,
	"area" text,
	"routeName" text,
	"assignedSalesRep" text,
	"assignedCollector" text,
	"creditLimit" numeric(12, 2) NOT NULL,
	"openingOutstanding" numeric(12, 2) NOT NULL,
	"paymentTermsDays" integer NOT NULL,
	"isActive" boolean NOT NULL,
	"createdAt" timestamp NOT NULL,
	CONSTRAINT "Customer_code_unique" UNIQUE("code")
);
