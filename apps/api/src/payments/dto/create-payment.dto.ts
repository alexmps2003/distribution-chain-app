export class CreatePaymentDto {
  customerId: string;
  paymentDate?: string;
  notes?: string;
  amount: string;
  methods: {
    method: 'CASH' | 'CHEQUE' | 'BANK_TRANSFER' | 'CARD';
    amount: string;
    chequeNumber?: string;
    chequeBank?: string;
    chequeDate?: string;
    bankReference?: string;
    cardReference?: string;
    allocations?: {
      invoiceId: string;
      amount: string;
    }[];
  }[];
}
