import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  purchaseOrdersTable, 
  suppliersTable, 
  usersTable, 
  itemsTable, 
  purchaseOrderItemsTable,
  stockAdjustmentsTable 
} from '../db/schema';
import { type UpdatePurchaseOrderStatusInput } from '../schema';
import { updatePurchaseOrderStatus } from '../handlers/update_purchase_order_status';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

describe('updatePurchaseOrderStatus', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test data
  const createTestData = async () => {
    // Create test user
    const user = await db.insert(usersTable)
      .values({
        id: 'user-123',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        role: 'PURCHASING_STAFF'
      })
      .returning()
      .execute();

    // Create test approver
    const approver = await db.insert(usersTable)
      .values({
        id: 'approver-123',
        email: 'approver@example.com',
        first_name: 'Test',
        last_name: 'Approver',
        role: 'ADMIN'
      })
      .returning()
      .execute();

    // Create test supplier
    const supplier = await db.insert(suppliersTable)
      .values({
        name: 'Test Supplier',
        contact_person: 'John Doe',
        email: 'supplier@example.com'
      })
      .returning()
      .execute();

    // Create test items
    const item1 = await db.insert(itemsTable)
      .values({
        name: 'Test Item 1',
        sku: 'TEST-001',
        category: 'Test Category',
        unit_of_measure: 'pieces',
        current_stock: 10,
        min_stock_level: 5,
        unit_cost: '25.50'
      })
      .returning()
      .execute();

    const item2 = await db.insert(itemsTable)
      .values({
        name: 'Test Item 2',
        sku: 'TEST-002',
        category: 'Test Category',
        unit_of_measure: 'pieces',
        current_stock: 20,
        min_stock_level: 10,
        unit_cost: '15.75'
      })
      .returning()
      .execute();

    // Create test purchase order
    const purchaseOrder = await db.insert(purchaseOrdersTable)
      .values({
        po_number: 'PO-2024-001',
        supplier_id: supplier[0].id,
        status: 'DRAFT',
        total_amount: '123.50',
        created_by: user[0].id
      })
      .returning()
      .execute();

    // Create purchase order items
    const poItem1 = await db.insert(purchaseOrderItemsTable)
      .values({
        purchase_order_id: purchaseOrder[0].id,
        item_id: item1[0].id,
        quantity: 5,
        unit_price: '25.50',
        total_price: '127.50',
        received_quantity: 0
      })
      .returning()
      .execute();

    const poItem2 = await db.insert(purchaseOrderItemsTable)
      .values({
        purchase_order_id: purchaseOrder[0].id,
        item_id: item2[0].id,
        quantity: 3,
        unit_price: '15.75',
        total_price: '47.25',
        received_quantity: 0
      })
      .returning()
      .execute();

    return {
      user: user[0],
      approver: approver[0],
      supplier: supplier[0],
      item1: item1[0],
      item2: item2[0],
      purchaseOrder: purchaseOrder[0],
      poItem1: poItem1[0],
      poItem2: poItem2[0]
    };
  };

  it('should update purchase order status from DRAFT to PENDING', async () => {
    const testData = await createTestData();
    
    const input: UpdatePurchaseOrderStatusInput = {
      id: testData.purchaseOrder.id,
      status: 'PENDING'
    };

    const result = await updatePurchaseOrderStatus(input, testData.user.id);

    expect(result.id).toBe(testData.purchaseOrder.id);
    expect(result.status).toBe('PENDING');
    expect(result.approved_by).toBeNull();
    expect(typeof result.total_amount).toBe('number');
    expect(result.total_amount).toBe(123.50);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should set approved_by when status changes to APPROVED', async () => {
    const testData = await createTestData();
    
    const input: UpdatePurchaseOrderStatusInput = {
      id: testData.purchaseOrder.id,
      status: 'APPROVED'
    };

    const result = await updatePurchaseOrderStatus(input, testData.approver.id);

    expect(result.status).toBe('APPROVED');
    expect(result.approved_by).toBe(testData.approver.id);
  });

  it('should update stock levels and create stock adjustments when status changes to RECEIVED', async () => {
    const testData = await createTestData();
    
    // First approve the order
    await updatePurchaseOrderStatus({
      id: testData.purchaseOrder.id,
      status: 'APPROVED'
    }, testData.approver.id);

    // Then mark as ordered
    await updatePurchaseOrderStatus({
      id: testData.purchaseOrder.id,
      status: 'ORDERED'
    }, testData.user.id);

    // Now receive the order
    const input: UpdatePurchaseOrderStatusInput = {
      id: testData.purchaseOrder.id,
      status: 'RECEIVED'
    };

    const result = await updatePurchaseOrderStatus(input, testData.user.id);

    expect(result.status).toBe('RECEIVED');

    // Check that stock levels were updated
    const updatedItem1 = await db.select()
      .from(itemsTable)
      .where(eq(itemsTable.id, testData.item1.id))
      .execute();
    
    const updatedItem2 = await db.select()
      .from(itemsTable)
      .where(eq(itemsTable.id, testData.item2.id))
      .execute();

    expect(updatedItem1[0].current_stock).toBe(15); // 10 + 5
    expect(updatedItem2[0].current_stock).toBe(23); // 20 + 3

    // Check that received quantities were updated
    const updatedPOItems = await db.select()
      .from(purchaseOrderItemsTable)
      .where(eq(purchaseOrderItemsTable.purchase_order_id, testData.purchaseOrder.id))
      .execute();

    expect(updatedPOItems.find(item => item.item_id === testData.item1.id)?.received_quantity).toBe(5);
    expect(updatedPOItems.find(item => item.item_id === testData.item2.id)?.received_quantity).toBe(3);

    // Check that stock adjustment records were created
    const stockAdjustments = await db.select()
      .from(stockAdjustmentsTable)
      .where(eq(stockAdjustmentsTable.reference_id, testData.purchaseOrder.id))
      .execute();

    expect(stockAdjustments).toHaveLength(2);
    
    const adjustment1 = stockAdjustments.find(adj => adj.item_id === testData.item1.id);
    const adjustment2 = stockAdjustments.find(adj => adj.item_id === testData.item2.id);

    expect(adjustment1).toBeDefined();
    expect(adjustment1!.adjustment_type).toBe('RECEIVED');
    expect(adjustment1!.quantity_change).toBe(5);
    expect(adjustment1!.previous_stock).toBe(10);
    expect(adjustment1!.new_stock).toBe(15);
    expect(adjustment1!.reference_type).toBe('purchase_order');
    expect(adjustment1!.created_by).toBe(testData.user.id);

    expect(adjustment2).toBeDefined();
    expect(adjustment2!.adjustment_type).toBe('RECEIVED');
    expect(adjustment2!.quantity_change).toBe(3);
    expect(adjustment2!.previous_stock).toBe(20);
    expect(adjustment2!.new_stock).toBe(23);
  });

  it('should handle partial receipts correctly', async () => {
    const testData = await createTestData();

    // Manually set one item as partially received
    await db.update(purchaseOrderItemsTable)
      .set({ received_quantity: 2 })
      .where(eq(purchaseOrderItemsTable.id, testData.poItem1.id))
      .execute();

    const input: UpdatePurchaseOrderStatusInput = {
      id: testData.purchaseOrder.id,
      status: 'RECEIVED'
    };

    await updatePurchaseOrderStatus(input, testData.user.id);

    // Check that only the remaining quantity was added to stock
    const updatedItem1 = await db.select()
      .from(itemsTable)
      .where(eq(itemsTable.id, testData.item1.id))
      .execute();

    expect(updatedItem1[0].current_stock).toBe(13); // 10 + (5 - 2 already received)

    // Check stock adjustment reflects only the remaining quantity
    const stockAdjustments = await db.select()
      .from(stockAdjustmentsTable)
      .where(eq(stockAdjustmentsTable.item_id, testData.item1.id))
      .execute();

    expect(stockAdjustments[0].quantity_change).toBe(3); // Only the remaining 3 items
  });

  it('should throw error when purchase order does not exist', async () => {
    const input: UpdatePurchaseOrderStatusInput = {
      id: 99999,
      status: 'APPROVED'
    };

    expect(updatePurchaseOrderStatus(input, 'user-123')).rejects.toThrow(/not found/i);
  });

  it('should throw error when referenced item does not exist during receipt', async () => {
    const testData = await createTestData();

    // Create a third item for this test
    const item3 = await db.insert(itemsTable)
      .values({
        name: 'Test Item 3',
        sku: 'TEST-003',
        category: 'Test Category',
        unit_of_measure: 'pieces',
        current_stock: 5,
        min_stock_level: 2,
        unit_cost: '30.00'
      })
      .returning()
      .execute();

    // Create a purchase order item for this third item
    await db.insert(purchaseOrderItemsTable)
      .values({
        purchase_order_id: testData.purchaseOrder.id,
        item_id: item3[0].id,
        quantity: 2,
        unit_price: '30.00',
        total_price: '60.00',
        received_quantity: 0
      })
      .execute();

    // Disable foreign key constraints temporarily
    await db.execute(sql`SET session_replication_role = replica`);

    // Delete the item while keeping the purchase order item
    await db.delete(itemsTable)
      .where(eq(itemsTable.id, item3[0].id))
      .execute();

    // Re-enable foreign key constraints
    await db.execute(sql`SET session_replication_role = DEFAULT`);

    const input: UpdatePurchaseOrderStatusInput = {
      id: testData.purchaseOrder.id,
      status: 'RECEIVED'
    };

    expect(updatePurchaseOrderStatus(input, testData.user.id)).rejects.toThrow(/Item with id .* not found/i);
  });

  it('should save updated purchase order to database', async () => {
    const testData = await createTestData();
    
    const input: UpdatePurchaseOrderStatusInput = {
      id: testData.purchaseOrder.id,
      status: 'CANCELLED'
    };

    const result = await updatePurchaseOrderStatus(input, testData.user.id);

    // Verify the change was persisted
    const dbPO = await db.select()
      .from(purchaseOrdersTable)
      .where(eq(purchaseOrdersTable.id, result.id))
      .execute();

    expect(dbPO).toHaveLength(1);
    expect(dbPO[0].status).toBe('CANCELLED');
    expect(dbPO[0].updated_at).toBeInstanceOf(Date);
  });
});