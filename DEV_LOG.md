# Development Log

- Next.js app created.
- PostgreSQL + Prisma configured.
- Customer management completed: list, create, details, edit.
- Git workflow uses dev and feature branches.
- Invoice schema has status and dates.
- Invoice UI was removed and should be rebuilt following DESIGN.md.



Implemented undo cheque reversal functionality.
Reversed cheques can now be restored to ACTIVE status, automatically recalculating invoice payment statuses and outstanding balances.