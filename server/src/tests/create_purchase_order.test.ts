import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, suppliersTable, itemsTable, purchaseOrdersTable, purchaseOrderItemsTable } from '../db/schema';
import { type CreatePurchaseOrderInput } from '../schema';
import { createPurchaseOrder } from '../handlers/create_purchase_order';
import { eq } from 'drizzle-orm';

describe('createPurchaseOrder', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const testUser = {
    id: 'user_123',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    role: 'PURCHASING_STAFF' as const,
    is_active: true
  };

  const testSupplier = {
    name: 'Test Supplier',
    contact_person: 'John Doe',
    email: 'john@supplier.com',
    phone: '123-456-7890',
    address: '123 Main St',
    is_active: true
  };

  const testItem1 = {
    name: 'Test Item 1',
    description: 'First test item',
    sku: 'TEST-001',
    category: 'Hardware',
    unit_of_measure: 'pieces',
    current_stock: 50,
    min_stock_level: 10,
    unit_cost: '15.99', // Convert to string for numeric column
    is_active: true
  };

  const testItem2 = {
    name: 'Test Item 2',
    description: 'Second test item',
    sku: 'TEST-002',
    category: 'Software',
    unit_of_measure: 'licenses',
    current_stock: 5,
    min_stock_level: 2,
    unit_cost: '99.99', // Convert to string for numeric column
    is_active: true
  };

  it('should create a purchase order with items', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values(testUser).execute();
    
    const supplierResult = await db.insert(suppliersTable).values(testSupplier).returning().execute();
    const supplier = supplierResult[0];

    const itemsResult = await db.insert(itemsTable).values([testItem1, testItem2]).returning().execute();
    const [item1, item2] = itemsResult;

    const testInput: CreatePurchaseOrderInput = {
      supplier_id: supplier.id,
      expected_delivery_date: new Date('2024-12-31'),
      notes: 'Test purchase order',
      items: [
        {
          item_id: item1.id,
          quantity: 10,
          unit_price: 15.50
        },
        {
          item_id: item2.id,
          quantity: 2,
          unit_price: 95.00
        }
      ]
    };

    const result = await createPurchaseOrder(testInput, testUser.id);

    // Verify purchase order fields
    expect(result.supplier_id).toEqual(supplier.id);
    expect(result.status).toEqual('DRAFT');
    expect(result.total_amount).toEqual(345.00); // (10 * 15.50) + (2 * 95.00)
    expect(result.notes).toEqual('Test purchase order');
    expect(result.created_by).toEqual(testUser.id);
    expect(result.approved_by).toBeNull();
    expect(result.po_number).toMatch(/^PO-\d{4}-\d{6}$/);
    expect(result.id).toBeDefined();
    expect(result.order_date).toBeInstanceOf(Date);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save purchase order and items to database', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values(testUser).execute();
    
    const supplierResult = await db.insert(suppliersTable).values(testSupplier).returning().execute();
    const supplier = supplierResult[0];

    const itemsResult = await db.insert(itemsTable).values(testItem1).returning().execute();
    const item1 = itemsResult[0];

    const testInput: CreatePurchaseOrderInput = {
      supplier_id: supplier.id,
      expected_delivery_date: null,
      notes: null,
      items: [
        {
          item_id: item1.id,
          quantity: 5,
          unit_price: 20.00
        }
      ]
    };

    const result = await createPurchaseOrder(testInput, testUser.id);

    // Verify purchase order was saved
    const savedPO = await db.select()
      .from(purchaseOrdersTable)
      .where(eq(purchaseOrdersTable.id, result.id))
      .execute();

    expect(savedPO).toHaveLength(1);
    expect(savedPO[0].po_number).toEqual(result.po_number);
    expect(parseFloat(savedPO[0].total_amount)).toEqual(100.00);

    // Verify purchase order items were saved
    const savedItems = await db.select()
      .from(purchaseOrderItemsTable)
      .where(eq(purchaseOrderItemsTable.purchase_order_id, result.id))
      .execute();

    expect(savedItems).toHaveLength(1);
    expect(savedItems[0].item_id).toEqual(item1.id);
    expect(savedItems[0].quantity).toEqual(5);
    expect(parseFloat(savedItems[0].unit_price)).toEqual(20.00);
    expect(parseFloat(savedItems[0].total_price)).toEqual(100.00);
    expect(savedItems[0].received_quantity).toEqual(0);
  });

  it('should generate unique PO numbers', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values(testUser).execute();
    
    const supplierResult = await db.insert(suppliersTable).values(testSupplier).returning().execute();
    const supplier = supplierResult[0];

    const itemsResult = await db.insert(itemsTable).values(testItem1).returning().execute();
    const item1 = itemsResult[0];

    const testInput: CreatePurchaseOrderInput = {
      supplier_id: supplier.id,
      expected_delivery_date: null,
      notes: null,
      items: [
        {
          item_id: item1.id,
          quantity: 1,
          unit_price: 10.00
        }
      ]
    };

    // Create multiple purchase orders
    const result1 = await createPurchaseOrder(testInput, testUser.id);
    const result2 = await createPurchaseOrder(testInput, testUser.id);

    expect(result1.po_number).not.toEqual(result2.po_number);
    expect(result1.po_number).toMatch(/^PO-\d{4}-\d{6}$/);
    expect(result2.po_number).toMatch(/^PO-\d{4}-\d{6}$/);
  });

  it('should throw error for non-existent supplier', async () => {
    await db.insert(usersTable).values(testUser).execute();
    
    const itemsResult = await db.insert(itemsTable).values(testItem1).returning().execute();
    const item1 = itemsResult[0];

    const testInput: CreatePurchaseOrderInput = {
      supplier_id: 999999, // Non-existent supplier
      expected_delivery_date: null,
      notes: null,
      items: [
        {
          item_id: item1.id,
          quantity: 1,
          unit_price: 10.00
        }
      ]
    };

    await expect(createPurchaseOrder(testInput, testUser.id)).rejects.toThrow(/supplier.*not found.*inactive/i);
  });

  it('should throw error for inactive supplier', async () => {
    await db.insert(usersTable).values(testUser).execute();
    
    const inactiveSupplier = { ...testSupplier, is_active: false };
    const supplierResult = await db.insert(suppliersTable).values(inactiveSupplier).returning().execute();
    const supplier = supplierResult[0];

    const itemsResult = await db.insert(itemsTable).values(testItem1).returning().execute();
    const item1 = itemsResult[0];

    const testInput: CreatePurchaseOrderInput = {
      supplier_id: supplier.id,
      expected_delivery_date: null,
      notes: null,
      items: [
        {
          item_id: item1.id,
          quantity: 1,
          unit_price: 10.00
        }
      ]
    };

    await expect(createPurchaseOrder(testInput, testUser.id)).rejects.toThrow(/supplier.*not found.*inactive/i);
  });

  it('should throw error for non-existent item', async () => {
    await db.insert(usersTable).values(testUser).execute();
    
    const supplierResult = await db.insert(suppliersTable).values(testSupplier).returning().execute();
    const supplier = supplierResult[0];

    const testInput: CreatePurchaseOrderInput = {
      supplier_id: supplier.id,
      expected_delivery_date: null,
      notes: null,
      items: [
        {
          item_id: 999999, // Non-existent item
          quantity: 1,
          unit_price: 10.00
        }
      ]
    };

    await expect(createPurchaseOrder(testInput, testUser.id)).rejects.toThrow(/items.*999999.*not found.*inactive/i);
  });

  it('should throw error for inactive item', async () => {
    await db.insert(usersTable).values(testUser).execute();
    
    const supplierResult = await db.insert(suppliersTable).values(testSupplier).returning().execute();
    const supplier = supplierResult[0];

    const inactiveItem = { ...testItem1, is_active: false };
    const itemsResult = await db.insert(itemsTable).values(inactiveItem).returning().execute();
    const item1 = itemsResult[0];

    const testInput: CreatePurchaseOrderInput = {
      supplier_id: supplier.id,
      expected_delivery_date: null,
      notes: null,
      items: [
        {
          item_id: item1.id,
          quantity: 1,
          unit_price: 10.00
        }
      ]
    };

    await expect(createPurchaseOrder(testInput, testUser.id)).rejects.toThrow(/items.*not found.*inactive/i);
  });

  it('should calculate correct total amount with multiple items', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values(testUser).execute();
    
    const supplierResult = await db.insert(suppliersTable).values(testSupplier).returning().execute();
    const supplier = supplierResult[0];

    const itemsResult = await db.insert(itemsTable).values([testItem1, testItem2]).returning().execute();
    const [item1, item2] = itemsResult;

    const testInput: CreatePurchaseOrderInput = {
      supplier_id: supplier.id,
      expected_delivery_date: null,
      notes: null,
      items: [
        {
          item_id: item1.id,
          quantity: 3,
          unit_price: 25.50
        },
        {
          item_id: item2.id,
          quantity: 1,
          unit_price: 150.75
        }
      ]
    };

    const result = await createPurchaseOrder(testInput, testUser.id);

    expect(result.total_amount).toEqual(227.25); // (3 * 25.50) + (1 * 150.75) = 76.50 + 150.75
    expect(typeof result.total_amount).toBe('number');
  });
});