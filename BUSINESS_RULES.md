## Business Rules

- App is for Sri Lankan distribution cash collection.
- Collector app must be extremely simple.
- Customers can have multiple invoices.
- Invoices can be paid partially.
- One payment can pay multiple invoices.
- One invoice can receive multiple payments.
- Payments can contain cash, cheque, bank transfer, and future card payment.
- Cheque received by collector is not same as cheque cleared.
- Cheque clearing is office responsibility.
- Customers need fixed credit periods.
- Invoice and payment SMS should be sent to customers.
- Collector petty cash/float must be tracked later.


Payment workflow:
- Collector searches/selects customer.
- Collector opens customer profile.
- Collector selects bill/invoice from outstanding list.
- Collector chooses one or more payment methods.
- Supported methods: cash, cheque, bank transfer, card in future.
- Collector enters amount per method.
- The collector decides which invoice(s) the payment is applied to.
- Partial payments are allowed.
- Invoice status becomes:
  - UNPAID if no payment
  - PARTIALLY_PAID if some amount paid
  - PAID if fully paid

Payment Creation Rules

1. Collector selects customer.
2. Collector selects one or more invoices.
3. Partial invoice payments are allowed.
4. One payment can settle multiple invoices.
5. One invoice can receive multiple payments.
6. One payment can contain multiple payment methods.
7. Payment method total must equal allocation total.
8. Cheque received does not mean cheque cleared.
9. Cheque clearing is handled by office staff later.

### Invoice Outstanding Calculation

Invoice Outstanding =
Invoice Total − Total Successfully Recorded Allocations

Collectors may only allocate amounts up to the current outstanding value.

The original invoice amount must remain unchanged for audit purposes.



### Cheque Handling

Collectors treat cheques the same as cash at collection time.

When a cheque is received:
- The payment is recorded immediately.
- Customer outstanding balance reduces immediately.
- Invoice status updates immediately.

If a cheque bounces later:
- Office staff must be able to mark the cheque as bounced.
- The system must reverse the related payment allocation.
- The customer outstanding balance must increase again.
- The invoice status must be recalculated.
- The original payment history must remain for audit purposes.
