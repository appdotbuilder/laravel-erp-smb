import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, suppliersTable, purchaseOrdersTable } from '../db/schema';
import { getPurchaseOrderById } from '../handlers/get_purchase_order_by_id';

describe('getPurchaseOrderById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return purchase order by ID', async () => {
    // Create test user
    const testUser = await db.insert(usersTable)
      .values({
        id: 'user_123',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        role: 'PURCHASING_STAFF'
      })
      .returning()
      .execute();

    // Create test supplier
    const testSupplier = await db.insert(suppliersTable)
      .values({
        name: 'Test Supplier',
        contact_person: 'Jane Smith',
        email: 'supplier@example.com',
        phone: '123-456-7890'
      })
      .returning()
      .execute();

    // Create test purchase order
    const testPO = await db.insert(purchaseOrdersTable)
      .values({
        po_number: 'PO-2024-001',
        supplier_id: testSupplier[0].id,
        status: 'PENDING',
        total_amount: '1250.50',
        notes: 'Test purchase order',
        created_by: testUser[0].id
      })
      .returning()
      .execute();

    const result = await getPurchaseOrderById(testPO[0].id);

    expect(result).toBeDefined();
    expect(result!.id).toEqual(testPO[0].id);
    expect(result!.po_number).toEqual('PO-2024-001');
    expect(result!.supplier_id).toEqual(testSupplier[0].id);
    expect(result!.status).toEqual('PENDING');
    expect(result!.total_amount).toEqual(1250.50);
    expect(typeof result!.total_amount).toBe('number');
    expect(result!.notes).toEqual('Test purchase order');
    expect(result!.created_by).toEqual(testUser[0].id);
    expect(result!.order_date).toBeInstanceOf(Date);
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return null for non-existent purchase order', async () => {
    const result = await getPurchaseOrderById(999);
    
    expect(result).toBeNull();
  });

  it('should handle purchase order with null optional fields', async () => {
    // Create test user
    const testUser = await db.insert(usersTable)
      .values({
        id: 'user_456',
        email: 'test2@example.com',
        first_name: 'Alice',
        last_name: 'Johnson',
        role: 'ADMIN'
      })
      .returning()
      .execute();

    // Create test supplier
    const testSupplier = await db.insert(suppliersTable)
      .values({
        name: 'Minimal Supplier'
      })
      .returning()
      .execute();

    // Create purchase order with minimal data
    const testPO = await db.insert(purchaseOrdersTable)
      .values({
        po_number: 'PO-2024-002',
        supplier_id: testSupplier[0].id,
        created_by: testUser[0].id
      })
      .returning()
      .execute();

    const result = await getPurchaseOrderById(testPO[0].id);

    expect(result).toBeDefined();
    expect(result!.id).toEqual(testPO[0].id);
    expect(result!.po_number).toEqual('PO-2024-002');
    expect(result!.status).toEqual('DRAFT'); // Default value
    expect(result!.total_amount).toEqual(0); // Default value converted to number
    expect(typeof result!.total_amount).toBe('number');
    expect(result!.notes).toBeNull();
    expect(result!.expected_delivery_date).toBeNull();
    expect(result!.approved_by).toBeNull();
  });

  it('should handle purchase order with expected delivery date', async () => {
    // Create test user and supplier
    const testUser = await db.insert(usersTable)
      .values({
        id: 'user_789',
        email: 'test3@example.com',
        first_name: 'Bob',
        last_name: 'Wilson',
        role: 'WAREHOUSE_MANAGER'
      })
      .returning()
      .execute();

    const testSupplier = await db.insert(suppliersTable)
      .values({
        name: 'Date Test Supplier'
      })
      .returning()
      .execute();

    const expectedDate = new Date('2024-12-25');
    
    const testPO = await db.insert(purchaseOrdersTable)
      .values({
        po_number: 'PO-2024-003',
        supplier_id: testSupplier[0].id,
        expected_delivery_date: '2024-12-25', // Date string format for database
        total_amount: '999.99',
        created_by: testUser[0].id
      })
      .returning()
      .execute();

    const result = await getPurchaseOrderById(testPO[0].id);

    expect(result).toBeDefined();
    expect(result!.expected_delivery_date).toEqual(expectedDate);
    expect(result!.total_amount).toEqual(999.99);
    expect(typeof result!.total_amount).toBe('number');
  });

  it('should handle purchase order with approved_by field', async () => {
    // Create test users
    const creator = await db.insert(usersTable)
      .values({
        id: 'creator_001',
        email: 'creator@example.com',
        first_name: 'Creator',
        last_name: 'User',
        role: 'PURCHASING_STAFF'
      })
      .returning()
      .execute();

    const approver = await db.insert(usersTable)
      .values({
        id: 'approver_001',
        email: 'approver@example.com',
        first_name: 'Approver',
        last_name: 'Manager',
        role: 'WAREHOUSE_MANAGER'
      })
      .returning()
      .execute();

    const testSupplier = await db.insert(suppliersTable)
      .values({
        name: 'Approval Test Supplier'
      })
      .returning()
      .execute();

    const testPO = await db.insert(purchaseOrdersTable)
      .values({
        po_number: 'PO-2024-004',
        supplier_id: testSupplier[0].id,
        status: 'APPROVED',
        total_amount: '2500.75',
        created_by: creator[0].id,
        approved_by: approver[0].id
      })
      .returning()
      .execute();

    const result = await getPurchaseOrderById(testPO[0].id);

    expect(result).toBeDefined();
    expect(result!.status).toEqual('APPROVED');
    expect(result!.created_by).toEqual(creator[0].id);
    expect(result!.approved_by).toEqual(approver[0].id);
    expect(result!.total_amount).toEqual(2500.75);
    expect(typeof result!.total_amount).toBe('number');
  });
});