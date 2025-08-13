import { 
  serial, 
  text, 
  pgTable, 
  timestamp, 
  numeric, 
  integer, 
  boolean,
  pgEnum,
  varchar,
  date
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['ADMIN', 'WAREHOUSE_MANAGER', 'PURCHASING_STAFF', 'TECHNICIAN']);
export const purchaseOrderStatusEnum = pgEnum('purchase_order_status', ['DRAFT', 'PENDING', 'APPROVED', 'ORDERED', 'RECEIVED', 'CANCELLED']);
export const workOrderStatusEnum = pgEnum('work_order_status', ['CREATED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
export const priorityEnum = pgEnum('priority', ['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export const stockAdjustmentTypeEnum = pgEnum('stock_adjustment_type', ['ADJUSTMENT', 'RECEIVED', 'CONSUMED', 'DAMAGED', 'LOST']);

// Users table
export const usersTable = pgTable('users', {
  id: varchar('id', { length: 255 }).primaryKey(), // Clerk user ID
  email: varchar('email', { length: 255 }).notNull().unique(),
  first_name: varchar('first_name', { length: 100 }).notNull(),
  last_name: varchar('last_name', { length: 100 }).notNull(),
  role: userRoleEnum('role').notNull(),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Items/Inventory table
export const itemsTable = pgTable('items', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  sku: varchar('sku', { length: 100 }).notNull().unique(),
  category: varchar('category', { length: 100 }).notNull(),
  unit_of_measure: varchar('unit_of_measure', { length: 50 }).notNull(),
  current_stock: integer('current_stock').notNull().default(0),
  min_stock_level: integer('min_stock_level').notNull().default(0),
  unit_cost: numeric('unit_cost', { precision: 10, scale: 2 }).notNull().default('0'),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Suppliers table
export const suppliersTable = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  contact_person: varchar('contact_person', { length: 255 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  address: text('address'),
  encrypted_payment_info: text('encrypted_payment_info'), // Encrypted sensitive data
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Purchase Orders table
export const purchaseOrdersTable = pgTable('purchase_orders', {
  id: serial('id').primaryKey(),
  po_number: varchar('po_number', { length: 50 }).notNull().unique(),
  supplier_id: integer('supplier_id').notNull().references(() => suppliersTable.id),
  status: purchaseOrderStatusEnum('status').notNull().default('DRAFT'),
  order_date: timestamp('order_date').defaultNow().notNull(),
  expected_delivery_date: date('expected_delivery_date'),
  total_amount: numeric('total_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  notes: text('notes'),
  created_by: varchar('created_by', { length: 255 }).notNull().references(() => usersTable.id),
  approved_by: varchar('approved_by', { length: 255 }).references(() => usersTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Purchase Order Items table (junction table)
export const purchaseOrderItemsTable = pgTable('purchase_order_items', {
  id: serial('id').primaryKey(),
  purchase_order_id: integer('purchase_order_id').notNull().references(() => purchaseOrdersTable.id),
  item_id: integer('item_id').notNull().references(() => itemsTable.id),
  quantity: integer('quantity').notNull(),
  unit_price: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  total_price: numeric('total_price', { precision: 12, scale: 2 }).notNull(),
  received_quantity: integer('received_quantity').notNull().default(0),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Work Orders table
export const workOrdersTable = pgTable('work_orders', {
  id: serial('id').primaryKey(),
  wo_number: varchar('wo_number', { length: 50 }).notNull().unique(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: workOrderStatusEnum('status').notNull().default('CREATED'),
  priority: priorityEnum('priority').notNull().default('MEDIUM'),
  assigned_to: varchar('assigned_to', { length: 255 }).references(() => usersTable.id),
  estimated_hours: numeric('estimated_hours', { precision: 8, scale: 2 }),
  actual_hours: numeric('actual_hours', { precision: 8, scale: 2 }),
  due_date: date('due_date'),
  completed_date: timestamp('completed_date'),
  created_by: varchar('created_by', { length: 255 }).notNull().references(() => usersTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Work Order Items table (items used in work order)
export const workOrderItemsTable = pgTable('work_order_items', {
  id: serial('id').primaryKey(),
  work_order_id: integer('work_order_id').notNull().references(() => workOrdersTable.id),
  item_id: integer('item_id').notNull().references(() => itemsTable.id),
  quantity_planned: integer('quantity_planned').notNull(),
  quantity_used: integer('quantity_used').notNull().default(0),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Stock Adjustments table for audit trail
export const stockAdjustmentsTable = pgTable('stock_adjustments', {
  id: serial('id').primaryKey(),
  item_id: integer('item_id').notNull().references(() => itemsTable.id),
  adjustment_type: stockAdjustmentTypeEnum('adjustment_type').notNull(),
  quantity_change: integer('quantity_change').notNull(), // Can be positive or negative
  previous_stock: integer('previous_stock').notNull(),
  new_stock: integer('new_stock').notNull(),
  reason: text('reason').notNull(),
  reference_id: integer('reference_id'), // References PO, WO, etc.
  reference_type: varchar('reference_type', { length: 50 }), // 'purchase_order', 'work_order', etc.
  created_by: varchar('created_by', { length: 255 }).notNull().references(() => usersTable.id),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  createdPurchaseOrders: many(purchaseOrdersTable, { relationName: 'createdBy' }),
  approvedPurchaseOrders: many(purchaseOrdersTable, { relationName: 'approvedBy' }),
  createdWorkOrders: many(workOrdersTable, { relationName: 'createdBy' }),
  assignedWorkOrders: many(workOrdersTable, { relationName: 'assignedTo' }),
  stockAdjustments: many(stockAdjustmentsTable)
}));

export const itemsRelations = relations(itemsTable, ({ many }) => ({
  purchaseOrderItems: many(purchaseOrderItemsTable),
  workOrderItems: many(workOrderItemsTable),
  stockAdjustments: many(stockAdjustmentsTable)
}));

export const suppliersRelations = relations(suppliersTable, ({ many }) => ({
  purchaseOrders: many(purchaseOrdersTable)
}));

export const purchaseOrdersRelations = relations(purchaseOrdersTable, ({ one, many }) => ({
  supplier: one(suppliersTable, {
    fields: [purchaseOrdersTable.supplier_id],
    references: [suppliersTable.id]
  }),
  createdBy: one(usersTable, {
    fields: [purchaseOrdersTable.created_by],
    references: [usersTable.id],
    relationName: 'createdBy'
  }),
  approvedBy: one(usersTable, {
    fields: [purchaseOrdersTable.approved_by],
    references: [usersTable.id],
    relationName: 'approvedBy'
  }),
  items: many(purchaseOrderItemsTable)
}));

export const purchaseOrderItemsRelations = relations(purchaseOrderItemsTable, ({ one }) => ({
  purchaseOrder: one(purchaseOrdersTable, {
    fields: [purchaseOrderItemsTable.purchase_order_id],
    references: [purchaseOrdersTable.id]
  }),
  item: one(itemsTable, {
    fields: [purchaseOrderItemsTable.item_id],
    references: [itemsTable.id]
  })
}));

export const workOrdersRelations = relations(workOrdersTable, ({ one, many }) => ({
  createdBy: one(usersTable, {
    fields: [workOrdersTable.created_by],
    references: [usersTable.id],
    relationName: 'createdBy'
  }),
  assignedTo: one(usersTable, {
    fields: [workOrdersTable.assigned_to],
    references: [usersTable.id],
    relationName: 'assignedTo'
  }),
  items: many(workOrderItemsTable)
}));

export const workOrderItemsRelations = relations(workOrderItemsTable, ({ one }) => ({
  workOrder: one(workOrdersTable, {
    fields: [workOrderItemsTable.work_order_id],
    references: [workOrdersTable.id]
  }),
  item: one(itemsTable, {
    fields: [workOrderItemsTable.item_id],
    references: [itemsTable.id]
  })
}));

export const stockAdjustmentsRelations = relations(stockAdjustmentsTable, ({ one }) => ({
  item: one(itemsTable, {
    fields: [stockAdjustmentsTable.item_id],
    references: [itemsTable.id]
  }),
  createdBy: one(usersTable, {
    fields: [stockAdjustmentsTable.created_by],
    references: [usersTable.id]
  })
}));

// TypeScript types for the tables
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Item = typeof itemsTable.$inferSelect;
export type NewItem = typeof itemsTable.$inferInsert;

export type Supplier = typeof suppliersTable.$inferSelect;
export type NewSupplier = typeof suppliersTable.$inferInsert;

export type PurchaseOrder = typeof purchaseOrdersTable.$inferSelect;
export type NewPurchaseOrder = typeof purchaseOrdersTable.$inferInsert;

export type PurchaseOrderItem = typeof purchaseOrderItemsTable.$inferSelect;
export type NewPurchaseOrderItem = typeof purchaseOrderItemsTable.$inferInsert;

export type WorkOrder = typeof workOrdersTable.$inferSelect;
export type NewWorkOrder = typeof workOrdersTable.$inferInsert;

export type WorkOrderItem = typeof workOrderItemsTable.$inferSelect;
export type NewWorkOrderItem = typeof workOrderItemsTable.$inferInsert;

export type StockAdjustment = typeof stockAdjustmentsTable.$inferSelect;
export type NewStockAdjustment = typeof stockAdjustmentsTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = {
  users: usersTable,
  items: itemsTable,
  suppliers: suppliersTable,
  purchaseOrders: purchaseOrdersTable,
  purchaseOrderItems: purchaseOrderItemsTable,
  workOrders: workOrdersTable,
  workOrderItems: workOrderItemsTable,
  stockAdjustments: stockAdjustmentsTable
};