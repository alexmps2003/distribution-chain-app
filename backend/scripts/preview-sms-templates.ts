import { SmsTemplateService } from '../src/notifications/sms-template.service';

const smsTemplateService = new SmsTemplateService();
const sampleDate = new Date('2026-07-02T10:30:00+05:30');
const sampleDueDate = new Date('2026-07-16T00:00:00+05:30');

function printPreview(title: string, message: string) {
  console.log(`\n--- ${title} ---`);
  console.log(message);
}

printPreview(
  'Payment Received',
  smsTemplateService.paymentReceived({
    amount: '25000',
    customerName: 'ABC Stores',
    dateTime: sampleDate,
    outstanding: '74500',
    paymentMethod: 'MIXED',
    receiptNumber: 'RCP-2026-0042',
  }),
);

printPreview(
  'Invoice Created',
  smsTemplateService.invoiceCreated({
    amount: '38000',
    customerName: 'ABC Stores',
    dateTime: sampleDate,
    dueDate: sampleDueDate,
    invoiceNumber: 'INV-2026-0185',
    outstanding: '112500',
  }),
);

printPreview(
  'Cheque Reversed',
  smsTemplateService.chequeReversed({
    amount: '15000',
    chequeNumber: '784512',
    customerName: 'ABC Stores',
    dateTime: sampleDate,
    outstanding: '89500',
  }),
);

printPreview(
  'Cheque Reversal Undone',
  smsTemplateService.chequeReversalUndone({
    amount: '15000',
    chequeNumber: '784512',
    customerName: 'ABC Stores',
    dateTime: sampleDate,
    outstanding: '74500',
  }),
);
