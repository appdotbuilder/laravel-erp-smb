import { z } from 'zod';

// User roles enum for RBAC
export const userRoleSchema = z.enum(['ADMIN', 'WAREHOUSE_MANAGER', 'PURCHASING_STAFF', 'TECHNICIAN']);
export type UserRole = z.infer<typeof userRoleSchema>;

// User schema
export const userSchema = z.object({
  id: z.string(), // Clerk user ID
  email: z.string().email(),
  first_name: z.string(),
  last_name: z.string(),
  role: userRoleSchema,
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Item/Inventory schema
export const itemSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  sku: z.string(), // Stock Keeping Unit
  category: z.string(),
  unit_of_measure: z.string(), // e.g., 'pieces', 'kg', 'liters'
  current_stock: z.number().int().nonnegative(),
  min_stock_level: z.number().int().nonnegative(), // For low stock alerts
  unit_cost: z.number().nonnegative(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Item = z.infer<typeof itemSchema>;

// Supplier schema
export const supplierSchema = z.object({
  id: z.number(),
  name: z.string(),
  contact_person: z.string().nullable(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  encrypted_payment_info: z.string().nullable(), // Encrypted sensitive data
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Supplier = z.infer<typeof supplierSchema>;

// Purchase Order status enum
export const purchaseOrderStatusSchema = z.enum(['DRAFT', 'PENDING', 'APPROVED', 'ORDERED', 'RECEIVED', 'CANCELLED']);
export type PurchaseOrderStatus = z.infer<typeof purchaseOrderStatusSchema>;

// Purchase Order schema
export const purchaseOrderSchema = z.object({
  id: z.number(),
  po_number: z.string(), // Auto-generated PO number
  supplier_id: z.number(),
  status: purchaseOrderStatusSchema,
  order_date: z.coerce.date(),
  expected_delivery_date: z.coerce.date().nullable(),
  total_amount: z.number().nonnegative(),
  notes: z.string().nullable(),
  created_by: z.string(), // Clerk user ID
  approved_by: z.string().nullable(), // Clerk user ID
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type PurchaseOrder = z.infer<typeof purchaseOrderSchema>;

// Purchase Order Item schema (junction table)
export const purchaseOrderItemSchema = z.object({
  id: z.number(),
  purchase_order_id: z.number(),
  item_id: z.number(),
  quantity: z.number().int().positive(),
  unit_price: z.number().nonnegative(),
  total_price: z.number().nonnegative(),
  received_quantity: z.number().int().nonnegative().default(0),
  created_at: z.coerce.date()
});

export type PurchaseOrderItem = z.infer<typeof purchaseOrderItemSchema>;

// Work Order status enum
export const workOrderStatusSchema = z.enum(['CREATED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
export type WorkOrderStatus = z.infer<typeof workOrderStatusSchema>;

// Work Order schema
export const workOrderSchema = z.object({
  id: z.number(),
  wo_number: z.string(), // Auto-generated WO number
  title: z.string(),
  description: z.string().nullable(),
  status: workOrderStatusSchema,
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  assigned_to: z.string().nullable(), // Clerk user ID for technician
  estimated_hours: z.number().nonnegative().nullable(),
  actual_hours: z.number().nonnegative().nullable(),
  due_date: z.coerce.date().nullable(),
  completed_date: z.coerce.date().nullable(),
  created_by: z.string(), // Clerk user ID
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type WorkOrder = z.infer<typeof workOrderSchema>;

// Work Order Item schema (items used in work order)
export const workOrderItemSchema = z.object({
  id: z.number(),
  work_order_id: z.number(),
  item_id: z.number(),
  quantity_planned: z.number().int().positive(),
  quantity_used: z.number().int().nonnegative().default(0),
  created_at: z.coerce.date()
});

export type WorkOrderItem = z.infer<typeof workOrderItemSchema>;

// Stock Adjustment schema for audit trail
export const stockAdjustmentTypeSchema = z.enum(['ADJUSTMENT', 'RECEIVED', 'CONSUMED', 'DAMAGED', 'LOST']);
export type StockAdjustmentType = z.infer<typeof stockAdjustmentTypeSchema>;

export const stockAdjustmentSchema = z.object({
  id: z.number(),
  item_id: z.number(),
  adjustment_type: stockAdjustmentTypeSchema,
  quantity_change: z.number().int(), // Can be positive or negative
  previous_stock: z.number().int().nonnegative(),
  new_stock: z.number().int().nonnegative(),
  reason: z.string(),
  reference_id: z.number().nullable(), // References PO, WO, etc.
  reference_type: z.string().nullable(), // 'purchase_order', 'work_order', etc.
  created_by: z.string(), // Clerk user ID
  created_at: z.coerce.date()
});

export type StockAdjustment = z.infer<typeof stockAdjustmentSchema>;

// Input schemas for creating entities
export const createUserInputSchema = z.object({
  id: z.string(), // Clerk user ID
  email: z.string().email(),
  first_name: z.string(),
  last_name: z.string(),
  role: userRoleSchema
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const createItemInputSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  sku: z.string(),
  category: z.string(),
  unit_of_measure: z.string(),
  current_stock: z.number().int().nonnegative(),
  min_stock_level: z.number().int().nonnegative(),
  unit_cost: z.number().nonnegative()
});

export type CreateItemInput = z.infer<typeof createItemInputSchema>;

export const createSupplierInputSchema = z.object({
  name: z.string(),
  contact_person: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  payment_info: z.string().nullable().optional() // Will be encrypted
});

export type CreateSupplierInput = z.infer<typeof createSupplierInputSchema>;

export const createPurchaseOrderInputSchema = z.object({
  supplier_id: z.number(),
  expected_delivery_date: z.coerce.date().nullable().optional(),
  notes: z.string().nullable().optional(),
  items: z.array(z.object({
    item_id: z.number(),
    quantity: z.number().int().positive(),
    unit_price: z.number().nonnegative()
  }))
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderInputSchema>;

export const createWorkOrderInputSchema = z.object({
  title: z.string(),
  description: z.string().nullable().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  assigned_to: z.string().nullable().optional(),
  estimated_hours: z.number().nonnegative().nullable().optional(),
  due_date: z.coerce.date().nullable().optional(),
  items: z.array(z.object({
    item_id: z.number(),
    quantity_planned: z.number().int().positive()
  })).optional()
});

export type CreateWorkOrderInput = z.infer<typeof createWorkOrderInputSchema>;

export const createStockAdjustmentInputSchema = z.object({
  item_id: z.number(),
  adjustment_type: stockAdjustmentTypeSchema,
  quantity_change: z.number().int(),
  reason: z.string(),
  reference_id: z.number().nullable().optional(),
  reference_type: z.string().nullable().optional()
});

export type CreateStockAdjustmentInput = z.infer<typeof createStockAdjustmentInputSchema>;

// Update schemas
export const updateItemInputSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  sku: z.string().optional(),
  category: z.string().optional(),
  unit_of_measure: z.string().optional(),
  current_stock: z.number().int().nonnegative().optional(),
  min_stock_level: z.number().int().nonnegative().optional(),
  unit_cost: z.number().nonnegative().optional(),
  is_active: z.boolean().optional()
});

export type UpdateItemInput = z.infer<typeof updateItemInputSchema>;

export const updatePurchaseOrderStatusInputSchema = z.object({
  id: z.number(),
  status: purchaseOrderStatusSchema
});

export type UpdatePurchaseOrderStatusInput = z.infer<typeof updatePurchaseOrderStatusInputSchema>;

export const updateWorkOrderInputSchema = z.object({
  id: z.number(),
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  status: workOrderStatusSchema.optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assigned_to: z.string().nullable().optional(),
  estimated_hours: z.number().nonnegative().nullable().optional(),
  actual_hours: z.number().nonnegative().nullable().optional(),
  due_date: z.coerce.date().nullable().optional(),
  completed_date: z.coerce.date().nullable().optional()
});

export type UpdateWorkOrderInput = z.infer<typeof updateWorkOrderInputSchema>;

// Query schemas
export const getLowStockItemsInputSchema = z.object({
  threshold_multiplier: z.number().positive().default(1) // Multiplier for min_stock_level
});

export type GetLowStockItemsInput = z.infer<typeof getLowStockItemsInputSchema>;