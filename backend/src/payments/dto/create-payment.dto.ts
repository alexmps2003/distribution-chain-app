export class CreatePaymentDto {
  customerId: string;
  paymentDate?: string;
  notes?: string;
  amount: string;
  paymentMethod: string;
  methods?: unknown[];
  allocations?: unknown[];
}
