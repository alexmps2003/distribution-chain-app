# Design Guidelines

- Use light UI.
- Use bg-zinc-50 page background.
- Use white cards.
- Use zinc borders.
- Use black/zinc primary buttons.
- Do not use random blue or dark backgrounds.
- Match app/customers/page.tsx styling.
- Tables should follow the customer table style.


## Page Width Standards

Use different max widths depending on the type of page.

### Table / List Pages

Use `max-w-7xl` for pages that mainly show tables, lists, reports, or broad
summary data. These pages need more horizontal room and should avoid unnecessary
sideways scrolling.

Examples:
- Customers
- Invoices
- Payments
- Cheques
- Customer outstanding lists
- Reports

Standard wrapper:

```tsx
<main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
  <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
    {/* page content */}
  </div>
</main>
```

### Detail / Form Pages

Use `max-w-5xl` for pages that mainly show forms, cards, or detail views.

Examples:
- Customer Details
- Invoice Details
- Payment Details
- Cheque Details
- Create Customer
- Create Invoice
- Create Payment

Standard wrapper:

```tsx
<main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
  <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
    {/* page content */}
  </div>
</main>
```
