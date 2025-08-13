import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, suppliersTable, purchaseOrdersTable } from '../db/schema';
import { getPurchaseOrders } from '../handlers/get_purchase_orders';

describe('getPurchaseOrders', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no purchase orders exist', async () => {
    const result = await getPurchaseOrders();
    expect(result).toEqual([]);
  });

  it('should return all purchase orders with proper type conversion', async () => {
    // Create test user
    const testUser = await db.insert(usersTable).values({
      id: 'user_1',
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      role: 'PURCHASING_STAFF'
    }).returning().execute();

    // Create test supplier
    const testSupplier = await db.insert(suppliersTable).values({
      name: 'Test Supplier',
      contact_person: 'John Doe',
      email: 'supplier@example.com',
      phone: '555-0123'
    }).returning().execute();

    // Create test purchase order with expected delivery date
    const expectedDate = '2024-12-31';
    const testPO = await db.insert(purchaseOrdersTable).values({
      po_number: 'PO-2024-001',
      supplier_id: testSupplier[0].id,
      status: 'DRAFT',
      total_amount: '1250.50',
      expected_delivery_date: expectedDate,
      notes: 'Test purchase order',
      created_by: testUser[0].id
    }).returning().execute();

    const result = await getPurchaseOrders();

    expect(result).toHaveLength(1);
    const purchaseOrder = result[0];
    
    // Verify basic fields
    expect(purchaseOrder.id).toBe(testPO[0].id);
    expect(purchaseOrder.po_number).toBe('PO-2024-001');
    expect(purchaseOrder.supplier_id).toBe(testSupplier[0].id);
    expect(purchaseOrder.status).toBe('DRAFT');
    expect(purchaseOrder.notes).toBe('Test purchase order');
    expect(purchaseOrder.created_by).toBe(testUser[0].id);
    
    // Verify numeric type conversion
    expect(typeof purchaseOrder.total_amount).toBe('number');
    expect(purchaseOrder.total_amount).toBe(1250.50);
    
    // Verify date fields and date conversion
    expect(purchaseOrder.order_date).toBeInstanceOf(Date);
    expect(purchaseOrder.created_at).toBeInstanceOf(Date);
    expect(purchaseOrder.updated_at).toBeInstanceOf(Date);
    expect(purchaseOrder.expected_delivery_date).toBeInstanceOf(Date);
    expect(purchaseOrder.expected_delivery_date?.toISOString().split('T')[0]).toBe('2024-12-31');
  });

  it('should return multiple purchase orders sorted by database order', async () => {
    // Create test user
    const testUser = await db.insert(usersTable).values({
      id: 'user_1',
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      role: 'PURCHASING_STAFF'
    }).returning().execute();

    // Create test suppliers
    const supplier1 = await db.insert(suppliersTable).values({
      name: 'Supplier One',
      email: 'supplier1@example.com'
    }).returning().execute();

    const supplier2 = await db.insert(suppliersTable).values({
      name: 'Supplier Two',
      email: 'supplier2@example.com'
    }).returning().execute();

    // Create multiple purchase orders
    await db.insert(purchaseOrdersTable).values([
      {
        po_number: 'PO-2024-001',
        supplier_id: supplier1[0].id,
        status: 'PENDING',
        total_amount: '500.00',
        created_by: testUser[0].id
      },
      {
        po_number: 'PO-2024-002',
        supplier_id: supplier2[0].id,
        status: 'APPROVED',
        total_amount: '750.25',
        created_by: testUser[0].id
      },
      {
        po_number: 'PO-2024-003',
        supplier_id: supplier1[0].id,
        status: 'ORDERED',
        total_amount: '1000.00',
        created_by: testUser[0].id
      }
    ]).execute();

    const result = await getPurchaseOrders();

    expect(result).toHaveLength(3);
    
    // Verify all purchase orders have correct types
    result.forEach(po => {
      expect(typeof po.total_amount).toBe('number');
      expect(po.order_date).toBeInstanceOf(Date);
      expect(po.created_at).toBeInstanceOf(Date);
      expect(po.updated_at).toBeInstanceOf(Date);
    });

    // Verify different suppliers and statuses
    const poNumbers = result.map(po => po.po_number);
    expect(poNumbers).toContain('PO-2024-001');
    expect(poNumbers).toContain('PO-2024-002');
    expect(poNumbers).toContain('PO-2024-003');

    const statuses = result.map(po => po.status);
    expect(statuses).toContain('PENDING');
    expect(statuses).toContain('APPROVED');
    expect(statuses).toContain('ORDERED');
  });

  it('should handle purchase orders with null optional fields', async () => {
    // Create test user
    const testUser = await db.insert(usersTable).values({
      id: 'user_1',
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      role: 'PURCHASING_STAFF'
    }).returning().execute();

    // Create test supplier
    const testSupplier = await db.insert(suppliersTable).values({
      name: 'Test Supplier'
    }).returning().execute();

    // Create purchase order with minimal fields (nulls for optional fields)
    await db.insert(purchaseOrdersTable).values({
      po_number: 'PO-2024-001',
      supplier_id: testSupplier[0].id,
      status: 'DRAFT',
      total_amount: '0.00',
      created_by: testUser[0].id,
      expected_delivery_date: null,
      notes: null,
      approved_by: null
    }).execute();

    const result = await getPurchaseOrders();

    expect(result).toHaveLength(1);
    const purchaseOrder = result[0];
    
    // Verify null fields are properly handled
    expect(purchaseOrder.expected_delivery_date).toBeNull();
    expect(purchaseOrder.notes).toBeNull();
    expect(purchaseOrder.approved_by).toBeNull();
    
    // Verify required fields still work
    expect(purchaseOrder.po_number).toBe('PO-2024-001');
    expect(purchaseOrder.status).toBe('DRAFT');
    expect(typeof purchaseOrder.total_amount).toBe('number');
    expect(purchaseOrder.total_amount).toBe(0.00);
  });

  it('should handle purchase orders with different statuses and amounts', async () => {
    // Create test user
    const testUser = await db.insert(usersTable).values({
      id: 'user_1',
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      role: 'PURCHASING_STAFF'
    }).returning().execute();

    // Create test supplier
    const testSupplier = await db.insert(suppliersTable).values({
      name: 'Test Supplier'
    }).returning().execute();

    // Create purchase orders with different statuses and amounts
    await db.insert(purchaseOrdersTable).values([
      {
        po_number: 'PO-2024-001',
        supplier_id: testSupplier[0].id,
        status: 'CANCELLED',
        total_amount: '99.99',
        created_by: testUser[0].id
      },
      {
        po_number: 'PO-2024-002',
        supplier_id: testSupplier[0].id,
        status: 'RECEIVED',
        total_amount: '1500.75',
        created_by: testUser[0].id
      }
    ]).execute();

    const result = await getPurchaseOrders();

    expect(result).toHaveLength(2);
    
    // Find each purchase order and verify
    const cancelledPO = result.find(po => po.status === 'CANCELLED');
    const receivedPO = result.find(po => po.status === 'RECEIVED');
    
    expect(cancelledPO).toBeDefined();
    expect(cancelledPO!.total_amount).toBe(99.99);
    
    expect(receivedPO).toBeDefined();
    expect(receivedPO!.total_amount).toBe(1500.75);
  });

  it('should properly convert date fields from strings to Date objects', async () => {
    // Create test user
    const testUser = await db.insert(usersTable).values({
      id: 'user_1',
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      role: 'PURCHASING_STAFF'
    }).returning().execute();

    // Create test supplier
    const testSupplier = await db.insert(suppliersTable).values({
      name: 'Test Supplier'
    }).returning().execute();

    // Create purchase order with specific expected delivery date
    const expectedDate = '2024-06-15';
    await db.insert(purchaseOrdersTable).values({
      po_number: 'PO-2024-001',
      supplier_id: testSupplier[0].id,
      status: 'PENDING',
      total_amount: '500.00',
      expected_delivery_date: expectedDate,
      created_by: testUser[0].id
    }).execute();

    const result = await getPurchaseOrders();

    expect(result).toHaveLength(1);
    const purchaseOrder = result[0];
    
    // Verify expected_delivery_date is converted to Date object
    expect(purchaseOrder.expected_delivery_date).toBeInstanceOf(Date);
    expect(purchaseOrder.expected_delivery_date?.toISOString().split('T')[0]).toBe('2024-06-15');
    
    // Verify other date fields are still Date objects
    expect(purchaseOrder.order_date).toBeInstanceOf(Date);
    expect(purchaseOrder.created_at).toBeInstanceOf(Date);
    expect(purchaseOrder.updated_at).toBeInstanceOf(Date);
  });

  it('should work with database that has only foreign key references', async () => {
    // Test that the query works even when we don't use the joined data
    // This ensures the LEFT JOINs don't interfere with the basic functionality
    
    // Create test user
    const testUser = await db.insert(usersTable).values({
      id: 'user_admin',
      email: 'admin@example.com',
      first_name: 'Admin',
      last_name: 'User',
      role: 'ADMIN'
    }).returning().execute();

    // Create test supplier
    const testSupplier = await db.insert(suppliersTable).values({
      name: 'Admin Supplier',
      contact_person: 'Jane Admin'
    }).returning().execute();

    // Create purchase order
    await db.insert(purchaseOrdersTable).values({
      po_number: 'PO-ADMIN-001',
      supplier_id: testSupplier[0].id,
      status: 'APPROVED',
      total_amount: '2000.00',
      notes: 'Admin purchase order',
      created_by: testUser[0].id
    }).execute();

    const result = await getPurchaseOrders();

    expect(result).toHaveLength(1);
    const po = result[0];
    
    // Verify that foreign key relationships are maintained
    expect(po.supplier_id).toBe(testSupplier[0].id);
    expect(po.created_by).toBe(testUser[0].id);
    expect(po.po_number).toBe('PO-ADMIN-001');
    expect(po.total_amount).toBe(2000.00);
    expect(po.notes).toBe('Admin purchase order');
  });
});