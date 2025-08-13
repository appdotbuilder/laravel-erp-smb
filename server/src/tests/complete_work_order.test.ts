import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, itemsTable, workOrdersTable, workOrderItemsTable, stockAdjustmentsTable } from '../db/schema';
import { completeWorkOrder } from '../handlers/complete_work_order';
import { eq, and } from 'drizzle-orm';

describe('completeWorkOrder', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Test data setup
  const testUser = {
    id: 'user_123',
    email: 'technician@example.com',
    first_name: 'John',
    last_name: 'Doe',
    role: 'TECHNICIAN' as const,
    is_active: true
  };

  const testItem1 = {
    name: 'Screws',
    description: 'Metal screws for assembly',
    sku: 'SCR-001',
    category: 'Hardware',
    unit_of_measure: 'pieces',
    current_stock: 100,
    min_stock_level: 20,
    unit_cost: '0.50', // Convert to string for numeric column
    is_active: true
  };

  const testItem2 = {
    name: 'Bolts',
    description: 'Steel bolts',
    sku: 'BLT-001', 
    category: 'Hardware',
    unit_of_measure: 'pieces',
    current_stock: 50,
    min_stock_level: 10,
    unit_cost: '1.25', // Convert to string for numeric column
    is_active: true
  };

  it('should complete a work order successfully', async () => {
    // Create test user
    await db.insert(usersTable).values(testUser).execute();

    // Create test items
    const [item1, item2] = await db.insert(itemsTable)
      .values([testItem1, testItem2])
      .returning()
      .execute();

    // Create work order
    const [workOrder] = await db.insert(workOrdersTable)
      .values({
        wo_number: 'WO-001',
        title: 'Repair Task',
        description: 'Fix broken equipment',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        assigned_to: testUser.id,
        estimated_hours: '4.5',
        created_by: testUser.id
      })
      .returning()
      .execute();

    // Create work order items with quantity used
    await db.insert(workOrderItemsTable)
      .values([
        {
          work_order_id: workOrder.id,
          item_id: item1.id,
          quantity_planned: 15,
          quantity_used: 10 // Used 10 out of 15 planned
        },
        {
          work_order_id: workOrder.id,
          item_id: item2.id,
          quantity_planned: 8,
          quantity_used: 5 // Used 5 out of 8 planned
        }
      ])
      .execute();

    // Complete the work order
    const result = await completeWorkOrder(workOrder.id, 4.75, testUser.id);

    // Verify work order is completed
    expect(result.id).toEqual(workOrder.id);
    expect(result.status).toEqual('COMPLETED');
    expect(result.actual_hours).toEqual(4.75);
    expect(typeof result.actual_hours).toEqual('number');
    expect(result.completed_date).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Verify inventory was updated correctly
    const updatedItems = await db.select()
      .from(itemsTable)
      .where(eq(itemsTable.id, item1.id))
      .execute();

    expect(updatedItems[0].current_stock).toEqual(90); // 100 - 10 used

    const updatedItems2 = await db.select()
      .from(itemsTable)
      .where(eq(itemsTable.id, item2.id))
      .execute();

    expect(updatedItems2[0].current_stock).toEqual(45); // 50 - 5 used
  });

  it('should create stock adjustment records for consumed items', async () => {
    // Create test user and items
    await db.insert(usersTable).values(testUser).execute();

    const [item1] = await db.insert(itemsTable)
      .values([testItem1])
      .returning()
      .execute();

    // Create work order
    const [workOrder] = await db.insert(workOrdersTable)
      .values({
        wo_number: 'WO-002',
        title: 'Maintenance Task',
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
        created_by: testUser.id
      })
      .returning()
      .execute();

    // Create work order item with usage
    await db.insert(workOrderItemsTable)
      .values({
        work_order_id: workOrder.id,
        item_id: item1.id,
        quantity_planned: 20,
        quantity_used: 15
      })
      .execute();

    // Complete work order
    await completeWorkOrder(workOrder.id, 3.0, testUser.id);

    // Verify stock adjustment record was created
    const stockAdjustments = await db.select()
      .from(stockAdjustmentsTable)
      .where(and(
        eq(stockAdjustmentsTable.item_id, item1.id),
        eq(stockAdjustmentsTable.reference_id, workOrder.id)
      ))
      .execute();

    expect(stockAdjustments).toHaveLength(1);

    const adjustment = stockAdjustments[0];
    expect(adjustment.adjustment_type).toEqual('CONSUMED');
    expect(adjustment.quantity_change).toEqual(-15); // Negative for consumption
    expect(adjustment.previous_stock).toEqual(100);
    expect(adjustment.new_stock).toEqual(85);
    expect(adjustment.reason).toMatch(/WO-002/);
    expect(adjustment.reference_type).toEqual('work_order');
    expect(adjustment.created_by).toEqual(testUser.id);
  });

  it('should not deduct inventory for items with zero quantity used', async () => {
    // Create test user and item
    await db.insert(usersTable).values(testUser).execute();

    const [item1] = await db.insert(itemsTable)
      .values([testItem1])
      .returning()
      .execute();

    // Create work order
    const [workOrder] = await db.insert(workOrdersTable)
      .values({
        wo_number: 'WO-003',
        title: 'Inspection Task',
        status: 'IN_PROGRESS',
        priority: 'LOW',
        created_by: testUser.id
      })
      .returning()
      .execute();

    // Create work order item with no usage (quantity_used = 0)
    await db.insert(workOrderItemsTable)
      .values({
        work_order_id: workOrder.id,
        item_id: item1.id,
        quantity_planned: 10,
        quantity_used: 0 // No items actually used
      })
      .execute();

    // Complete work order
    await completeWorkOrder(workOrder.id, 2.0, testUser.id);

    // Verify inventory was not changed
    const items = await db.select()
      .from(itemsTable)
      .where(eq(itemsTable.id, item1.id))
      .execute();

    expect(items[0].current_stock).toEqual(100); // Original stock unchanged

    // Verify no stock adjustment was created
    const stockAdjustments = await db.select()
      .from(stockAdjustmentsTable)
      .where(eq(stockAdjustmentsTable.reference_id, workOrder.id))
      .execute();

    expect(stockAdjustments).toHaveLength(0);
  });

  it('should throw error for non-existent work order', async () => {
    await db.insert(usersTable).values(testUser).execute();

    await expect(completeWorkOrder(999, 3.0, testUser.id))
      .rejects.toThrow(/Work order with ID 999 not found/i);
  });

  it('should throw error for already completed work order', async () => {
    // Create test user
    await db.insert(usersTable).values(testUser).execute();

    // Create completed work order
    const [workOrder] = await db.insert(workOrdersTable)
      .values({
        wo_number: 'WO-004',
        title: 'Already Completed Task',
        status: 'COMPLETED', // Already completed
        priority: 'MEDIUM',
        created_by: testUser.id,
        completed_date: new Date()
      })
      .returning()
      .execute();

    await expect(completeWorkOrder(workOrder.id, 4.0, testUser.id))
      .rejects.toThrow(/Work order .* is already completed/i);
  });

  it('should throw error for cancelled work order', async () => {
    // Create test user
    await db.insert(usersTable).values(testUser).execute();

    // Create cancelled work order
    const [workOrder] = await db.insert(workOrdersTable)
      .values({
        wo_number: 'WO-005',
        title: 'Cancelled Task',
        status: 'CANCELLED', // Cancelled status
        priority: 'LOW',
        created_by: testUser.id
      })
      .returning()
      .execute();

    await expect(completeWorkOrder(workOrder.id, 2.0, testUser.id))
      .rejects.toThrow(/Cannot complete cancelled work order/i);
  });

  it('should throw error for insufficient stock', async () => {
    // Create test user
    await db.insert(usersTable).values(testUser).execute();

    // Create item with low stock
    const [item1] = await db.insert(itemsTable)
      .values({
        ...testItem1,
        current_stock: 5, // Only 5 in stock
        unit_cost: '0.50' // Ensure string type for numeric column
      })
      .returning()
      .execute();

    // Create work order
    const [workOrder] = await db.insert(workOrdersTable)
      .values({
        wo_number: 'WO-006',
        title: 'High Usage Task',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        created_by: testUser.id
      })
      .returning()
      .execute();

    // Create work order item requiring more than available
    await db.insert(workOrderItemsTable)
      .values({
        work_order_id: workOrder.id,
        item_id: item1.id,
        quantity_planned: 10,
        quantity_used: 8 // Trying to use 8, but only 5 available
      })
      .execute();

    await expect(completeWorkOrder(workOrder.id, 3.0, testUser.id))
      .rejects.toThrow(/Insufficient stock for item/i);

    // Verify work order status was not changed
    const workOrders = await db.select()
      .from(workOrdersTable)
      .where(eq(workOrdersTable.id, workOrder.id))
      .execute();

    expect(workOrders[0].status).toEqual('IN_PROGRESS'); // Still in progress
  });

  it('should handle work order with multiple items correctly', async () => {
    // Create test user and items
    await db.insert(usersTable).values(testUser).execute();

    const [item1, item2] = await db.insert(itemsTable)
      .values([testItem1, testItem2])
      .returning()
      .execute();

    // Create work order
    const [workOrder] = await db.insert(workOrdersTable)
      .values({
        wo_number: 'WO-007',
        title: 'Multi-Item Task',
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
        estimated_hours: '6.0',
        created_by: testUser.id
      })
      .returning()
      .execute();

    // Create multiple work order items
    await db.insert(workOrderItemsTable)
      .values([
        {
          work_order_id: workOrder.id,
          item_id: item1.id,
          quantity_planned: 25,
          quantity_used: 20
        },
        {
          work_order_id: workOrder.id,
          item_id: item2.id,
          quantity_planned: 12,
          quantity_used: 8
        }
      ])
      .execute();

    // Complete work order
    const result = await completeWorkOrder(workOrder.id, 5.5, testUser.id);

    expect(result.status).toEqual('COMPLETED');
    expect(result.actual_hours).toEqual(5.5);
    expect(result.estimated_hours).toEqual(6.0); // Verify numeric conversion

    // Check final inventory levels
    const finalItems = await db.select()
      .from(itemsTable)
      .execute();

    const finalItem1 = finalItems.find(item => item.id === item1.id);
    const finalItem2 = finalItems.find(item => item.id === item2.id);

    expect(finalItem1!.current_stock).toEqual(80); // 100 - 20
    expect(finalItem2!.current_stock).toEqual(42); // 50 - 8

    // Verify stock adjustments for both items
    const stockAdjustments = await db.select()
      .from(stockAdjustmentsTable)
      .where(eq(stockAdjustmentsTable.reference_id, workOrder.id))
      .execute();

    expect(stockAdjustments).toHaveLength(2);
    
    // Check each adjustment
    const adjustment1 = stockAdjustments.find(adj => adj.item_id === item1.id);
    const adjustment2 = stockAdjustments.find(adj => adj.item_id === item2.id);

    expect(adjustment1!.quantity_change).toEqual(-20);
    expect(adjustment1!.new_stock).toEqual(80);
    
    expect(adjustment2!.quantity_change).toEqual(-8);
    expect(adjustment2!.new_stock).toEqual(42);
  });

  it('should handle work order with no items successfully', async () => {
    // Create test user
    await db.insert(usersTable).values(testUser).execute();

    // Create work order without any items
    const [workOrder] = await db.insert(workOrdersTable)
      .values({
        wo_number: 'WO-008',
        title: 'No Items Task',
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
        estimated_hours: '2.0',
        created_by: testUser.id
      })
      .returning()
      .execute();

    // Complete work order with no items (should work fine)
    const result = await completeWorkOrder(workOrder.id, 2.5, testUser.id);

    expect(result.status).toEqual('COMPLETED');
    expect(result.actual_hours).toEqual(2.5);
    expect(result.estimated_hours).toEqual(2.0);
    expect(result.completed_date).toBeInstanceOf(Date);

    // Verify no stock adjustments were created
    const stockAdjustments = await db.select()
      .from(stockAdjustmentsTable)
      .where(eq(stockAdjustmentsTable.reference_id, workOrder.id))
      .execute();

    expect(stockAdjustments).toHaveLength(0);
  });
});