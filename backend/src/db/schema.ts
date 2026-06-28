import {
  boolean,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const invoiceStatus = pgEnum('InvoiceStatus', [
  'UNPAID',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'CANCELLED',
]);

export const paymentMethod = pgEnum('PaymentMethod', [
  'CASH',
  'CHEQUE',
  'BANK_TRANSFER',
  'CARD',
]);

export const paymentStatus = pgEnum('PaymentStatus', ['ACTIVE', 'REVERSED']);

export const userRole = pgEnum('UserRole', ['ADMIN', 'SALES_REP', 'COLLECTOR']);

export const users = pgTable('User', {
  id: text('id').primaryKey(),
  supabaseUserId: text('supabaseUserId').notNull().unique(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: userRole('role').notNull(),
  isActive: boolean('isActive').notNull().default(true),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export const customers = pgTable('Customer', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  contactPerson: text('contactPerson'),
  ownerName: text('ownerName'),
  phone: text('phone'),
  whatsappNumber: text('whatsappNumber'),
  email: text('email'),
  address: text('address'),
  area: text('area'),
  routeName: text('routeName'),
  assignedSalesRep: text('assignedSalesRep'),
  assignedCollector: text('assignedCollector'),
  creditLimit: numeric('creditLimit', { precision: 12, scale: 2 })
    .notNull()
    .default('0'),
  openingOutstanding: numeric('openingOutstanding', {
    precision: 12,
    scale: 2,
  })
    .notNull()
    .default('0'),
  paymentTermsDays: integer('paymentTermsDays').notNull().default(0),
  isActive: boolean('isActive').notNull().default(true),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export const invoices = pgTable('Invoice', {
  id: text('id').primaryKey(),
  invoiceNumber: text('invoiceNumber').notNull().unique(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  invoiceDate: timestamp('invoiceDate').notNull(),
  dueDate: timestamp('dueDate'),
  status: invoiceStatus('status').notNull().default('UNPAID'),
  customerId: text('customerId').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export const payments = pgTable('Payment', {
  id: text('id').primaryKey(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  paymentDate: timestamp('paymentDate').notNull().defaultNow(),
  notes: text('notes'),
  status: paymentStatus('status').notNull().default('ACTIVE'),
  reversedAt: timestamp('reversedAt'),
  reversalReason: text('reversalReason'),
  paymentMethod: text('paymentMethod').notNull(),
  customerId: text('customerId').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export const paymentParts = pgTable('PaymentPart', {
  id: text('id').primaryKey(),
  paymentId: text('paymentId').notNull(),
  method: paymentMethod('method').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  status: paymentStatus('status').notNull().default('ACTIVE'),
  chequeNumber: text('chequeNumber'),
  chequeBank: text('chequeBank'),
  chequeDate: timestamp('chequeDate'),
  bankReference: text('bankReference'),
  cardReference: text('cardReference'),
  reversedAt: timestamp('reversedAt'),
  reversalReason: text('reversalReason'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export const paymentAllocations = pgTable('PaymentAllocation', {
  id: text('id').primaryKey(),
  paymentId: text('paymentId').notNull(),
  invoiceId: text('invoiceId').notNull(),
  paymentPartId: text('paymentPartId'),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
});
