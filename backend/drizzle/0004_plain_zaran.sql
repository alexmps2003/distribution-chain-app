CREATE TYPE "public"."UserRole" AS ENUM('ADMIN', 'SALES_REP', 'COLLECTOR');--> statement-breakpoint
CREATE TABLE "User" (
	"id" text PRIMARY KEY NOT NULL,
	"supabaseUserId" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "UserRole" NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "User_supabaseUserId_unique" UNIQUE("supabaseUserId"),
	CONSTRAINT "User_email_unique" UNIQUE("email")
);
