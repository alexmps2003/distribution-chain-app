# Project Context

This document describes what the existing web app does today, based on the
current Prisma schema and application code. It is intended to keep future
backend rebuild work aligned with the real product behavior.

## 1. App Purpose

This is a distribution chain management app for a business that sells to shops
or customers, issues invoices, records customer payments, tracks cheque
collections, and monitors outstanding balances.

The business context is cash collection in a Sri Lankan distribution workflow:

- Customers are shops or outlets with routes, areas, sales reps, and collectors.
- Invoices create customer debt.
- Payments reduce customer debt by allocating money to specific invoices.
- One payment can be made with multiple payment methods, such as cash plus a
  cheque.
- Cheques are tracked separately because they can later be reversed, such as
  when a cheque bounces.
- Owners need quick reports showing who owes money, how old the balances are,
  what has been collected, and which cheques are active or reversed.

The root dashboard is the operational landing page. It links to Customers,
Invoices, Payments, Cheques, Outstanding, Aging, and creation flows.

## 2. Source Of Truth

`prisma/schema.prisma` is the current data-model source of truth.

The backend Drizzle schema should mirror Prisma unless a future request
explicitly changes the Prisma model first or explicitly authorizes a schema
change.

Important rebuild rule:

- Do not invent backend tables from product guesses.
- If a table does not exist in Prisma, it should not be added to Drizzle.
- `Collection` was previously created by mistake. There is no `Collection`
  model in Prisma, so there should be no Collections feature unless Prisma is
  intentionally changed first.

## 3. Data Model

### Customer

Business meaning:

Customer represents a shop, outlet, or account that receives invoices and makes
payments.

Important fields:

- `id`: primary key.
- `code`: unique customer code.
- `name`: customer or shop name.
- `contactPerson`, `ownerName`: contact identity fields.
- `phone`, `whatsappNumber`, `email`, `address`: communication and address
  fields.
- `area`, `routeName`: route planning and reporting dimensions.
- `assignedSalesRep`, `assignedCollector`: operational ownership fields.
- `creditLimit`: decimal credit limit, default zero.
- `openingOutstanding`: decimal field still present in Prisma, but the current
  UI/business logic behaves as if it does not exist.
- `paymentTermsDays`: default zero.
- `isActive`: active/inactive flag, default true.
- `createdAt`: creation timestamp.

Relationships:

- `Customer.invoices` has many `Invoice`.
- `Customer.payments` has many `Payment`.

Current UI behavior:

- Customer creation and editing use Zod validation.
- Customer list filters by name/code, area, route, and outstanding-only.
- Customer balances are calculated from invoices minus active payment
  allocations.
- Opening outstanding is not shown or included in current customer balance
  calculations.

### Invoice

Business meaning:

Invoice represents customer debt. Payments are allocated to invoices. Invoice
status is recalculated from payment allocations in many parts of the app.

Important fields:

- `id`: primary key.
- `invoiceNumber`: unique invoice number.
- `amount`: invoice total as decimal.
- `invoiceDate`: invoice date.
- `dueDate`: nullable due date.
- `status`: `InvoiceStatus`, default `UNPAID`.
- `customerId`: owning customer.
- `createdAt`: creation timestamp.

Relationships:

- `Invoice.customer` belongs to `Customer`.
- `Invoice.payments` has many `PaymentAllocation`.

Statuses:

- `UNPAID`
- `PARTIALLY_PAID`
- `PAID`
- `OVERDUE`
- `CANCELLED`

Current UI behavior:

- New invoices can be created for active customers.
- There is no invoice edit page in the current app.
- Invoice list is customer-first: `/invoices` shows customer summaries, and
  `/invoices?customerId=...` shows that customer's invoices.
- Invoice status displayed in list/detail pages is recalculated from active
  payment allocations, not blindly trusted from the stored status field.

### Payment

Business meaning:

Payment is a customer receipt. It may be a single-method payment or a mixed
payment made of multiple parts.

Important fields:

- `id`: primary key.
- `amount`: total payment amount.
- `paymentDate`: payment date, default now.
- `notes`: optional notes.
- `status`: `PaymentStatus`, default `ACTIVE`.
- `reversedAt`: nullable timestamp.
- `reversalReason`: nullable reason.
- `paymentMethod`: string. The app stores a single method name when only one
  part exists, otherwise stores `MIXED`.
- `customerId`: paying customer.
- `createdAt`: creation timestamp.

Relationships:

- `Payment.customer` belongs to `Customer`.
- `Payment.allocations` has many `PaymentAllocation`.
- `Payment.parts` has many `PaymentPart`.

Current UI behavior:

- Payment creation writes `Payment`, `PaymentPart`, and `PaymentAllocation`
  inside `prisma.$transaction`.
- Payment details page is the receipt page.
- Receipt number is derived in the UI as `PAY-YYYYMMDD-XXXX`, where `XXXX` is
  the last four characters of the payment id, unless a future `paymentNumber`
  field exists in the runtime object.
- Payment details maps stored `ACTIVE` status to display text `COMPLETED`.
- The web app has cheque reversal UI, but no general whole-payment reversal UI.

### PaymentPart

Business meaning:

PaymentPart is one method component of a payment. This is the key model for
cheque handling and cheque reversal.

Important fields:

- `id`: primary key.
- `paymentId`: parent payment.
- `method`: `PaymentMethod`.
- `amount`: amount paid by this method.
- `status`: `PaymentStatus`, default `ACTIVE`.
- `chequeNumber`, `chequeBank`, `chequeDate`: cheque metadata.
- `bankReference`: bank transfer reference.
- `cardReference`: card reference.
- `reversedAt`: nullable timestamp.
- `reversalReason`: nullable reason.
- `createdAt`: creation timestamp.

Relationships:

- `PaymentPart.payment` belongs to `Payment`.
- `PaymentPart.allocations` has many `PaymentAllocation`.

Methods:

- `CASH`
- `CHEQUE`
- `BANK_TRANSFER`
- `CARD`

Statuses:

- `ACTIVE`
- `REVERSED`

Current UI behavior:

- Each added payment method becomes one `PaymentPart`.
- Every method has its own invoice allocations.
- Cheques are `PaymentPart` records where `method = CHEQUE`.
- Cheque reversal changes the `PaymentPart.status`, not the whole payment.

### PaymentAllocation

Business meaning:

PaymentAllocation links payment money to a specific invoice. It records how
much of a payment, and now specifically how much of a payment part, paid an
invoice.

Important fields:

- `id`: primary key.
- `paymentId`: parent payment.
- `invoiceId`: invoice being paid.
- `paymentPartId`: nullable payment part. Nullable preserves older/legacy
  allocations that were not linked to a part.
- `amount`: allocated amount.

Relationships:

- `PaymentAllocation.payment` belongs to `Payment`.
- `PaymentAllocation.invoice` belongs to `Invoice`.
- `PaymentAllocation.paymentPart` optionally belongs to `PaymentPart`.

Business note:

Outstanding and paid calculations count allocations where:

- `paymentPart` is null, or
- `paymentPart.status === "ACTIVE"`.

Allocations linked to reversed parts stay in the database for audit history but
do not reduce outstanding balances.

## 4. Core Workflows

### Customer Creation And Editing

Routes:

- `/customers`
- `/customers/new`
- `/customers/[id]`
- `/customers/[id]/edit`
- `/customers/[id]/statement`

Creation:

- Uses a server action in `app/customers/new/page.tsx`.
- Parses form data through `parseCustomerFormData`.
- Requires `code` and `name`.
- Phone and WhatsApp are optional but, if provided, must look like Sri Lankan
  numbers.
- Email is optional but must be valid when present.
- Credit limit and payment terms must be zero or positive.
- Creates a Prisma `Customer`.
- Redirects to `/customers` with a success toast.

Editing:

- Uses a server action in `app/customers/[id]/edit/page.tsx`.
- Loads the customer by id.
- Reuses customer validation.
- Updates profile, route, collector, credit, terms, and `isActive`.
- Redirects back to the customer detail page with a success toast.

Customer details:

- Shows profile information and financial summary.
- Financial summary is calculated as total invoice amount minus active paid
  amount.
- It does not include `openingOutstanding`.

### Invoice Creation And Navigation

Routes:

- `/invoices`
- `/invoices/new`
- `/invoices/[id]`

Creation:

- Uses a server action in `app/invoices/new/page.tsx`.
- Only active customers are selectable.
- Requires customer, invoice number, invoice date, and amount greater than zero.
- Due date is optional.
- Creates an invoice with `status: "UNPAID"`.
- Redirects to `/invoices` with a success toast.

Navigation:

- `/invoices` initially shows customers, not a flat invoice table.
- Customer rows link to `/invoices?customerId=<customerId>`.
- Customer invoice rows link to `/invoices/<invoiceId>?customerId=<customerId>`.
- Invoice details preserve contextual back navigation through `customerId` or
  `returnTo`.

Invoice status filters:

- Supports All, Paid, Partially Paid, Unpaid.
- URL params support both uppercase values and chart-friendly lowercase aliases:
  `paid`, `partial`, `unpaid`.

### Payment Creation

Routes:

- `/payments`
- `/payments/new`
- `/payments/[id]`

The payment creation page has a client UI plus a server action.

Client UI:

- User selects an active customer.
- App loads outstanding invoices for that customer.
- User selects invoices and enters overall invoice allocation amounts.
- User adds one or more payment methods:
  - Cash
  - Cheque
  - Bank Transfer
  - Card
- For each method, user enters method amount and per-invoice method
  allocations.
- Cheque method shows cheque number, bank dropdown, and cheque date.
- Bank transfer and card show reference number fields.
- The UI prevents adding a method if method amount does not equal that method's
  allocations.
- The final Save Payment button is enabled only when:
  - at least one method exists,
  - total overall invoice allocation is greater than zero,
  - added method total equals overall invoice allocation total,
  - per-invoice sum of method allocations equals the selected overall invoice
    allocation.

Server action:

- Parses form data through `parsePaymentFormData`.
- Validates with Zod:
  - customer required,
  - payment date required,
  - at least one method,
  - payment total greater than zero,
  - allocation amounts greater than zero,
  - each method amount equals its own method allocations,
  - cheque number, cheque bank, and cheque date are required for cheque methods.
- Additional server rules:
  - payment total must be greater than zero,
  - payment total must equal allocation total,
  - every method allocation invoice must match a selected invoice,
  - method allocations per invoice must equal the overall invoice allocation.
- Uses `prisma.$transaction`.
- Loads selected invoices for the selected customer.
- If the selected invoice count does not match loaded invoices, throws an error.
- Creates a `Payment`.
- Sets `paymentMethod` to the single method if only one method exists,
  otherwise `MIXED`.
- Creates one `PaymentPart` per method.
- Creates `PaymentAllocation` records linked to both `paymentId` and
  `paymentPartId`.
- Updates affected invoice statuses.

Important current-code nuance:

- The invoice allocation table displayed on `/payments/new` calculates
  outstanding from active allocations only, ignoring reversed payment parts.
- Inside the payment creation transaction, the outstanding validation currently
  sums `invoice.payments.map((payment) => payment.amount)` without filtering
  reversed payment parts. This may be an implementation inconsistency. Confirm
  before copying this behavior to a backend rebuild.

### Mixed Payment Methods

Mixed method behavior is central to the app.

Example:

- A customer can pay one receipt using cash plus cheque.
- The app creates one `Payment`.
- It creates one `PaymentPart` for cash and one `PaymentPart` for cheque.
- Each part has its own invoice allocations.
- Each `PaymentAllocation` stores:
  - `paymentId`
  - `invoiceId`
  - `amount`
  - `paymentPartId`

This per-part allocation is required so that reversing one cheque can remove
only that cheque's effect without reversing cash or other valid parts.

### Payment Allocation To Invoices

Payment allocations are the only mechanism that reduces invoice outstanding in
the app.

Calculation pattern used throughout the app:

```text
activePaidAmount =
  sum(PaymentAllocation.amount)
  where allocation.paymentPart is null
     or allocation.paymentPart.status == ACTIVE

outstanding = invoice.amount - activePaidAmount
```

Stored invoice status is updated by payment creation and cheque reversal flows,
but most report/detail views also recalculate display status from active
allocations.

### Cheque Handling

Routes:

- `/cheques`
- `/cheques/[id]`

What counts as a cheque:

- A cheque is a `PaymentPart` with `method = CHEQUE`.

Cheque list:

- Queries `prisma.paymentPart.findMany`.
- Filters `method: "CHEQUE"`.
- Supports search by cheque number.
- Supports exact bank filter using the shared Sri Lankan `BANK_OPTIONS` list.
- Supports status filter `ACTIVE` or `REVERSED`.
- Shows cheque number, bank, cheque date, amount, customer, payment date,
  status, receipt link, and detail link.

Cheque detail:

- Loads one `PaymentPart` by id.
- Requires `method === "CHEQUE"`, otherwise not found.
- Includes parent payment, customer, allocations, and allocation invoices.
- Shows original allocations even after reversal.

### Cheque Reversal And Bounced Cheque Flow

This is the critical financial correction flow.

Reverse cheque server action:

- Implemented in `app/cheques/[id]/page.tsx`.
- Inputs:
  - `chequeId`
  - `reversalReason`
- Validation:
  - cheque id required,
  - reversal reason required,
  - cheque exists,
  - `cheque.method === "CHEQUE"`,
  - `cheque.status === "ACTIVE"`.
- Uses `prisma.$transaction`.
- Updates only the cheque `PaymentPart`:
  - `status: "REVERSED"`
  - `reversedAt: new Date()`
  - `reversalReason`
- Does not delete allocations.
- Does not update the parent `Payment.status`.
- Does not reverse cash/card/bank transfer parts.
- Recalculates affected invoices from active allocations only.
- Redirects back to the cheque detail page with a success toast.

Undo cheque reversal:

- Also implemented in `app/cheques/[id]/page.tsx`.
- Only works for reversed cheque parts.
- Updates only the cheque `PaymentPart`:
  - `status: "ACTIVE"`
  - `reversedAt: null`
  - `reversalReason: null`
- Recalculates affected invoices from active allocations only.
- Redirects back to the cheque detail page with a success toast.

Invoice recalculation during cheque reversal/undo:

For each affected invoice:

```text
activeAllocations =
  PaymentAllocation where invoiceId = invoice.id and
  (
    paymentPartId is null
    or paymentPart.status == ACTIVE
  )

activePaidTotal = sum(activeAllocations.amount)

status =
  PAID if activePaidTotal >= invoice.amount
  PARTIALLY_PAID if activePaidTotal > 0
  UNPAID otherwise
```

Business interpretation:

- A bounced/reversed cheque does not erase the historical receipt or allocation
  rows.
- It changes the cheque part status so that allocation no longer counts toward
  paid/outstanding calculations.
- The customer debt increases again because active paid amount decreases.
- The original cheque allocations remain visible for audit.

Important backend rebuild note:

- The web app's cheque reversal mechanism is `PaymentPart` reversal.
- It is not whole-payment reversal.
- Parent `Payment.status` is not changed by the current cheque reversal UI.
- The backend should implement cheque reversal with dedicated cheque endpoints:
  - `PATCH /api/cheques/:id/reverse`
  - `PATCH /api/cheques/:id/undo-reversal`
- Do not use `PATCH /api/payments/:id/reverse` as the primary bounced-cheque
  workflow.

### Invoice Status Updates

Payment creation:

- After creating allocations, the app updates affected invoices.
- It computes paid total as previously allocated amount plus the current
  allocation amount.
- Status becomes:
  - `PAID` if paid total is greater than or equal to invoice amount,
  - `PARTIALLY_PAID` if paid total is greater than zero,
  - `UNPAID` otherwise.

Cheque reversal and undo:

- Recalculates from all active allocations for each affected invoice.
- Reversed payment parts are ignored.
- Legacy allocations with `paymentPartId = null` are counted.

Read/report pages:

- Customer, invoice, outstanding, aging, dashboard, and statement views usually
  compute display status from active allocation totals rather than relying only
  on the stored `Invoice.status`.

### Customer Statement

Route:

- `/customers/[id]/statement`

Behavior:

- Loads customer, invoices, payment allocations, payments, and payment parts.
- Builds a ledger sorted by date ascending.
- Invoice rows are debit entries.
- Active payment allocation rows are credit entries.
- Reversed cheque allocations are shown as `Reversed Cheque` rows for audit,
  but with no credit and no debit.
- Running balance increases with invoices and decreases with active payments.
- Summary cards:
  - Total Invoiced
  - Total Paid
  - Total Outstanding
  - Unpaid / Partial Invoices
- Includes print button.

### Outstanding Report

Routes:

- `/outstanding`
- `/outstanding?customerId=...`
- `/outstanding/export`

Shared helper:

- `lib/outstanding-report.ts`

Behavior:

- Fetches customers with invoices and payment allocations.
- Calculates paid amount from active allocations only.
- Calculates invoice outstanding as `invoice.amount - activePaidAmount`.
- Includes only invoices with outstanding greater than zero.
- Includes only customers whose total outstanding is greater than zero.
- Shows summary cards:
  - Customers With Outstanding
  - Total Outstanding
  - Overdue Invoices
  - Highest Outstanding Customer
- Customer detail view shows outstanding invoices for one customer.
- CSV export uses the same report helper to avoid duplicate business logic.

### Aging Report

Route:

- `/aging`

Behavior:

- Fetches invoices with customer and payment allocations.
- Calculates active paid amount from active allocations only.
- Includes only invoices with outstanding greater than zero.
- Buckets by due date:
  - Not Due
  - 0-30 days overdue
  - 31-60 days overdue
  - 61-90 days overdue
  - 90+ days overdue
  - No Due Date
- Summary cards:
  - Total Outstanding
  - Overdue Outstanding
  - 90+ Days Outstanding
  - Overdue Invoice Count
- Shows both customer-level bucket summary and invoice-level aging detail.

### Dashboard Calculations

Route:

- `/`

Dashboard KPI cards:

- Total Customers: `prisma.customer.count()`.
- Total Outstanding: total invoice amount minus active paid allocations.
- Active Cheques: count of `PaymentPart` where method is `CHEQUE` and status is
  `ACTIVE`.
- Reversed Cheques: count of `PaymentPart` where method is `CHEQUE` and status
  is `REVERSED`.
- Total Invoiced: sum of invoice amounts.
- Total Paid: sum of active payment allocations.

Business charts:

- Outstanding by Customer:
  - Uses invoices minus active paid amount.
  - Groups by customer.
  - Sorts by outstanding descending.
  - Filters by top limit, minimum outstanding, route, area, and customer active
    status.
  - Clicking a bar opens `/customers/<customerId>`.
- Invoice Status:
  - Filters invoices by invoice date range.
  - Status is calculated from active allocation totals.
  - Doughnut sections link to invoice filters.
- Monthly Collections:
  - Groups active payment allocations by payment date month.
  - Ignores reversed payment parts.
  - Clicking a month opens `/payments?month=YYYY-MM`.

Other dashboard sections:

- Quick action cards link to major modules and create flows.
- Recent Activity shows latest five payments.
- High Outstanding Customers shows top five outstanding customers, linking to
  `/outstanding?customerId=...`.

### Search Behavior

Route:

- `/search?q=<query>`

Global search input lives in `components/AppNav.tsx`.

Search groups results by:

- Customers
- Invoices
- Payments
- Cheques

Customer search:

- Matches customer name or code.
- Links to `/customers/[id]`.

Invoice search:

- Matches invoice number.
- Includes customer name/code and amount.
- Links to `/invoices/[id]`.

Payment search:

- Matches payment id.
- Matches generated receipt reference pattern `PAY-YYYYMMDD-XXXX`.
- Matches bank reference, card reference, or cheque number on payment parts.
- Links to `/payments/[id]`.

Cheque search:

- Matches cheque number on `PaymentPart` where method is `CHEQUE`.
- Links to `/cheques/[id]`.

## 5. Payment Business Rules

These rules are implemented in the current web app.

Payment total versus methods:

- Payment total is the sum of added payment method amounts.
- Payment total must be greater than zero.

Payment total versus allocations:

- Overall selected invoice allocations must equal the payment total before the
  UI allows saving.
- Server action also requires payment total to equal allocation total.

Method allocations:

- Each method has its own allocation list.
- Each method amount must equal the sum of that method's allocations.
- Method allocation cannot exceed the remaining overall allocation for that
  invoice.
- Sum of method allocations per invoice must equal the overall selected
  allocation amount for that invoice.

Invoice ownership/customer rules:

- Payment creation loads invoices with `where: { customerId, id: { in: ... } }`.
- If the number of loaded invoices does not match selected allocations, the app
  errors.
- This prevents allocating a payment to another customer's invoice.

Outstanding balance rules:

- Most UI/report calculations use:
  - invoice amount minus active paid allocations.
- Active allocations are:
  - `paymentPartId = null`, or
  - `paymentPart.status = ACTIVE`.
- Reversed payment parts do not reduce outstanding in reports, dashboard,
  customer pages, invoice pages, aging, statement, and cheque reversal status
  recalculation.

Reversed PaymentPart behavior:

- Reversing a cheque changes `PaymentPart.status` from `ACTIVE` to `REVERSED`.
- The allocation rows remain.
- Reports ignore those allocations when calculating paid/outstanding.
- Undoing reversal changes the same part back to `ACTIVE`.

Payment versus PaymentPart reversal:

- The current cheque UI reverses `PaymentPart`, not `Payment`.
- The parent `Payment` remains as the receipt record.
- `Payment.status`, `Payment.reversedAt`, and `Payment.reversalReason` exist in
  Prisma, but the current cheque reversal UI does not update them.
- There is no general whole-payment reversal UI in the inspected web app.

Invoice status recalculation:

- Status is derived from active paid total:
  - `PAID` if active paid total is greater than or equal to invoice amount.
  - `PARTIALLY_PAID` if active paid total is greater than zero.
  - `UNPAID` otherwise.

## 6. Cheque Reversal Details

This section is intentionally redundant because cheque reversal is the highest
risk financial correction flow.

What counts as a cheque:

- `PaymentPart.method === "CHEQUE"`.

When a cheque is reversed:

- User opens `/cheques/[id]`.
- The page verifies the payment part exists and is a cheque.
- The reversal form requires a reason.
- Confirmation dialog warns that reversing removes allocations from invoice paid
  amounts and recalculates outstanding balances.
- Server action validates that the cheque is active.
- Transaction updates the `PaymentPart`:
  - `status = REVERSED`
  - `reversedAt = now`
  - `reversalReason = submitted reason`
- Transaction recalculates all invoices touched by that cheque's allocations.

Which records change:

- `PaymentPart` changes.
- Affected `Invoice.status` values may change.
- `PaymentAllocation` rows are not deleted or modified.
- Parent `Payment` is not changed by the current web app cheque reversal.

How allocations are handled:

- Allocations stay attached to the cheque part.
- Cheque detail still shows the original invoice allocations.
- A warning explains the cheque was reversed and those allocations no longer
  count toward invoice payments.

How invoice outstanding changes:

- Active paid amount decreases because allocations linked to the reversed part
  are ignored.
- Outstanding amount increases accordingly.
- Status may move from `PAID` to `PARTIALLY_PAID` or `UNPAID`.

Undo reversal:

- Restores the cheque part to `ACTIVE`.
- Clears `reversedAt` and `reversalReason`.
- Recalculates affected invoice statuses again.
- The allocations count toward invoice payments again.

## 7. Dashboard And Reports

Metrics and source models:

- Total Customers: `Customer`.
- Total Invoiced: sum of `Invoice.amount`.
- Total Paid: sum of `PaymentAllocation.amount` where the allocation has no
  payment part or has an active payment part.
- Total Outstanding: total invoiced minus total paid.
- Active Cheques: count of `PaymentPart` with method `CHEQUE` and status
  `ACTIVE`.
- Reversed Cheques: count of `PaymentPart` with method `CHEQUE` and status
  `REVERSED`.
- Outstanding by Customer: grouped invoice outstanding by customer.
- Invoice Status chart: counts invoices by calculated status.
- Monthly Collections chart: active allocations grouped by
  `Payment.paymentDate` month.
- Recent Activity: latest five `Payment` records.
- High Outstanding Customers: top five customers by calculated outstanding.
- Outstanding report: customers and invoices with outstanding greater than zero.
- Aging report: outstanding invoices grouped by due date aging buckets.
- Statement: customer ledger from invoices, active payments, and reversed cheque
  audit rows.

## 8. NestJS + Drizzle Rebuild Rules

Use these rules when rebuilding or extending the backend:

- Do not invent tables or workflows not present in Prisma or the web app unless
  explicitly requested.
- Before implementing a backend feature, inspect the matching web app code.
- `prisma/schema.prisma` is the data-model source of truth.
- Drizzle schema should mirror Prisma.
- If Prisma has no `Collection` model, do not add Collections backend features.
- Payment creation must preserve the `Payment -> PaymentPart ->
  PaymentAllocation` structure.
- Each allocation created from a method should be linked to the specific
  `PaymentPart` that funded it.
- PaymentPart reversal is the core cheque reversal mechanism used by the web
  app.
- The backend must expose cheque reversal as PaymentPart reversal, not as the
  main Payment reversal flow.
- Primary cheque reversal endpoints should be:
  - `PATCH /api/cheques/:id/reverse`
  - `PATCH /api/cheques/:id/undo-reversal`
- `PATCH /api/payments/:id/reverse` should not be treated as the normal cheque
  bounce workflow. If it exists, it should be considered a separate future admin
  void-payment feature and must not replace cheque reversal.
- Do not treat cheque reversal as a whole-payment reversal unless the product is
  intentionally changed.
- Outstanding calculations must ignore reversed payment parts if the web app
  does.
- Legacy allocations with `paymentPartId = null` should continue to count as
  active unless a migration or product decision changes that rule.
- Preserve audit trail. Do not delete financial records casually.
- Reversal should change statuses and recalculate derived invoice status, not
  erase the original payment/allocation history.
- Prefer transactions for multi-table financial writes.
- Validate invoice ownership before accepting allocations.
- Validate that payment totals, method totals, and allocation totals agree.
- Validate that allocations do not exceed invoice outstanding.
- Return clear errors for invalid financial operations.

## 9. Unknowns / Needs Confirmation

These items are unclear or inconsistent in the inspected code and should be
confirmed before backend behavior is finalized:

- `Payment.status`, `Payment.reversedAt`, and `Payment.reversalReason` exist in
  Prisma, but the current web app does not expose a whole-payment reversal flow.
  The cheque reversal flow updates only `PaymentPart`. Therefore, cheque reversal
  should be implemented through `/api/cheques/:id/reverse` and
  `/api/cheques/:id/undo-reversal`, not as normal payment-level reversal.
- The payment creation page displays outstanding amounts excluding reversed
  payment parts, but the server action's transaction-level over-allocation check
  currently sums all previous `invoice.payments` without filtering reversed
  payment parts. This may be a bug or stale logic.
- There is no invoice edit page in the current app, even though invoice creation
  and detail pages exist.
- There is no visible delete flow for customers, invoices, or payments in the
  inspected web app pages.
- `openingOutstanding` remains in Prisma but is intentionally ignored by the
  current UI and calculations. Confirm before using it in any backend report.
- The app uses generated display receipt references like `PAY-YYYYMMDD-XXXX`;
  there is no persisted payment number in Prisma.
- `OVERDUE` and `CANCELLED` are valid `InvoiceStatus` enum values, but most
  current UI calculations collapse invoice display status to `PAID`,
  `PARTIALLY_PAID`, or `UNPAID`.
- The current backend under `backend/src` is being rebuilt separately from the
  Next.js web app. The web app still uses Prisma directly.
