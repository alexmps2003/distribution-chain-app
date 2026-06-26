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
  creditLimit: numeric('creditLimit', { precision: 12, scale: 2 }).notNull(),
  openingOutstanding: numeric('openingOutstanding', {
    precision: 12,
    scale: 2,
  }).notNull(),
  paymentTermsDays: integer('paymentTermsDays').notNull(),
  isActive: boolean('isActive').notNull(),
  createdAt: timestamp('createdAt').notNull(),
});

export const invoices = pgTable('Invoice', {
  id: text('id').primaryKey(),
  invoiceNumber: text('invoiceNumber').notNull().unique(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  invoiceDate: timestamp('invoiceDate').notNull(),
  dueDate: timestamp('dueDate'),
  status: invoiceStatus('status').notNull().default('UNPAID'),
  customerId: text('customerId').notNull(),
  createdAt: timestamp('createdAt').notNull(),
});
