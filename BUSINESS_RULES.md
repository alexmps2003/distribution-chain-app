# Business Rules

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
