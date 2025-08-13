import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, itemsTable, workOrdersTable, workOrderItemsTable, stockAdjustmentsTable } from '../db/schema';
import { type UpdateWorkOrderInput } from '../schema';
import { updateWorkOrder } from '../handlers/update_work_order';
import { eq } from 'drizzle-orm';

describe('updateWorkOrder', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update basic work order fields', async () => {
    // Create test user
    const user = await db.insert(usersTable)
      .values({
        id: 'user-1',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        role: 'TECHNICIAN'
      })
      .returning()
      .execute();

    // Create test work order
    const workOrder = await db.insert(workOrdersTable)
      .values({
        wo_number: 'WO-001',
        title: 'Original Title',
        description: 'Original description',
        status: 'CREATED',
        priority: 'MEDIUM',
        created_by: user[0].id
      })
      .returning()
      .execute();

    const input: UpdateWorkOrderInput = {
      id: workOrder[0].id,
      title: 'Updated Title',
      description: 'Updated description',
      priority: 'HIGH',
      estimated_hours: 4.5
    };

    const result = await updateWorkOrder(input);

    expect(result.id).toEqual(workOrder[0].id);
    expect(result.title).toEqual('Updated Title');
    expect(result.description).toEqual('Updated description');
    expect(result.priority).toEqual('HIGH');
    expect(result.estimated_hours).toEqual(4.5);
    expect(result.status).toEqual('CREATED'); // Should remain unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update work order status without completion logic', async () => {
    // Create test user
    const user = await db.insert(usersTable)
      .values({
        id: 'user-1',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        role: 'TECHNICIAN'
      })
      .returning()
      .execute();

    // Create test work order
    const workOrder = await db.insert(workOrdersTable)
      .values({
        wo_number: 'WO-001',
        title: 'Test Work Order',
        status: 'CREATED',
        priority: 'MEDIUM',
        created_by: user[0].id
      })
      .returning()
      .execute();

    const input: UpdateWorkOrderInput = {
      id: workOrder[0].id,
      status: 'IN_PROGRESS',
      actual_hours: 2.5
    };

    const result = await updateWorkOrder(input);

    expect(result.status).toEqual('IN_PROGRESS');
    expect(result.actual_hours).toEqual(2.5);
    expect(result.completed_date).toBeNull();
  });

  it('should complete work order and deduct inventory with stock adjustments', async () => {
    // Create test user
    const user = await db.insert(usersTable)
      .values({
        id: 'user-1',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        role: 'TECHNICIAN'
      })
      .returning()
      .execute();

    // Create test items
    const items = await db.insert(itemsTable)
      .values([
        {
          name: 'Screws',
          sku: 'SCR-001',
          category: 'Hardware',
          unit_of_measure: 'pieces',
          current_stock: 100,
          min_stock_level: 10,
          unit_cost: '0.50'
        },
        {
          name: 'Bolts',
          sku: 'BOL-001',
          category: 'Hardware',
          unit_of_measure: 'pieces',
          current_stock: 50,
          min_stock_level: 5,
          unit_cost: '1.25'
        }
      ])
      .returning()
      .execute();

    // Create test work order
    const workOrder = await db.insert(workOrdersTable)
      .values({
        wo_number: 'WO-001',
        title: 'Test Work Order',
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
        created_by: user[0].id
      })
      .returning()
      .execute();

    // Create work order items
    await db.insert(workOrderItemsTable)
      .values([
        {
          work_order_id: workOrder[0].id,
          item_id: items[0].id,
          quantity_planned: 20,
          quantity_used: 15
        },
        {
          work_order_id: workOrder[0].id,
          item_id: items[1].id,
          quantity_planned: 10,
          quantity_used: 8
        }
      ])
      .execute();

    const input: UpdateWorkOrderInput = {
      id: workOrder[0].id,
      status: 'COMPLETED',
      actual_hours: 3.5
    };

    const result = await updateWorkOrder(input);

    // Verify work order is completed
    expect(result.status).toEqual('COMPLETED');
    expect(result.actual_hours).toEqual(3.5);
    expect(result.completed_date).toBeInstanceOf(Date);

    // Verify inventory was deducted
    const updatedItems = await db.select()
      .from(itemsTable)
      .where(eq(itemsTable.id, items[0].id))
      .execute();

    expect(updatedItems[0].current_stock).toEqual(85); // 100 - 15

    const updatedItems2 = await db.select()
      .from(itemsTable)
      .where(eq(itemsTable.id, items[1].id))
      .execute();

    expect(updatedItems2[0].current_stock).toEqual(42); // 50 - 8

    // Verify stock adjustment records were created
    const stockAdjustments = await db.select()
      .from(stockAdjustmentsTable)
      .execute();

    expect(stockAdjustments).toHaveLength(2);
    
    const screwAdjustment = stockAdjustments.find(adj => adj.item_id === items[0].id);
    expect(screwAdjustment).toBeDefined();
    expect(screwAdjustment?.adjustment_type).toEqual('CONSUMED');
    expect(screwAdjustment?.quantity_change).toEqual(-15);
    expect(screwAdjustment?.previous_stock).toEqual(100);
    expect(screwAdjustment?.new_stock).toEqual(85);
    expect(screwAdjustment?.reference_id).toEqual(workOrder[0].id);
    expect(screwAdjustment?.reference_type).toEqual('work_order');
    expect(screwAdjustment?.reason).toContain('WO-001');

    const boltAdjustment = stockAdjustments.find(adj => adj.item_id === items[1].id);
    expect(boltAdjustment).toBeDefined();
    expect(boltAdjustment?.adjustment_type).toEqual('CONSUMED');
    expect(boltAdjustment?.quantity_change).toEqual(-8);
    expect(boltAdjustment?.previous_stock).toEqual(50);
    expect(boltAdjustment?.new_stock).toEqual(42);
  });

  it('should not deduct inventory when completing already completed work order', async () => {
    // Create test user
    const user = await db.insert(usersTable)
      .values({
        id: 'user-1',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        role: 'TECHNICIAN'
      })
      .returning()
      .execute();

    // Create test item
    const item = await db.insert(itemsTable)
      .values({
        name: 'Screws',
        sku: 'SCR-001',
        category: 'Hardware',
        unit_of_measure: 'pieces',
        current_stock: 100,
        min_stock_level: 10,
        unit_cost: '0.50'
      })
      .returning()
      .execute();

    // Create already completed work order
    const workOrder = await db.insert(workOrdersTable)
      .values({
        wo_number: 'WO-001',
        title: 'Test Work Order',
        status: 'COMPLETED',
        priority: 'MEDIUM',
        created_by: user[0].id,
        completed_date: new Date('2024-01-01')
      })
      .returning()
      .execute();

    // Create work order item
    await db.insert(workOrderItemsTable)
      .values({
        work_order_id: workOrder[0].id,
        item_id: item[0].id,
        quantity_planned: 20,
        quantity_used: 15
      })
      .execute();

    const input: UpdateWorkOrderInput = {
      id: workOrder[0].id,
      status: 'COMPLETED',
      actual_hours: 3.5
    };

    const result = await updateWorkOrder(input);

    // Verify work order was updated but inventory unchanged
    expect(result.status).toEqual('COMPLETED');
    expect(result.actual_hours).toEqual(3.5);

    // Verify inventory was NOT deducted (should still be 100)
    const updatedItem = await db.select()
      .from(itemsTable)
      .where(eq(itemsTable.id, item[0].id))
      .execute();

    expect(updatedItem[0].current_stock).toEqual(100);

    // Verify no new stock adjustment records were created
    const stockAdjustments = await db.select()
      .from(stockAdjustmentsTable)
      .execute();

    expect(stockAdjustments).toHaveLength(0);
  });

  it('should handle work order with zero quantity used items', async () => {
    // Create test user
    const user = await db.insert(usersTable)
      .values({
        id: 'user-1',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        role: 'TECHNICIAN'
      })
      .returning()
      .execute();

    // Create test item
    const item = await db.insert(itemsTable)
      .values({
        name: 'Screws',
        sku: 'SCR-001',
        category: 'Hardware',
        unit_of_measure: 'pieces',
        current_stock: 100,
        min_stock_level: 10,
        unit_cost: '0.50'
      })
      .returning()
      .execute();

    // Create test work order
    const workOrder = await db.insert(workOrdersTable)
      .values({
        wo_number: 'WO-001',
        title: 'Test Work Order',
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
        created_by: user[0].id
      })
      .returning()
      .execute();

    // Create work order item with zero quantity used
    await db.insert(workOrderItemsTable)
      .values({
        work_order_id: workOrder[0].id,
        item_id: item[0].id,
        quantity_planned: 20,
        quantity_used: 0 // Zero quantity used
      })
      .execute();

    const input: UpdateWorkOrderInput = {
      id: workOrder[0].id,
      status: 'COMPLETED'
    };

    const result = await updateWorkOrder(input);

    // Verify work order is completed
    expect(result.status).toEqual('COMPLETED');

    // Verify inventory was NOT changed
    const updatedItem = await db.select()
      .from(itemsTable)
      .where(eq(itemsTable.id, item[0].id))
      .execute();

    expect(updatedItem[0].current_stock).toEqual(100);

    // Verify no stock adjustment records were created
    const stockAdjustments = await db.select()
      .from(stockAdjustmentsTable)
      .execute();

    expect(stockAdjustments).toHaveLength(0);
  });

  it('should throw error when work order not found', async () => {
    const input: UpdateWorkOrderInput = {
      id: 999,
      title: 'Updated Title'
    };

    expect(updateWorkOrder(input)).rejects.toThrow(/Work order with id 999 not found/);
  });

  it('should throw error when insufficient stock for completion', async () => {
    // Create test user
    const user = await db.insert(usersTable)
      .values({
        id: 'user-1',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        role: 'TECHNICIAN'
      })
      .returning()
      .execute();

    // Create test item with low stock
    const item = await db.insert(itemsTable)
      .values({
        name: 'Screws',
        sku: 'SCR-001',
        category: 'Hardware',
        unit_of_measure: 'pieces',
        current_stock: 5, // Low stock
        min_stock_level: 10,
        unit_cost: '0.50'
      })
      .returning()
      .execute();

    // Create test work order
    const workOrder = await db.insert(workOrdersTable)
      .values({
        wo_number: 'WO-001',
        title: 'Test Work Order',
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
        created_by: user[0].id
      })
      .returning()
      .execute();

    // Create work order item requiring more than available stock
    await db.insert(workOrderItemsTable)
      .values({
        work_order_id: workOrder[0].id,
        item_id: item[0].id,
        quantity_planned: 20,
        quantity_used: 10 // More than available stock of 5
      })
      .execute();

    const input: UpdateWorkOrderInput = {
      id: workOrder[0].id,
      status: 'COMPLETED'
    };

    expect(updateWorkOrder(input)).rejects.toThrow(/Insufficient stock for item Screws/);
  });

  it('should handle work order with no items when completing', async () => {
    // Create test user
    const user = await db.insert(usersTable)
      .values({
        id: 'user-1',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        role: 'TECHNICIAN'
      })
      .returning()
      .execute();

    // Create test work order with no items
    const workOrder = await db.insert(workOrdersTable)
      .values({
        wo_number: 'WO-001',
        title: 'Test Work Order',
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
        created_by: user[0].id
      })
      .returning()
      .execute();

    const input: UpdateWorkOrderInput = {
      id: workOrder[0].id,
      status: 'COMPLETED',
      actual_hours: 2.0
    };

    const result = await updateWorkOrder(input);

    // Should complete successfully even with no items
    expect(result.status).toEqual('COMPLETED');
    expect(result.actual_hours).toEqual(2.0);
    expect(result.completed_date).toBeInstanceOf(Date);

    // Verify no stock adjustments were created
    const stockAdjustments = await db.select()
      .from(stockAdjustmentsTable)
      .execute();

    expect(stockAdjustments).toHaveLength(0);
  });
});