# Development Log

- Next.js app created.
- PostgreSQL + Prisma configured.
- Customer management completed: list, create, details, edit.
- Git workflow uses dev and feature branches.
- Invoice schema has status and dates.
- Invoice UI was removed and should be rebuilt following DESIGN.md.



Implemented undo cheque reversal functionality.
Reversed cheques can now be restored to ACTIVE status, automatically recalculating invoice payment statuses and outstanding balances.
# Development Log

## Initial Project

- Next.js application created.
- PostgreSQL + Prisma configured.
- Customer management completed (list, create, details, edit).
- Git workflow established using `dev` and feature branches.
- Invoice schema introduced with statuses and due dates.

## Backend Rebuild

- NestJS backend created under `backend/`.
- Drizzle ORM adopted for the backend.
- Business logic migrated from the frontend into backend services.
- Cheque reversal corrected to operate at the `PaymentPart` level.
- Undo cheque reversal implemented.

## Frontend Integration (Phase 4)

- Dashboard migrated to backend APIs.
- Search migrated to backend APIs.
- Customer, invoice, payment, cheque, statement, aging, and outstanding pages migrated to backend APIs.
- Payment creation migrated from frontend Prisma transactions to `POST /api/payments`.
- Frontend payment validation no longer depends on `Prisma.Decimal`.

## Backend Cleanup (Phase 5)

- Outstanding CSV export moved entirely to the backend.
- Next.js export route converted into a thin backend proxy.
- Shared API request helper refactored.
- Unused frontend Prisma helper files removed.
- Root frontend lint/build separated cleanly from backend lint/build.

## Current Status

- Active application business logic now lives in the NestJS backend.
- Frontend communicates with the backend through API calls instead of direct Prisma access.
- Next planned phase: authentication and route protection.