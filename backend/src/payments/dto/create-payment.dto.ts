export class CreatePaymentDto {
  customerId: string;
  paymentDate?: string;
  notes?: string;
  amount: string;
  paymentMethod: string;
  methods: {
    method: 'CASH' | 'CHEQUE' | 'BANK_TRANSFER' | 'CARD';
    amount: string;
    chequeNumber?: string;
    chequeBank?: string;
    chequeDate?: string;
    bankReference?: string;
    cardReference?: string;
  }[];
  allocations?: unknown[];
}
