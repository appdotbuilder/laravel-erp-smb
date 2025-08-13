import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { itemsTable, stockAdjustmentsTable } from '../db/schema';
import { type CreateItemInput } from '../schema';
import { createItem } from '../handlers/create_item';
import { eq } from 'drizzle-orm';

// Test input with all required fields
const testInput: CreateItemInput = {
  name: 'Test Wrench',
  description: 'A standard 10mm wrench for testing',
  sku: 'WRENCH-10MM-001',
  category: 'Tools',
  unit_of_measure: 'pieces',
  current_stock: 50,
  min_stock_level: 10,
  unit_cost: 15.99
};

// Test input with minimal fields (optional fields omitted)
const minimalInput: CreateItemInput = {
  name: 'Basic Screw',
  sku: 'SCREW-BASIC-001',
  category: 'Fasteners',
  unit_of_measure: 'pieces',
  current_stock: 100,
  min_stock_level: 20,
  unit_cost: 0.05
};

// Test input with zero initial stock
const zeroStockInput: CreateItemInput = {
  name: 'Future Item',
  description: 'Item to be stocked later',
  sku: 'FUTURE-001',
  category: 'Pending',
  unit_of_measure: 'pieces',
  current_stock: 0,
  min_stock_level: 5,
  unit_cost: 25.00
};

describe('createItem', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create an item with all fields', async () => {
    const result = await createItem(testInput);

    // Verify all fields are correctly set
    expect(result.name).toEqual('Test Wrench');
    expect(result.description).toEqual('A standard 10mm wrench for testing');
    expect(result.sku).toEqual('WRENCH-10MM-001');
    expect(result.category).toEqual('Tools');
    expect(result.unit_of_measure).toEqual('pieces');
    expect(result.current_stock).toEqual(50);
    expect(result.min_stock_level).toEqual(10);
    expect(result.unit_cost).toEqual(15.99);
    expect(typeof result.unit_cost).toBe('number'); // Verify numeric conversion
    expect(result.is_active).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create an item with minimal fields', async () => {
    const result = await createItem(minimalInput);

    expect(result.name).toEqual('Basic Screw');
    expect(result.description).toBeNull(); // Optional field should be null
    expect(result.sku).toEqual('SCREW-BASIC-001');
    expect(result.category).toEqual('Fasteners');
    expect(result.unit_of_measure).toEqual('pieces');
    expect(result.current_stock).toEqual(100);
    expect(result.min_stock_level).toEqual(20);
    expect(result.unit_cost).toEqual(0.05);
    expect(result.is_active).toBe(true);
    expect(result.id).toBeDefined();
  });

  it('should save item to database correctly', async () => {
    const result = await createItem(testInput);

    // Query the database to verify the item was saved
    const items = await db.select()
      .from(itemsTable)
      .where(eq(itemsTable.id, result.id))
      .execute();

    expect(items).toHaveLength(1);
    const savedItem = items[0];
    expect(savedItem.name).toEqual('Test Wrench');
    expect(savedItem.description).toEqual('A standard 10mm wrench for testing');
    expect(savedItem.sku).toEqual('WRENCH-10MM-001');
    expect(parseFloat(savedItem.unit_cost)).toEqual(15.99); // Database stores as string
    expect(savedItem.current_stock).toEqual(50);
    expect(savedItem.is_active).toBe(true);
  });

  it('should not create stock adjustment without user context', async () => {
    const result = await createItem(testInput);

    // Since we don't have a valid user context, no stock adjustments should be created
    // This is expected behavior until user authentication is properly implemented
    const adjustments = await db.select()
      .from(stockAdjustmentsTable)
      .where(eq(stockAdjustmentsTable.item_id, result.id))
      .execute();

    expect(adjustments).toHaveLength(0);
  });

  it('should handle zero initial stock correctly', async () => {
    const result = await createItem(zeroStockInput);

    expect(result.current_stock).toEqual(0);
    expect(result.name).toEqual('Future Item');
    
    // No stock adjustments should be created for zero stock items
    const adjustments = await db.select()
      .from(stockAdjustmentsTable)
      .where(eq(stockAdjustmentsTable.item_id, result.id))
      .execute();

    expect(adjustments).toHaveLength(0);
  });

  it('should handle duplicate SKU error', async () => {
    // Create first item
    await createItem(testInput);

    // Try to create another item with the same SKU
    const duplicateInput: CreateItemInput = {
      ...testInput,
      name: 'Different Name'
    };

    await expect(createItem(duplicateInput)).rejects.toThrow(/duplicate/i);
  });

  it('should handle zero unit cost correctly', async () => {
    const freeItemInput: CreateItemInput = {
      name: 'Free Sample',
      sku: 'FREE-001',
      category: 'Samples',
      unit_of_measure: 'pieces',
      current_stock: 10,
      min_stock_level: 5,
      unit_cost: 0
    };

    const result = await createItem(freeItemInput);

    expect(result.unit_cost).toEqual(0);
    expect(typeof result.unit_cost).toBe('number');
  });

  it('should handle high precision unit cost correctly', async () => {
    const preciseInput: CreateItemInput = {
      name: 'Precise Item',
      sku: 'PRECISE-001',
      category: 'Precision',
      unit_of_measure: 'pieces',
      current_stock: 5,
      min_stock_level: 1,
      unit_cost: 123.456789 // High precision
    };

    const result = await createItem(preciseInput);

    // Database should handle precision correctly (up to 2 decimal places for currency)
    expect(result.unit_cost).toBeCloseTo(123.46, 2);
    expect(typeof result.unit_cost).toBe('number');
  });
});