import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { itemsTable } from '../db/schema';
import { type GetLowStockItemsInput, type CreateItemInput } from '../schema';
import { getLowStockItems } from '../handlers/get_low_stock_items';

// Test data for various stock scenarios
const testItems: CreateItemInput[] = [
  {
    name: 'Critical Stock Item',
    description: 'Item with very low stock',
    sku: 'CRIT-001',
    category: 'Electronics',
    unit_of_measure: 'pieces',
    current_stock: 5,
    min_stock_level: 10,
    unit_cost: 25.99
  },
  {
    name: 'Low Stock Item',
    description: 'Item at minimum threshold',
    sku: 'LOW-001',
    category: 'Hardware',
    unit_of_measure: 'pieces',
    current_stock: 15,
    min_stock_level: 15,
    unit_cost: 12.50
  },
  {
    name: 'Good Stock Item',
    description: 'Item with adequate stock',
    sku: 'GOOD-001',
    category: 'Tools',
    unit_of_measure: 'pieces',
    current_stock: 50,
    min_stock_level: 20,
    unit_cost: 45.75
  },
  {
    name: 'Zero Stock Item',
    description: 'Out of stock item',
    sku: 'ZERO-001',
    category: 'Supplies',
    unit_of_measure: 'kg',
    current_stock: 0,
    min_stock_level: 5,
    unit_cost: 8.99
  },
  {
    name: 'Inactive Low Stock',
    description: 'Inactive item with low stock',
    sku: 'INACT-001',
    category: 'Deprecated',
    unit_of_measure: 'pieces',
    current_stock: 2,
    min_stock_level: 10,
    unit_cost: 15.25
  }
];

describe('getLowStockItems', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const createTestItems = async () => {
    const insertedItems = [];
    
    // Insert active items
    for (const item of testItems.slice(0, 4)) {
      const result = await db.insert(itemsTable)
        .values({
          name: item.name,
          description: item.description,
          sku: item.sku,
          category: item.category,
          unit_of_measure: item.unit_of_measure,
          current_stock: item.current_stock,
          min_stock_level: item.min_stock_level,
          unit_cost: item.unit_cost.toString(),
          is_active: true
        })
        .returning()
        .execute();
      insertedItems.push(result[0]);
    }

    // Insert inactive item
    const inactiveItem = testItems[4];
    const inactiveResult = await db.insert(itemsTable)
      .values({
        name: inactiveItem.name,
        description: inactiveItem.description,
        sku: inactiveItem.sku,
        category: inactiveItem.category,
        unit_of_measure: inactiveItem.unit_of_measure,
        current_stock: inactiveItem.current_stock,
        min_stock_level: inactiveItem.min_stock_level,
        unit_cost: inactiveItem.unit_cost.toString(),
        is_active: false
      })
      .returning()
      .execute();
    insertedItems.push(inactiveResult[0]);

    return insertedItems;
  };

  it('should return items with stock at or below threshold (default multiplier)', async () => {
    await createTestItems();

    const input: GetLowStockItemsInput = {
      threshold_multiplier: 1 // Default value
    };

    const result = await getLowStockItems(input);

    // Should return 3 items: Critical (5 <= 10*1), Low (15 <= 15*1), Zero (0 <= 5*1)
    expect(result).toHaveLength(3);

    const skus = result.map(item => item.sku).sort();
    expect(skus).toEqual(['CRIT-001', 'LOW-001', 'ZERO-001']);

    // Verify numeric conversion
    result.forEach(item => {
      expect(typeof item.unit_cost).toBe('number');
      expect(item.unit_cost).toBeGreaterThan(0);
    });
  });

  it('should apply threshold multiplier correctly', async () => {
    await createTestItems();

    const input: GetLowStockItemsInput = {
      threshold_multiplier: 2
    };

    const result = await getLowStockItems(input);

    // Should return 4 items now: Critical (5 <= 10*2), Low (15 <= 15*2), Zero (0 <= 5*2), Good (50 <= 20*2 = 40? No, 50 > 40)
    // Actually: Critical (5 <= 20), Low (15 <= 30), Zero (0 <= 10) - Good item has 50 current vs 40 threshold so not included
    expect(result).toHaveLength(3);

    const skus = result.map(item => item.sku).sort();
    expect(skus).toEqual(['CRIT-001', 'LOW-001', 'ZERO-001']);
  });

  it('should apply higher threshold multiplier correctly', async () => {
    await createTestItems();

    const input: GetLowStockItemsInput = {
      threshold_multiplier: 3
    };

    const result = await getLowStockItems(input);

    // Critical (5 <= 30), Low (15 <= 45), Zero (0 <= 15), Good (50 <= 60) - now Good should be included
    expect(result).toHaveLength(4);

    const skus = result.map(item => item.sku).sort();
    expect(skus).toEqual(['CRIT-001', 'GOOD-001', 'LOW-001', 'ZERO-001']);
  });

  it('should exclude inactive items', async () => {
    await createTestItems();

    const input: GetLowStockItemsInput = {
      threshold_multiplier: 1
    };

    const result = await getLowStockItems(input);

    // Inactive item should not be included even though it has low stock
    const skus = result.map(item => item.sku);
    expect(skus).not.toContain('INACT-001');

    // All returned items should be active
    result.forEach(item => {
      expect(item.is_active).toBe(true);
    });
  });

  it('should return empty array when no items are below threshold', async () => {
    // Create only items with good stock levels
    await db.insert(itemsTable)
      .values({
        name: 'Well Stocked Item',
        sku: 'WELL-001',
        category: 'Test',
        unit_of_measure: 'pieces',
        current_stock: 100,
        min_stock_level: 10,
        unit_cost: '20.00',
        is_active: true
      })
      .execute();

    const input: GetLowStockItemsInput = {
      threshold_multiplier: 1
    };

    const result = await getLowStockItems(input);

    expect(result).toHaveLength(0);
  });

  it('should handle fractional threshold multipliers', async () => {
    await createTestItems();

    const input: GetLowStockItemsInput = {
      threshold_multiplier: 0.5
    };

    const result = await getLowStockItems(input);

    // With 0.5 multiplier:
    // Critical: 5 <= 5 (10*0.5) - included
    // Low: 15 <= 7.5 (15*0.5) - not included (15 > 7.5)
    // Zero: 0 <= 2.5 (5*0.5) - included
    // Good: 50 <= 10 (20*0.5) - not included
    expect(result).toHaveLength(2);

    const skus = result.map(item => item.sku).sort();
    expect(skus).toEqual(['CRIT-001', 'ZERO-001']);
  });

  it('should handle items with zero minimum stock level', async () => {
    // Create item with zero min stock level
    await db.insert(itemsTable)
      .values({
        name: 'No Min Stock Item',
        sku: 'NOMIN-001',
        category: 'Test',
        unit_of_measure: 'pieces',
        current_stock: 5,
        min_stock_level: 0,
        unit_cost: '10.00',
        is_active: true
      })
      .execute();

    const input: GetLowStockItemsInput = {
      threshold_multiplier: 2
    };

    const result = await getLowStockItems(input);

    // 5 <= 0*2 = 0, so 5 > 0, should not be included
    expect(result).toHaveLength(0);
  });

  it('should return correct data structure with all required fields', async () => {
    await createTestItems();

    const input: GetLowStockItemsInput = {
      threshold_multiplier: 1
    };

    const result = await getLowStockItems(input);

    expect(result.length).toBeGreaterThan(0);

    const item = result[0];
    expect(item.id).toBeDefined();
    expect(item.name).toBeDefined();
    expect(item.sku).toBeDefined();
    expect(item.category).toBeDefined();
    expect(item.unit_of_measure).toBeDefined();
    expect(typeof item.current_stock).toBe('number');
    expect(typeof item.min_stock_level).toBe('number');
    expect(typeof item.unit_cost).toBe('number');
    expect(typeof item.is_active).toBe('boolean');
    expect(item.created_at).toBeInstanceOf(Date);
    expect(item.updated_at).toBeInstanceOf(Date);
  });
});