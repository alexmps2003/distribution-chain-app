

# Distribio Permission Matrix

This document is the single source of truth for role permissions across the backend, web application, and future mobile applications.

## Roles

- **ADMIN** – Full system administration.
- **SALES_REP** – Manages customers and invoices.
- **COLLECTOR** – Records customer payments and views operational data.

## Permission Matrix

| Module | Admin | Sales Rep | Collector |
|--------|:-----:|:---------:|:---------:|
| Dashboard | Full | Full | Full |
| Customers | Create / View / Edit / Delete | Create / View / Edit | View |
| Invoices | Create / View / Edit / Delete | Create / View / Edit | View |
| Payments | Create / View | View | Create / View |
| Cheques | View / Reverse / Undo Reversal | View | View |
| Outstanding | View | View | View |
| Aging | View | View | No Access |
| Search | View | View | View |

---

## Customer Permissions

### Admin
- Create customers
- Edit customers
- Delete customers

### Sales Rep
- Create customers
- Edit customers
- View customers

### Collector
- View customers only

---

## Invoice Permissions

### Admin
- Create invoices
- Edit invoices
- Delete invoices

### Sales Rep
- Create invoices
- Edit invoices
- View invoices

### Collector
- View invoices only

---

## Payment Permissions

### Admin
- View payments
- Create payments when required

### Sales Rep
- View payments only

### Collector
- Record (create) payments
- View payment details
- Cannot edit payments
- Cannot delete payments

> Payments form part of the financial audit trail. Corrections are handled through administrative actions rather than editing existing payment records.

---

## Cheque Permissions

### Admin
- View cheques
- Reverse cheque payment parts
- Undo cheque reversals

### Sales Rep
- View cheque status

### Collector
- View cheque status

> Cheque reversal is a PaymentPart reversal, not a Payment reversal.

---

## Security Principle

The backend is the source of truth for authorization.

- Frontend permissions exist only to improve user experience.
- Backend guards must always enforce access regardless of what the UI displays.
- Hidden buttons are not a security mechanism.