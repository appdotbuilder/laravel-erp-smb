import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workOrdersTable, workOrderItemsTable, itemsTable } from '../db/schema';
import { type CreateWorkOrderInput } from '../schema';
import { createWorkOrder } from '../handlers/create_work_order';
import { eq, and } from 'drizzle-orm';

// Test user data
const testUser = {
  id: 'test_user_123',
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  role: 'WAREHOUSE_MANAGER' as const
};

const testTechnician = {
  id: 'tech_user_456',
  email: 'tech@example.com',
  first_name: 'Tech',
  last_name: 'User',
  role: 'TECHNICIAN' as const
};

// Test item data
const testItem = {
  name: 'Test Item',
  description: 'A test inventory item',
  sku: 'TST-001',
  category: 'Test Category',
  unit_of_measure: 'pieces',
  current_stock: 50,
  min_stock_level: 10,
  unit_cost: '25.99'
};

// Simple test input
const testInput: CreateWorkOrderInput = {
  title: 'Test Work Order',
  description: 'A work order for testing',
  priority: 'MEDIUM',
  assigned_to: 'tech_user_456',
  estimated_hours: 8.5,
  due_date: new Date('2024-12-31'),
  items: [
    {
      item_id: 1,
      quantity_planned: 5
    }
  ]
};

describe('createWorkOrder', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a work order with all fields', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values([testUser, testTechnician]).execute();
    const itemResult = await db.insert(itemsTable).values({
      ...testItem,
      unit_cost: testItem.unit_cost
    }).returning().execute();
    const createdItem = itemResult[0];

    // Update test input to use actual item ID
    const inputWithCorrectItemId = {
      ...testInput,
      items: [{ item_id: createdItem.id, quantity_planned: 5 }]
    };

    const result = await createWorkOrder(inputWithCorrectItemId, testUser.id);

    // Basic field validation
    expect(result.title).toEqual('Test Work Order');
    expect(result.description).toEqual('A work order for testing');
    expect(result.status).toEqual('CREATED');
    expect(result.priority).toEqual('MEDIUM');
    expect(result.assigned_to).toEqual('tech_user_456');
    expect(result.estimated_hours).toEqual(8.5);
    expect(typeof result.estimated_hours).toBe('number');
    expect(result.actual_hours).toBeNull();
    expect(result.due_date).toEqual(new Date('2024-12-31T00:00:00.000Z'));
    expect(result.completed_date).toBeNull();
    expect(result.created_by).toEqual(testUser.id);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should generate unique WO number', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values(testUser).execute();

    const inputWithoutItems = {
      title: 'Test WO 1',
      priority: 'HIGH' as const
    };

    const result1 = await createWorkOrder(inputWithoutItems, testUser.id);
    const result2 = await createWorkOrder(inputWithoutItems, testUser.id);

    // Both should have WO numbers in correct format
    expect(result1.wo_number).toMatch(/^WO-\d{4}-\d{6}$/);
    expect(result2.wo_number).toMatch(/^WO-\d{4}-\d{6}$/);
    
    // WO numbers should be different and sequential
    expect(result1.wo_number).not.toEqual(result2.wo_number);
    
    const currentYear = new Date().getFullYear();
    expect(result1.wo_number).toEqual(`WO-${currentYear}-000001`);
    expect(result2.wo_number).toEqual(`WO-${currentYear}-000002`);
  });

  it('should save work order to database', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values(testUser).execute();

    const inputWithoutItems = {
      title: 'Database Test WO',
      priority: 'LOW' as const,
      description: 'Testing database save'
    };

    const result = await createWorkOrder(inputWithoutItems, testUser.id);

    // Query database to verify
    const workOrders = await db.select()
      .from(workOrdersTable)
      .where(eq(workOrdersTable.id, result.id))
      .execute();

    expect(workOrders).toHaveLength(1);
    expect(workOrders[0].title).toEqual('Database Test WO');
    expect(workOrders[0].description).toEqual('Testing database save');
    expect(workOrders[0].priority).toEqual('LOW');
    expect(workOrders[0].status).toEqual('CREATED');
    expect(workOrders[0].created_by).toEqual(testUser.id);
    expect(workOrders[0].created_at).toBeInstanceOf(Date);
  });

  it('should create work order items when provided', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values([testUser, testTechnician]).execute();
    const itemResult = await db.insert(itemsTable).values({
      ...testItem,
      unit_cost: testItem.unit_cost
    }).returning().execute();
    const createdItem = itemResult[0];

    const inputWithItems = {
      title: 'WO with Items',
      priority: 'HIGH' as const,
      items: [
        { item_id: createdItem.id, quantity_planned: 10 },
        { item_id: createdItem.id, quantity_planned: 5 }
      ]
    };

    const result = await createWorkOrder(inputWithItems, testUser.id);

    // Query work order items
    const woItems = await db.select()
      .from(workOrderItemsTable)
      .where(eq(workOrderItemsTable.work_order_id, result.id))
      .execute();

    expect(woItems).toHaveLength(2);
    expect(woItems[0].item_id).toEqual(createdItem.id);
    expect(woItems[0].quantity_planned).toEqual(10);
    expect(woItems[0].quantity_used).toEqual(0);
    expect(woItems[1].quantity_planned).toEqual(5);
  });

  it('should work without optional fields', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values(testUser).execute();

    const minimalInput = {
      title: 'Minimal WO',
      priority: 'URGENT' as const
    };

    const result = await createWorkOrder(minimalInput, testUser.id);

    expect(result.title).toEqual('Minimal WO');
    expect(result.priority).toEqual('URGENT');
    expect(result.description).toBeNull();
    expect(result.assigned_to).toBeNull();
    expect(result.estimated_hours).toBeNull();
    expect(result.due_date).toBeNull();
    expect(result.status).toEqual('CREATED');
    expect(result.created_by).toEqual(testUser.id);
    expect(result.id).toBeDefined();
  });

  it('should handle numeric field conversions correctly', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values(testUser).execute();

    const inputWithNumbers = {
      title: 'Numeric Test WO',
      priority: 'MEDIUM' as const,
      estimated_hours: 12.75
    };

    const result = await createWorkOrder(inputWithNumbers, testUser.id);

    // Verify numeric conversion
    expect(result.estimated_hours).toEqual(12.75);
    expect(typeof result.estimated_hours).toBe('number');

    // Verify in database (stored as string)
    const woFromDb = await db.select()
      .from(workOrdersTable)
      .where(eq(workOrdersTable.id, result.id))
      .execute();

    expect(typeof woFromDb[0].estimated_hours).toBe('string');
    expect(parseFloat(woFromDb[0].estimated_hours!)).toEqual(12.75);
  });

  it('should handle invalid item references', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values(testUser).execute();

    const inputWithInvalidItem = {
      title: 'Invalid Item WO',
      priority: 'HIGH' as const,
      items: [
        { item_id: 999, quantity_planned: 5 } // Non-existent item
      ]
    };

    await expect(createWorkOrder(inputWithInvalidItem, testUser.id))
      .rejects.toThrow();
  });

  it('should handle invalid user references', async () => {
    const inputWithValidData = {
      title: 'Invalid User WO',
      priority: 'LOW' as const
    };

    // No users created - should fail with foreign key constraint
    await expect(createWorkOrder(inputWithValidData, 'non_existent_user'))
      .rejects.toThrow();
  });

  it('should maintain transaction integrity on failure', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values(testUser).execute();

    const inputWithInvalidItem = {
      title: 'Transaction Test WO',
      priority: 'MEDIUM' as const,
      items: [
        { item_id: 999, quantity_planned: 3 } // Invalid item reference
      ]
    };

    try {
      await createWorkOrder(inputWithInvalidItem, testUser.id);
    } catch (error) {
      // Expected to fail
    }

    // Verify no work order was created despite valid WO data
    const workOrders = await db.select()
      .from(workOrdersTable)
      .where(eq(workOrdersTable.title, 'Transaction Test WO'))
      .execute();

    expect(workOrders).toHaveLength(0);
  });
});