import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { suppliersTable } from '../db/schema';
import { getSuppliers } from '../handlers/get_suppliers';

describe('getSuppliers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no suppliers exist', async () => {
    const result = await getSuppliers();
    
    expect(result).toEqual([]);
  });

  it('should return active suppliers only', async () => {
    // Create test suppliers - one active, one inactive
    await db.insert(suppliersTable)
      .values([
        {
          name: 'Active Supplier Inc',
          contact_person: 'John Doe',
          email: 'contact@activesupplier.com',
          phone: '555-0101',
          address: '123 Active Street',
          encrypted_payment_info: 'encrypted_data_123',
          is_active: true
        },
        {
          name: 'Inactive Supplier LLC',
          contact_person: 'Jane Smith',
          email: 'contact@inactivesupplier.com',
          phone: '555-0102',
          address: '456 Inactive Avenue',
          encrypted_payment_info: 'encrypted_data_456',
          is_active: false
        }
      ])
      .execute();

    const result = await getSuppliers();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Active Supplier Inc');
    expect(result[0].is_active).toBe(true);
    expect(result[0].contact_person).toBe('John Doe');
    expect(result[0].email).toBe('contact@activesupplier.com');
    expect(result[0].phone).toBe('555-0101');
    expect(result[0].address).toBe('123 Active Street');
    expect(result[0].encrypted_payment_info).toBe('encrypted_data_123');
  });

  it('should return multiple active suppliers', async () => {
    // Create multiple active suppliers
    await db.insert(suppliersTable)
      .values([
        {
          name: 'Supplier One',
          contact_person: 'Contact One',
          email: 'one@supplier.com',
          phone: '555-0001',
          address: '111 First Street',
          encrypted_payment_info: null,
          is_active: true
        },
        {
          name: 'Supplier Two',
          contact_person: 'Contact Two',
          email: 'two@supplier.com',
          phone: '555-0002',
          address: '222 Second Street',
          encrypted_payment_info: 'encrypted_payment_two',
          is_active: true
        },
        {
          name: 'Supplier Three',
          contact_person: null,
          email: null,
          phone: null,
          address: null,
          encrypted_payment_info: null,
          is_active: true
        }
      ])
      .execute();

    const result = await getSuppliers();

    expect(result).toHaveLength(3);
    expect(result.map(s => s.name)).toContain('Supplier One');
    expect(result.map(s => s.name)).toContain('Supplier Two');
    expect(result.map(s => s.name)).toContain('Supplier Three');
    
    // All returned suppliers should be active
    result.forEach(supplier => {
      expect(supplier.is_active).toBe(true);
    });
  });

  it('should handle suppliers with null optional fields', async () => {
    // Create supplier with minimal data (null optionals)
    await db.insert(suppliersTable)
      .values({
        name: 'Minimal Supplier',
        contact_person: null,
        email: null,
        phone: null,
        address: null,
        encrypted_payment_info: null,
        is_active: true
      })
      .execute();

    const result = await getSuppliers();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Minimal Supplier');
    expect(result[0].contact_person).toBeNull();
    expect(result[0].email).toBeNull();
    expect(result[0].phone).toBeNull();
    expect(result[0].address).toBeNull();
    expect(result[0].encrypted_payment_info).toBeNull();
    expect(result[0].is_active).toBe(true);
  });

  it('should return suppliers with correct data types', async () => {
    await db.insert(suppliersTable)
      .values({
        name: 'Test Supplier',
        contact_person: 'Test Contact',
        email: 'test@supplier.com',
        phone: '555-0123',
        address: '123 Test Street',
        encrypted_payment_info: 'encrypted_test_data',
        is_active: true
      })
      .execute();

    const result = await getSuppliers();

    expect(result).toHaveLength(1);
    const supplier = result[0];
    
    // Check data types
    expect(typeof supplier.id).toBe('number');
    expect(typeof supplier.name).toBe('string');
    expect(typeof supplier.contact_person).toBe('string');
    expect(typeof supplier.email).toBe('string');
    expect(typeof supplier.phone).toBe('string');
    expect(typeof supplier.address).toBe('string');
    expect(typeof supplier.encrypted_payment_info).toBe('string');
    expect(typeof supplier.is_active).toBe('boolean');
    expect(supplier.created_at).toBeInstanceOf(Date);
    expect(supplier.updated_at).toBeInstanceOf(Date);
  });

  it('should not return inactive suppliers', async () => {
    // Create only inactive suppliers
    await db.insert(suppliersTable)
      .values([
        {
          name: 'Inactive Supplier 1',
          contact_person: 'Contact 1',
          email: 'inactive1@supplier.com',
          phone: '555-0201',
          address: '201 Inactive Street',
          encrypted_payment_info: 'encrypted_data_1',
          is_active: false
        },
        {
          name: 'Inactive Supplier 2',
          contact_person: 'Contact 2',
          email: 'inactive2@supplier.com',
          phone: '555-0202',
          address: '202 Inactive Avenue',
          encrypted_payment_info: 'encrypted_data_2',
          is_active: false
        }
      ])
      .execute();

    const result = await getSuppliers();

    expect(result).toEqual([]);
  });

  it('should return suppliers ordered by database default', async () => {
    // Create suppliers in specific order
    const supplierNames = ['Zebra Supplier', 'Alpha Supplier', 'Beta Supplier'];
    
    for (const name of supplierNames) {
      await db.insert(suppliersTable)
        .values({
          name: name,
          contact_person: 'Contact',
          email: `contact@${name.toLowerCase().replace(' ', '')}.com`,
          phone: '555-0100',
          address: '100 Test Street',
          encrypted_payment_info: null,
          is_active: true
        })
        .execute();
    }

    const result = await getSuppliers();

    expect(result).toHaveLength(3);
    // Should be ordered by insertion order (default database ordering)
    expect(result[0].name).toBe('Zebra Supplier');
    expect(result[1].name).toBe('Alpha Supplier');
    expect(result[2].name).toBe('Beta Supplier');
  });
});