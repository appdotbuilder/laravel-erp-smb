import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { suppliersTable } from '../db/schema';
import { type CreateSupplierInput } from '../schema';
import { createSupplier } from '../handlers/create_supplier';
import { eq } from 'drizzle-orm';

// Test inputs with all fields
const fullSupplierInput: CreateSupplierInput = {
  name: 'ACME Corporation',
  contact_person: 'John Doe',
  email: 'john.doe@acme.com',
  phone: '+1-555-123-4567',
  address: '123 Business St, Commerce City, NY 10001',
  payment_info: 'Bank: First National, Account: 123456789, Routing: 987654321'
};

const minimalSupplierInput: CreateSupplierInput = {
  name: 'Minimal Supplier Inc.'
};

describe('createSupplier', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a supplier with all fields', async () => {
    const result = await createSupplier(fullSupplierInput);

    // Verify all fields are set correctly
    expect(result.name).toEqual('ACME Corporation');
    expect(result.contact_person).toEqual('John Doe');
    expect(result.email).toEqual('john.doe@acme.com');
    expect(result.phone).toEqual('+1-555-123-4567');
    expect(result.address).toEqual('123 Business St, Commerce City, NY 10001');
    expect(result.encrypted_payment_info).toBeTruthy(); // Should be encrypted
    expect(result.encrypted_payment_info).not.toEqual(fullSupplierInput.payment_info); // Should not be plain text
    expect(result.is_active).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a supplier with minimal fields', async () => {
    const result = await createSupplier(minimalSupplierInput);

    // Verify required field is set
    expect(result.name).toEqual('Minimal Supplier Inc.');
    
    // Verify optional fields are null
    expect(result.contact_person).toBeNull();
    expect(result.email).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.address).toBeNull();
    expect(result.encrypted_payment_info).toBeNull();
    
    // Verify defaults
    expect(result.is_active).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save supplier to database', async () => {
    const result = await createSupplier(fullSupplierInput);

    // Query database to verify supplier was saved
    const suppliers = await db.select()
      .from(suppliersTable)
      .where(eq(suppliersTable.id, result.id))
      .execute();

    expect(suppliers).toHaveLength(1);
    const savedSupplier = suppliers[0];
    
    expect(savedSupplier.name).toEqual('ACME Corporation');
    expect(savedSupplier.contact_person).toEqual('John Doe');
    expect(savedSupplier.email).toEqual('john.doe@acme.com');
    expect(savedSupplier.phone).toEqual('+1-555-123-4567');
    expect(savedSupplier.address).toEqual('123 Business St, Commerce City, NY 10001');
    expect(savedSupplier.encrypted_payment_info).toBeTruthy();
    expect(savedSupplier.is_active).toBe(true);
    expect(savedSupplier.created_at).toBeInstanceOf(Date);
    expect(savedSupplier.updated_at).toBeInstanceOf(Date);
  });

  it('should encrypt payment information', async () => {
    const result = await createSupplier(fullSupplierInput);

    // Payment info should be encrypted, not plain text
    expect(result.encrypted_payment_info).toBeTruthy();
    expect(result.encrypted_payment_info).not.toEqual(fullSupplierInput.payment_info);
    expect(result.encrypted_payment_info).toMatch(/^[a-f0-9]+:[a-f0-9]+$/); // Format: iv:encrypted
  });

  it('should handle missing payment info', async () => {
    const inputWithoutPayment: CreateSupplierInput = {
      name: 'No Payment Supplier',
      contact_person: 'Jane Smith',
      email: 'jane@nopayment.com'
    };

    const result = await createSupplier(inputWithoutPayment);

    expect(result.name).toEqual('No Payment Supplier');
    expect(result.contact_person).toEqual('Jane Smith');
    expect(result.email).toEqual('jane@nopayment.com');
    expect(result.encrypted_payment_info).toBeNull();
    expect(result.is_active).toBe(true);
  });

  it('should create multiple suppliers with unique IDs', async () => {
    const supplier1 = await createSupplier({
      name: 'Supplier One',
      email: 'supplier1@test.com'
    });

    const supplier2 = await createSupplier({
      name: 'Supplier Two',
      email: 'supplier2@test.com'
    });

    expect(supplier1.id).not.toEqual(supplier2.id);
    expect(supplier1.name).toEqual('Supplier One');
    expect(supplier2.name).toEqual('Supplier Two');
    expect(supplier1.email).toEqual('supplier1@test.com');
    expect(supplier2.email).toEqual('supplier2@test.com');
  });

  it('should set timestamps correctly', async () => {
    const beforeCreate = new Date();
    const result = await createSupplier(minimalSupplierInput);
    const afterCreate = new Date();

    expect(result.created_at.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
    expect(result.created_at.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
    expect(result.updated_at.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
    expect(result.updated_at.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
  });

  it('should handle empty string fields as null', async () => {
    const inputWithEmptyStrings: CreateSupplierInput = {
      name: 'Empty Fields Supplier',
      contact_person: '',
      email: '',
      phone: '',
      address: '',
      payment_info: ''
    };

    const result = await createSupplier(inputWithEmptyStrings);

    expect(result.name).toEqual('Empty Fields Supplier');
    // Empty strings should be converted to null for optional fields
    expect(result.contact_person).toBeNull();
    expect(result.email).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.address).toBeNull();
    expect(result.encrypted_payment_info).toBeNull(); // Empty string should not be encrypted
  });
});