import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, itemsTable, stockAdjustmentsTable } from '../db/schema';
import { getStockAdjustments } from '../handlers/get_stock_adjustments';

describe('getStockAdjustments', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no stock adjustments exist', async () => {
    const result = await getStockAdjustments();
    expect(result).toEqual([]);
  });

  it('should fetch all stock adjustments with related information', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        id: 'user_test123',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        role: 'WAREHOUSE_MANAGER'
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create test items
    const itemResult = await db.insert(itemsTable)
      .values([
        {
          name: 'Test Item 1',
          description: 'First test item',
          sku: 'TEST-001',
          category: 'Electronics',
          unit_of_measure: 'pieces',
          current_stock: 100,
          min_stock_level: 10,
          unit_cost: '25.50'
        },
        {
          name: 'Test Item 2',
          description: 'Second test item',
          sku: 'TEST-002',
          category: 'Tools',
          unit_of_measure: 'pieces',
          current_stock: 50,
          min_stock_level: 5,
          unit_cost: '15.00'
        }
      ])
      .returning()
      .execute();
    const item1Id = itemResult[0].id;
    const item2Id = itemResult[1].id;

    // Create test stock adjustments (insert one by one to ensure ordering)
    const adjustment1 = await db.insert(stockAdjustmentsTable)
      .values({
        item_id: item1Id,
        adjustment_type: 'RECEIVED',
        quantity_change: 20,
        previous_stock: 100,
        new_stock: 120,
        reason: 'Purchase order delivery',
        reference_id: 1,
        reference_type: 'purchase_order',
        created_by: userId
      })
      .returning()
      .execute();

    const adjustment2 = await db.insert(stockAdjustmentsTable)
      .values({
        item_id: item2Id,
        adjustment_type: 'CONSUMED',
        quantity_change: -10,
        previous_stock: 50,
        new_stock: 40,
        reason: 'Work order completion',
        reference_id: 2,
        reference_type: 'work_order',
        created_by: userId
      })
      .returning()
      .execute();

    const adjustment3 = await db.insert(stockAdjustmentsTable)
      .values({
        item_id: item1Id,
        adjustment_type: 'ADJUSTMENT',
        quantity_change: 5,
        previous_stock: 120,
        new_stock: 125,
        reason: 'Manual stock correction',
        reference_id: null,
        reference_type: null,
        created_by: userId
      })
      .returning()
      .execute();

    const results = await getStockAdjustments();

    expect(results).toHaveLength(3);
    
    // Check that results are ordered by created_at descending (most recent first)
    expect(results[0].created_at >= results[1].created_at).toBe(true);
    expect(results[1].created_at >= results[2].created_at).toBe(true);

    // Verify first result (most recent - should be the last inserted adjustment)
    const latestAdjustment = results[0];
    expect(latestAdjustment.item_id).toEqual(item1Id);
    expect(latestAdjustment.adjustment_type).toEqual('ADJUSTMENT');
    expect(latestAdjustment.quantity_change).toEqual(5);
    expect(latestAdjustment.previous_stock).toEqual(120);
    expect(latestAdjustment.new_stock).toEqual(125);
    expect(latestAdjustment.reason).toEqual('Manual stock correction');
    expect(latestAdjustment.reference_id).toBeNull();
    expect(latestAdjustment.reference_type).toBeNull();
    expect(latestAdjustment.created_by).toEqual(userId);
    expect(latestAdjustment.created_at).toBeInstanceOf(Date);

    // Verify all results have required fields
    results.forEach(adjustment => {
      expect(adjustment.id).toBeDefined();
      expect(adjustment.item_id).toBeDefined();
      expect(adjustment.adjustment_type).toBeDefined();
      expect(typeof adjustment.quantity_change).toBe('number');
      expect(typeof adjustment.previous_stock).toBe('number');
      expect(typeof adjustment.new_stock).toBe('number');
      expect(adjustment.reason).toBeDefined();
      expect(adjustment.created_by).toBeDefined();
      expect(adjustment.created_at).toBeInstanceOf(Date);
    });
  });

  it('should filter stock adjustments by item ID', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        id: 'user_filter123',
        email: 'filter@example.com',
        first_name: 'Jane',
        last_name: 'Smith',
        role: 'TECHNICIAN'
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create test items
    const itemResult = await db.insert(itemsTable)
      .values([
        {
          name: 'Filter Item 1',
          description: 'First filter test item',
          sku: 'FILTER-001',
          category: 'Supplies',
          unit_of_measure: 'pieces',
          current_stock: 80,
          min_stock_level: 8,
          unit_cost: '12.25'
        },
        {
          name: 'Filter Item 2',
          description: 'Second filter test item',
          sku: 'FILTER-002',
          category: 'Supplies',
          unit_of_measure: 'pieces',
          current_stock: 60,
          min_stock_level: 6,
          unit_cost: '8.75'
        }
      ])
      .returning()
      .execute();
    const item1Id = itemResult[0].id;
    const item2Id = itemResult[1].id;

    // Create stock adjustments for both items (insert one by one to control order)
    await db.insert(stockAdjustmentsTable)
      .values({
        item_id: item1Id,
        adjustment_type: 'RECEIVED',
        quantity_change: 15,
        previous_stock: 80,
        new_stock: 95,
        reason: 'Stock replenishment',
        created_by: userId
      })
      .execute();

    await db.insert(stockAdjustmentsTable)
      .values({
        item_id: item2Id,
        adjustment_type: 'DAMAGED',
        quantity_change: -5,
        previous_stock: 60,
        new_stock: 55,
        reason: 'Damaged during transport',
        created_by: userId
      })
      .execute();

    await db.insert(stockAdjustmentsTable)
      .values({
        item_id: item1Id,
        adjustment_type: 'LOST',
        quantity_change: -3,
        previous_stock: 95,
        new_stock: 92,
        reason: 'Items missing from inventory',
        created_by: userId
      })
      .execute();

    // Filter by first item
    const filteredResults = await getStockAdjustments(item1Id);

    expect(filteredResults).toHaveLength(2);
    
    // All results should be for the specified item
    filteredResults.forEach(adjustment => {
      expect(adjustment.item_id).toEqual(item1Id);
    });

    // Check that results are ordered by created_at descending
    expect(filteredResults[0].adjustment_type).toEqual('LOST'); // Most recent
    expect(filteredResults[1].adjustment_type).toEqual('RECEIVED'); // Earlier

    // Verify specific adjustment details
    const lostAdjustment = filteredResults[0];
    expect(lostAdjustment.quantity_change).toEqual(-3);
    expect(lostAdjustment.previous_stock).toEqual(95);
    expect(lostAdjustment.new_stock).toEqual(92);
    expect(lostAdjustment.reason).toEqual('Items missing from inventory');
  });

  it('should handle non-existent item ID filter gracefully', async () => {
    // Create test user and item
    const userResult = await db.insert(usersTable)
      .values({
        id: 'user_empty123',
        email: 'empty@example.com',
        first_name: 'Empty',
        last_name: 'Test',
        role: 'ADMIN'
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    const itemResult = await db.insert(itemsTable)
      .values({
        name: 'Empty Test Item',
        sku: 'EMPTY-001',
        category: 'Test',
        unit_of_measure: 'pieces',
        current_stock: 10,
        min_stock_level: 1,
        unit_cost: '1.00'
      })
      .returning()
      .execute();
    const itemId = itemResult[0].id;

    // Create adjustment for existing item
    await db.insert(stockAdjustmentsTable)
      .values({
        item_id: itemId,
        adjustment_type: 'ADJUSTMENT',
        quantity_change: 2,
        previous_stock: 10,
        new_stock: 12,
        reason: 'Test adjustment',
        created_by: userId
      })
      .execute();

    // Filter by non-existent item ID
    const nonExistentItemId = 99999;
    const results = await getStockAdjustments(nonExistentItemId);

    expect(results).toEqual([]);
  });

  it('should handle different adjustment types correctly', async () => {
    // Create test user and item
    const userResult = await db.insert(usersTable)
      .values({
        id: 'user_types123',
        email: 'types@example.com',
        first_name: 'Types',
        last_name: 'Test',
        role: 'PURCHASING_STAFF'
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    const itemResult = await db.insert(itemsTable)
      .values({
        name: 'Types Test Item',
        sku: 'TYPES-001',
        category: 'Test',
        unit_of_measure: 'pieces',
        current_stock: 100,
        min_stock_level: 10,
        unit_cost: '5.00'
      })
      .returning()
      .execute();
    const itemId = itemResult[0].id;

    // Create adjustments of all types
    const adjustmentTypes = ['ADJUSTMENT', 'RECEIVED', 'CONSUMED', 'DAMAGED', 'LOST'] as const;
    
    for (let i = 0; i < adjustmentTypes.length; i++) {
      const adjustmentType = adjustmentTypes[i];
      const quantityChange = adjustmentType === 'RECEIVED' || adjustmentType === 'ADJUSTMENT' ? 5 : -5;
      
      await db.insert(stockAdjustmentsTable)
        .values({
          item_id: itemId,
          adjustment_type: adjustmentType,
          quantity_change: quantityChange,
          previous_stock: 100 + (i * quantityChange),
          new_stock: 100 + ((i + 1) * quantityChange),
          reason: `${adjustmentType} test reason`,
          created_by: userId
        })
        .execute();
    }

    const results = await getStockAdjustments(itemId);

    expect(results).toHaveLength(5);

    // Verify all adjustment types are present
    const resultTypes = results.map(r => r.adjustment_type).sort();
    const expectedTypes = [...adjustmentTypes].sort();
    expect(resultTypes).toEqual(expectedTypes);

    // Verify quantity changes are correct
    results.forEach(adjustment => {
      if (adjustment.adjustment_type === 'RECEIVED' || adjustment.adjustment_type === 'ADJUSTMENT') {
        expect(adjustment.quantity_change).toBeGreaterThan(0);
      } else {
        expect(adjustment.quantity_change).toBeLessThan(0);
      }
      
      expect(adjustment.reason).toContain(adjustment.adjustment_type);
    });
  });
});