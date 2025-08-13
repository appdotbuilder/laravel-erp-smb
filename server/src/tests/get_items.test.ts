import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { itemsTable } from '../db/schema';
import { type CreateItemInput } from '../schema';
import { getItems } from '../handlers/get_items';

// Test items with different scenarios
const testItems: CreateItemInput[] = [
  {
    name: 'Test Widget',
    description: 'A widget for testing',
    sku: 'TW-001',
    category: 'Widgets',
    unit_of_measure: 'pieces',
    current_stock: 50,
    min_stock_level: 10,
    unit_cost: 12.50
  },
  {
    name: 'Test Bolt',
    description: 'Standard bolt for assembly',
    sku: 'TB-002',
    category: 'Hardware',
    unit_of_measure: 'pieces',
    current_stock: 200,
    min_stock_level: 25,
    unit_cost: 0.75
  },
  {
    name: 'Test Oil',
    description: null, // Test nullable description
    sku: 'TO-003',
    category: 'Fluids',
    unit_of_measure: 'liters',
    current_stock: 30,
    min_stock_level: 5,
    unit_cost: 25.99
  }
];

describe('getItems', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no items exist', async () => {
    const result = await getItems();
    expect(result).toEqual([]);
  });

  it('should fetch all active items', async () => {
    // Create test items in database
    for (const item of testItems) {
      await db.insert(itemsTable)
        .values({
          ...item,
          unit_cost: item.unit_cost.toString() // Convert to string for insert
        })
        .execute();
    }

    const result = await getItems();

    // Should return all active items
    expect(result).toHaveLength(3);
    
    // Check first item properties
    const firstItem = result.find(item => item.sku === 'TW-001');
    expect(firstItem).toBeDefined();
    expect(firstItem!.name).toEqual('Test Widget');
    expect(firstItem!.description).toEqual('A widget for testing');
    expect(firstItem!.category).toEqual('Widgets');
    expect(firstItem!.unit_of_measure).toEqual('pieces');
    expect(firstItem!.current_stock).toEqual(50);
    expect(firstItem!.min_stock_level).toEqual(10);
    expect(firstItem!.unit_cost).toEqual(12.50);
    expect(typeof firstItem!.unit_cost).toBe('number');
    expect(firstItem!.is_active).toBe(true);
    expect(firstItem!.id).toBeDefined();
    expect(firstItem!.created_at).toBeInstanceOf(Date);
    expect(firstItem!.updated_at).toBeInstanceOf(Date);
  });

  it('should handle nullable description correctly', async () => {
    // Create item with null description
    await db.insert(itemsTable)
      .values({
        ...testItems[2],
        unit_cost: testItems[2].unit_cost.toString()
      })
      .execute();

    const result = await getItems();

    expect(result).toHaveLength(1);
    expect(result[0].description).toBeNull();
    expect(result[0].name).toEqual('Test Oil');
  });

  it('should only return active items', async () => {
    // Create active item
    await db.insert(itemsTable)
      .values({
        ...testItems[0],
        unit_cost: testItems[0].unit_cost.toString(),
        is_active: true
      })
      .execute();

    // Create inactive item
    await db.insert(itemsTable)
      .values({
        name: 'Inactive Item',
        description: 'This should not be returned',
        sku: 'IA-001',
        category: 'Inactive',
        unit_of_measure: 'pieces',
        current_stock: 0,
        min_stock_level: 0,
        unit_cost: '10.00',
        is_active: false
      })
      .execute();

    const result = await getItems();

    // Should only return the active item
    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('Test Widget');
    expect(result[0].is_active).toBe(true);
  });

  it('should convert numeric unit_cost correctly', async () => {
    // Create item with decimal cost
    await db.insert(itemsTable)
      .values({
        ...testItems[1],
        unit_cost: testItems[1].unit_cost.toString() // 0.75 as string
      })
      .execute();

    const result = await getItems();

    expect(result).toHaveLength(1);
    expect(result[0].unit_cost).toEqual(0.75);
    expect(typeof result[0].unit_cost).toBe('number');
  });

  it('should handle zero stock levels correctly', async () => {
    // Create item with zero stock
    await db.insert(itemsTable)
      .values({
        name: 'Empty Stock Item',
        description: 'Item with no stock',
        sku: 'ES-001',
        category: 'Test',
        unit_of_measure: 'pieces',
        current_stock: 0,
        min_stock_level: 0,
        unit_cost: '5.00'
      })
      .execute();

    const result = await getItems();

    expect(result).toHaveLength(1);
    expect(result[0].current_stock).toEqual(0);
    expect(result[0].min_stock_level).toEqual(0);
    expect(result[0].unit_cost).toEqual(5.00);
  });

  it('should handle multiple categories and units correctly', async () => {
    // Create items with different categories and units
    const diverseItems = [
      {
        name: 'Liquid Cleaner',
        sku: 'LC-001',
        category: 'Cleaning',
        unit_of_measure: 'liters',
        current_stock: 15,
        min_stock_level: 3,
        unit_cost: '8.50'
      },
      {
        name: 'Steel Plate',
        sku: 'SP-001', 
        category: 'Materials',
        unit_of_measure: 'kg',
        current_stock: 100,
        min_stock_level: 20,
        unit_cost: '2.25'
      }
    ];

    for (const item of diverseItems) {
      await db.insert(itemsTable)
        .values({
          ...item,
          description: null
        })
        .execute();
    }

    const result = await getItems();

    expect(result).toHaveLength(2);
    
    const cleaner = result.find(item => item.category === 'Cleaning');
    const material = result.find(item => item.category === 'Materials');
    
    expect(cleaner).toBeDefined();
    expect(cleaner!.unit_of_measure).toEqual('liters');
    expect(cleaner!.unit_cost).toEqual(8.50);
    
    expect(material).toBeDefined();
    expect(material!.unit_of_measure).toEqual('kg');
    expect(material!.unit_cost).toEqual(2.25);
  });
});