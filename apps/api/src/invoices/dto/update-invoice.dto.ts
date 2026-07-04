export class UpdateInvoiceDto {
  invoiceNumber?: string;
  amount?: string;
  invoiceDate?: string;
  dueDate?: string;
  status?: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  customerId?: string;
}
