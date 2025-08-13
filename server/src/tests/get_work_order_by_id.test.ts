import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workOrdersTable } from '../db/schema';
import { getWorkOrderById } from '../handlers/get_work_order_by_id';

describe('getWorkOrderById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return a work order by id', async () => {
    // Create test user first
    const testUser = await db.insert(usersTable)
      .values({
        id: 'test_user_123',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        role: 'TECHNICIAN',
        is_active: true
      })
      .returning()
      .execute();

    // Create test work order
    const testWorkOrder = await db.insert(workOrdersTable)
      .values({
        wo_number: 'WO-001',
        title: 'Test Work Order',
        description: 'A work order for testing',
        status: 'CREATED',
        priority: 'HIGH',
        assigned_to: testUser[0].id,
        estimated_hours: '10.5',
        actual_hours: '8.25',
        due_date: '2024-12-31',
        created_by: testUser[0].id
      })
      .returning()
      .execute();

    const result = await getWorkOrderById(testWorkOrder[0].id);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(testWorkOrder[0].id);
    expect(result!.wo_number).toEqual('WO-001');
    expect(result!.title).toEqual('Test Work Order');
    expect(result!.description).toEqual('A work order for testing');
    expect(result!.status).toEqual('CREATED');
    expect(result!.priority).toEqual('HIGH');
    expect(result!.assigned_to).toEqual(testUser[0].id);
    expect(result!.created_by).toEqual(testUser[0].id);
    expect(result!.due_date).toBeInstanceOf(Date);
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);

    // Verify numeric conversions
    expect(typeof result!.estimated_hours).toBe('number');
    expect(result!.estimated_hours).toEqual(10.5);
    expect(typeof result!.actual_hours).toBe('number');
    expect(result!.actual_hours).toEqual(8.25);
  });

  it('should return null for non-existent work order', async () => {
    const result = await getWorkOrderById(999);
    expect(result).toBeNull();
  });

  it('should handle work order with null optional fields', async () => {
    // Create test user first
    const testUser = await db.insert(usersTable)
      .values({
        id: 'test_user_456',
        email: 'test2@example.com',
        first_name: 'Test2',
        last_name: 'User2',
        role: 'ADMIN',
        is_active: true
      })
      .returning()
      .execute();

    // Create work order with minimal required fields
    const testWorkOrder = await db.insert(workOrdersTable)
      .values({
        wo_number: 'WO-002',
        title: 'Minimal Work Order',
        status: 'CREATED',
        priority: 'LOW',
        created_by: testUser[0].id
      })
      .returning()
      .execute();

    const result = await getWorkOrderById(testWorkOrder[0].id);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(testWorkOrder[0].id);
    expect(result!.wo_number).toEqual('WO-002');
    expect(result!.title).toEqual('Minimal Work Order');
    expect(result!.description).toBeNull();
    expect(result!.assigned_to).toBeNull();
    expect(result!.estimated_hours).toBeNull();
    expect(result!.actual_hours).toBeNull();
    expect(result!.due_date).toBeNull();
    expect(result!.completed_date).toBeNull();
    expect(result!.created_by).toEqual(testUser[0].id);
  });

  it('should handle work order with zero numeric values', async () => {
    // Create test user first
    const testUser = await db.insert(usersTable)
      .values({
        id: 'test_user_789',
        email: 'test3@example.com',
        first_name: 'Test3',
        last_name: 'User3',
        role: 'WAREHOUSE_MANAGER',
        is_active: true
      })
      .returning()
      .execute();

    // Create work order with zero hours
    const testWorkOrder = await db.insert(workOrdersTable)
      .values({
        wo_number: 'WO-003',
        title: 'Zero Hours Work Order',
        status: 'COMPLETED',
        priority: 'MEDIUM',
        estimated_hours: '0',
        actual_hours: '0',
        created_by: testUser[0].id
      })
      .returning()
      .execute();

    const result = await getWorkOrderById(testWorkOrder[0].id);

    expect(result).not.toBeNull();
    expect(result!.estimated_hours).toEqual(0);
    expect(result!.actual_hours).toEqual(0);
    expect(typeof result!.estimated_hours).toBe('number');
    expect(typeof result!.actual_hours).toBe('number');
  });

  it('should retrieve work order with all status values', async () => {
    // Create test user first
    const testUser = await db.insert(usersTable)
      .values({
        id: 'test_user_status',
        email: 'status@example.com',
        first_name: 'Status',
        last_name: 'Test',
        role: 'TECHNICIAN',
        is_active: true
      })
      .returning()
      .execute();

    const statuses = ['CREATED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
    const workOrderIds: number[] = [];

    // Create work orders with different statuses
    for (const status of statuses) {
      const workOrder = await db.insert(workOrdersTable)
        .values({
          wo_number: `WO-${status}`,
          title: `${status} Work Order`,
          status,
          priority: 'MEDIUM',
          created_by: testUser[0].id
        })
        .returning()
        .execute();
      
      workOrderIds.push(workOrder[0].id);
    }

    // Verify each status is handled correctly
    for (let i = 0; i < statuses.length; i++) {
      const result = await getWorkOrderById(workOrderIds[i]);
      expect(result).not.toBeNull();
      expect(result!.status).toEqual(statuses[i]);
    }
  });

  it('should retrieve work order with all priority levels', async () => {
    // Create test user first
    const testUser = await db.insert(usersTable)
      .values({
        id: 'test_user_priority',
        email: 'priority@example.com',
        first_name: 'Priority',
        last_name: 'Test',
        role: 'PURCHASING_STAFF',
        is_active: true
      })
      .returning()
      .execute();

    const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
    const workOrderIds: number[] = [];

    // Create work orders with different priorities
    for (const priority of priorities) {
      const workOrder = await db.insert(workOrdersTable)
        .values({
          wo_number: `WO-${priority}`,
          title: `${priority} Priority Work Order`,
          status: 'CREATED',
          priority,
          created_by: testUser[0].id
        })
        .returning()
        .execute();
      
      workOrderIds.push(workOrder[0].id);
    }

    // Verify each priority is handled correctly
    for (let i = 0; i < priorities.length; i++) {
      const result = await getWorkOrderById(workOrderIds[i]);
      expect(result).not.toBeNull();
      expect(result!.priority).toEqual(priorities[i]);
    }
  });
});