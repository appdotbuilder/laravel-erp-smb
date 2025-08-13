import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, suppliersTable, purchaseOrdersTable } from '../db/schema';
import { generatePONumber } from '../handlers/generate_po_number';

describe('generatePONumber', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should generate first PO number for current year', async () => {
    const poNumber = await generatePONumber();
    
    const currentYear = new Date().getFullYear();
    const expectedFormat = `PO-${currentYear}-000001`;
    
    expect(poNumber).toEqual(expectedFormat);
    expect(poNumber).toMatch(/^PO-\d{4}-\d{6}$/);
  });

  it('should increment PO number based on existing orders', async () => {
    // Create prerequisite data
    const testUser = await db.insert(usersTable)
      .values({
        id: 'test-user-1',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        role: 'PURCHASING_STAFF'
      })
      .returning()
      .execute();

    const testSupplier = await db.insert(suppliersTable)
      .values({
        name: 'Test Supplier',
        contact_person: 'John Doe',
        email: 'supplier@example.com',
        phone: '555-1234',
        is_active: true
      })
      .returning()
      .execute();

    const currentYear = new Date().getFullYear();

    // Create existing PO with number PO-YYYY-000001
    await db.insert(purchaseOrdersTable)
      .values({
        po_number: `PO-${currentYear}-000001`,
        supplier_id: testSupplier[0].id,
        status: 'DRAFT',
        total_amount: '100.00',
        created_by: testUser[0].id
      })
      .execute();

    // Generate next PO number
    const poNumber = await generatePONumber();
    
    expect(poNumber).toEqual(`PO-${currentYear}-000002`);
  });

  it('should handle multiple existing PO numbers correctly', async () => {
    // Create prerequisite data
    const testUser = await db.insert(usersTable)
      .values({
        id: 'test-user-2',
        email: 'test2@example.com',
        first_name: 'Test',
        last_name: 'User2',
        role: 'PURCHASING_STAFF'
      })
      .returning()
      .execute();

    const testSupplier = await db.insert(suppliersTable)
      .values({
        name: 'Test Supplier 2',
        contact_person: 'Jane Doe',
        email: 'supplier2@example.com',
        is_active: true
      })
      .returning()
      .execute();

    const currentYear = new Date().getFullYear();

    // Create multiple existing POs
    await db.insert(purchaseOrdersTable)
      .values([
        {
          po_number: `PO-${currentYear}-000001`,
          supplier_id: testSupplier[0].id,
          status: 'DRAFT',
          total_amount: '100.00',
          created_by: testUser[0].id
        },
        {
          po_number: `PO-${currentYear}-000003`,
          supplier_id: testSupplier[0].id,
          status: 'APPROVED',
          total_amount: '200.00',
          created_by: testUser[0].id
        },
        {
          po_number: `PO-${currentYear}-000002`,
          supplier_id: testSupplier[0].id,
          status: 'PENDING',
          total_amount: '150.00',
          created_by: testUser[0].id
        }
      ])
      .execute();

    // Should generate PO-YYYY-000004 based on highest existing number
    const poNumber = await generatePONumber();
    
    expect(poNumber).toEqual(`PO-${currentYear}-000004`);
  });

  it('should only consider PO numbers from current year', async () => {
    // Create prerequisite data
    const testUser = await db.insert(usersTable)
      .values({
        id: 'test-user-3',
        email: 'test3@example.com',
        first_name: 'Test',
        last_name: 'User3',
        role: 'PURCHASING_STAFF'
      })
      .returning()
      .execute();

    const testSupplier = await db.insert(suppliersTable)
      .values({
        name: 'Test Supplier 3',
        contact_person: 'Bob Smith',
        email: 'supplier3@example.com',
        is_active: true
      })
      .returning()
      .execute();

    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;

    // Create POs from previous year and current year
    await db.insert(purchaseOrdersTable)
      .values([
        {
          po_number: `PO-${previousYear}-000999`,
          supplier_id: testSupplier[0].id,
          status: 'RECEIVED',
          total_amount: '500.00',
          created_by: testUser[0].id
        },
        {
          po_number: `PO-${currentYear}-000002`,
          supplier_id: testSupplier[0].id,
          status: 'APPROVED',
          total_amount: '300.00',
          created_by: testUser[0].id
        }
      ])
      .execute();

    // Should generate PO-YYYY-000003, ignoring previous year's high number
    const poNumber = await generatePONumber();
    
    expect(poNumber).toEqual(`PO-${currentYear}-000003`);
    expect(poNumber).not.toContain(previousYear.toString());
  });

  it('should handle large sequence numbers correctly', async () => {
    // Create prerequisite data
    const testUser = await db.insert(usersTable)
      .values({
        id: 'test-user-4',
        email: 'test4@example.com',
        first_name: 'Test',
        last_name: 'User4',
        role: 'PURCHASING_STAFF'
      })
      .returning()
      .execute();

    const testSupplier = await db.insert(suppliersTable)
      .values({
        name: 'Test Supplier 4',
        contact_person: 'Alice Johnson',
        email: 'supplier4@example.com',
        is_active: true
      })
      .returning()
      .execute();

    const currentYear = new Date().getFullYear();

    // Create PO with large sequence number
    await db.insert(purchaseOrdersTable)
      .values({
        po_number: `PO-${currentYear}-099999`,
        supplier_id: testSupplier[0].id,
        status: 'DRAFT',
        total_amount: '1000.00',
        created_by: testUser[0].id
      })
      .execute();

    const poNumber = await generatePONumber();
    
    expect(poNumber).toEqual(`PO-${currentYear}-100000`);
  });

  it('should maintain correct format with 6-digit padding', async () => {
    const poNumber = await generatePONumber();
    
    // Verify format: PO-YYYY-NNNNNN
    expect(poNumber).toMatch(/^PO-\d{4}-\d{6}$/);
    
    // Verify the sequence part is exactly 6 digits
    const parts = poNumber.split('-');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toEqual('PO');
    expect(parts[1]).toHaveLength(4); // Year
    expect(parts[2]).toHaveLength(6); // Sequence with padding
    expect(parts[2]).toEqual('000001'); // First number should be padded
  });

  it('should handle edge case with invalid PO number format in database', async () => {
    // Create prerequisite data
    const testUser = await db.insert(usersTable)
      .values({
        id: 'test-user-5',
        email: 'test5@example.com',
        first_name: 'Test',
        last_name: 'User5',
        role: 'PURCHASING_STAFF'
      })
      .returning()
      .execute();

    const testSupplier = await db.insert(suppliersTable)
      .values({
        name: 'Test Supplier 5',
        contact_person: 'Charlie Brown',
        email: 'supplier5@example.com',
        is_active: true
      })
      .returning()
      .execute();

    const currentYear = new Date().getFullYear();

    // Create PO with invalid format (should be ignored)
    await db.insert(purchaseOrdersTable)
      .values([
        {
          po_number: `PO-${currentYear}-INVALID`,
          supplier_id: testSupplier[0].id,
          status: 'DRAFT',
          total_amount: '100.00',
          created_by: testUser[0].id
        },
        {
          po_number: `PO-${currentYear}-000005`,
          supplier_id: testSupplier[0].id,
          status: 'APPROVED',
          total_amount: '200.00',
          created_by: testUser[0].id
        }
      ])
      .execute();

    // Should generate PO-YYYY-000006, using valid sequence number
    const poNumber = await generatePONumber();
    
    expect(poNumber).toEqual(`PO-${currentYear}-000006`);
  });
});