CREATE TABLE "Collection" (
	"id" text PRIMARY KEY NOT NULL,
	"collectorId" text NOT NULL,
	"customerId" text NOT NULL,
	"collectionDate" timestamp NOT NULL,
	"status" text NOT NULL,
	"createdAt" timestamp NOT NULL
);
