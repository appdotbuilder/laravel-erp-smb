import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { workOrdersTable, usersTable } from '../db/schema';
import { getWorkOrders } from '../handlers/get_work_orders';

const testUser = {
  id: 'user_test123',
  email: 'test@example.com',
  first_name: 'John',
  last_name: 'Doe',
  role: 'TECHNICIAN' as const
};

const testWorkOrder = {
  wo_number: 'WO-001',
  title: 'Test Work Order',
  description: 'A work order for testing',
  status: 'CREATED' as const,
  priority: 'MEDIUM' as const,
  assigned_to: 'user_test123',
  estimated_hours: '8.50',
  actual_hours: null,
  due_date: '2024-01-15', // Database expects string for date field
  completed_date: null,
  created_by: 'user_test123'
};

describe('getWorkOrders', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no work orders exist', async () => {
    const result = await getWorkOrders();
    expect(result).toEqual([]);
  });

  it('should return all work orders with correct fields', async () => {
    // Create prerequisite user
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    // Create test work order
    await db.insert(workOrdersTable)
      .values(testWorkOrder)
      .execute();

    const result = await getWorkOrders();

    expect(result).toHaveLength(1);
    expect(result[0].wo_number).toEqual('WO-001');
    expect(result[0].title).toEqual('Test Work Order');
    expect(result[0].description).toEqual('A work order for testing');
    expect(result[0].status).toEqual('CREATED');
    expect(result[0].priority).toEqual('MEDIUM');
    expect(result[0].assigned_to).toEqual('user_test123');
    expect(result[0].created_by).toEqual('user_test123');
    expect(result[0].id).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);
  });

  it('should convert numeric fields to numbers', async () => {
    // Create prerequisite user
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    // Create work order with numeric values
    await db.insert(workOrdersTable)
      .values({
        ...testWorkOrder,
        estimated_hours: '12.75',
        actual_hours: '10.25'
      })
      .execute();

    const result = await getWorkOrders();

    expect(result).toHaveLength(1);
    expect(result[0].estimated_hours).toEqual(12.75);
    expect(typeof result[0].estimated_hours).toEqual('number');
    expect(result[0].actual_hours).toEqual(10.25);
    expect(typeof result[0].actual_hours).toEqual('number');
  });

  it('should handle null numeric fields', async () => {
    // Create prerequisite user
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    // Create work order with null numeric values
    await db.insert(workOrdersTable)
      .values({
        ...testWorkOrder,
        estimated_hours: null,
        actual_hours: null
      })
      .execute();

    const result = await getWorkOrders();

    expect(result).toHaveLength(1);
    expect(result[0].estimated_hours).toBeNull();
    expect(result[0].actual_hours).toBeNull();
  });

  it('should return multiple work orders', async () => {
    // Create prerequisite users
    await db.insert(usersTable)
      .values([
        testUser,
        {
          id: 'user_test456',
          email: 'admin@example.com',
          first_name: 'Jane',
          last_name: 'Admin',
          role: 'ADMIN' as const
        }
      ])
      .execute();

    // Create multiple work orders
    await db.insert(workOrdersTable)
      .values([
        testWorkOrder,
        {
          wo_number: 'WO-002',
          title: 'Second Work Order',
          description: 'Another test work order',
          status: 'IN_PROGRESS' as const,
          priority: 'HIGH' as const,
          assigned_to: 'user_test456',
          estimated_hours: '16.00',
          actual_hours: '8.00',
          due_date: '2024-01-20', // Database expects string for date field
          completed_date: null,
          created_by: 'user_test456'
        }
      ])
      .execute();

    const result = await getWorkOrders();

    expect(result).toHaveLength(2);
    
    // Check first work order
    const firstWO = result.find(wo => wo.wo_number === 'WO-001');
    expect(firstWO).toBeDefined();
    expect(firstWO?.title).toEqual('Test Work Order');
    expect(firstWO?.status).toEqual('CREATED');
    expect(firstWO?.priority).toEqual('MEDIUM');

    // Check second work order
    const secondWO = result.find(wo => wo.wo_number === 'WO-002');
    expect(secondWO).toBeDefined();
    expect(secondWO?.title).toEqual('Second Work Order');
    expect(secondWO?.status).toEqual('IN_PROGRESS');
    expect(secondWO?.priority).toEqual('HIGH');
    expect(secondWO?.estimated_hours).toEqual(16);
    expect(secondWO?.actual_hours).toEqual(8);
  });

  it('should handle work orders with different statuses and priorities', async () => {
    // Create prerequisite user
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    // Create work orders with different statuses and priorities
    await db.insert(workOrdersTable)
      .values([
        {
          ...testWorkOrder,
          wo_number: 'WO-COMPLETED',
          status: 'COMPLETED' as const,
          priority: 'URGENT' as const,
          completed_date: new Date('2024-01-10') // timestamp field accepts Date objects
        },
        {
          ...testWorkOrder,
          wo_number: 'WO-CANCELLED',
          status: 'CANCELLED' as const,
          priority: 'LOW' as const
        }
      ])
      .execute();

    const result = await getWorkOrders();

    expect(result).toHaveLength(2);
    
    const completedWO = result.find(wo => wo.wo_number === 'WO-COMPLETED');
    expect(completedWO?.status).toEqual('COMPLETED');
    expect(completedWO?.priority).toEqual('URGENT');
    expect(completedWO?.completed_date).toBeInstanceOf(Date);

    const cancelledWO = result.find(wo => wo.wo_number === 'WO-CANCELLED');
    expect(cancelledWO?.status).toEqual('CANCELLED');
    expect(cancelledWO?.priority).toEqual('LOW');
  });

  it('should handle work orders with null assigned_to', async () => {
    // Create prerequisite user
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    // Create work order with no assignment
    await db.insert(workOrdersTable)
      .values({
        ...testWorkOrder,
        assigned_to: null
      })
      .execute();

    const result = await getWorkOrders();

    expect(result).toHaveLength(1);
    expect(result[0].assigned_to).toBeNull();
    expect(result[0].created_by).toEqual('user_test123');
  });

  it('should convert date fields properly', async () => {
    // Create prerequisite user
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    // Create work order with due date
    await db.insert(workOrdersTable)
      .values({
        ...testWorkOrder,
        due_date: '2024-01-15'
      })
      .execute();

    const result = await getWorkOrders();

    expect(result).toHaveLength(1);
    expect(result[0].due_date).toBeInstanceOf(Date);
    expect(result[0].due_date?.toISOString()).toMatch(/2024-01-15/);
  });
});