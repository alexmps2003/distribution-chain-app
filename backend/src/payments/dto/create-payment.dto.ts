export class CreatePaymentDto {
  customerId: string;
  paymentDate?: string;
  notes?: string;
  methods: unknown[];
  allocations: unknown[];
}
