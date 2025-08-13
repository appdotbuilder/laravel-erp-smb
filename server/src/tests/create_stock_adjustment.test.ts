import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, itemsTable, stockAdjustmentsTable } from '../db/schema';
import { type CreateStockAdjustmentInput } from '../schema';
import { createStockAdjustment } from '../handlers/create_stock_adjustment';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  id: 'user_1',
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  role: 'WAREHOUSE_MANAGER' as const,
  is_active: true
};

const testItem = {
  name: 'Test Item',
  description: 'A test inventory item',
  sku: 'TEST-001',
  category: 'Electronics',
  unit_of_measure: 'pieces',
  current_stock: 100,
  min_stock_level: 10,
  unit_cost: '25.50', // Convert to string for numeric column
  is_active: true
};

const testAdjustmentInput: CreateStockAdjustmentInput = {
  item_id: 0, // Will be set after item creation
  adjustment_type: 'ADJUSTMENT',
  quantity_change: 15,
  reason: 'Manual stock count adjustment'
};

describe('createStockAdjustment', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let itemId: number;

  beforeEach(async () => {
    // Create prerequisite user
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    // Create prerequisite item
    const itemResult = await db.insert(itemsTable)
      .values(testItem)
      .returning()
      .execute();

    itemId = itemResult[0].id;
  });

  it('should create stock adjustment with positive quantity change', async () => {
    const input = {
      ...testAdjustmentInput,
      item_id: itemId
    };

    const result = await createStockAdjustment(input, testUser.id);

    // Validate stock adjustment record
    expect(result.id).toBeDefined();
    expect(result.item_id).toEqual(itemId);
    expect(result.adjustment_type).toEqual('ADJUSTMENT');
    expect(result.quantity_change).toEqual(15);
    expect(result.previous_stock).toEqual(100);
    expect(result.new_stock).toEqual(115);
    expect(result.reason).toEqual('Manual stock count adjustment');
    expect(result.reference_id).toBeNull();
    expect(result.reference_type).toBeNull();
    expect(result.created_by).toEqual(testUser.id);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should update item current stock correctly', async () => {
    const input = {
      ...testAdjustmentInput,
      item_id: itemId,
      quantity_change: 25
    };

    await createStockAdjustment(input, testUser.id);

    // Verify item stock was updated
    const items = await db.select()
      .from(itemsTable)
      .where(eq(itemsTable.id, itemId))
      .execute();

    expect(items[0].current_stock).toEqual(125);
    expect(items[0].updated_at).toBeInstanceOf(Date);
  });

  it('should create stock adjustment with negative quantity change', async () => {
    const input = {
      ...testAdjustmentInput,
      item_id: itemId,
      adjustment_type: 'CONSUMED' as const,
      quantity_change: -30,
      reason: 'Used in work order'
    };

    const result = await createStockAdjustment(input, testUser.id);

    expect(result.adjustment_type).toEqual('CONSUMED');
    expect(result.quantity_change).toEqual(-30);
    expect(result.previous_stock).toEqual(100);
    expect(result.new_stock).toEqual(70);
    expect(result.reason).toEqual('Used in work order');
  });

  it('should handle all adjustment types correctly', async () => {
    const adjustmentTypes = ['ADJUSTMENT', 'RECEIVED', 'CONSUMED', 'DAMAGED', 'LOST'] as const;

    for (const adjustmentType of adjustmentTypes) {
      const input = {
        ...testAdjustmentInput,
        item_id: itemId,
        adjustment_type: adjustmentType,
        quantity_change: adjustmentType === 'RECEIVED' ? 10 : -5,
        reason: `Test ${adjustmentType} adjustment`
      };

      const result = await createStockAdjustment(input, testUser.id);
      expect(result.adjustment_type).toEqual(adjustmentType);
    }
  });

  it('should save stock adjustment to database', async () => {
    const input = {
      ...testAdjustmentInput,
      item_id: itemId,
      quantity_change: 20
    };

    const result = await createStockAdjustment(input, testUser.id);

    // Query database to verify record was saved
    const adjustments = await db.select()
      .from(stockAdjustmentsTable)
      .where(eq(stockAdjustmentsTable.id, result.id))
      .execute();

    expect(adjustments).toHaveLength(1);
    expect(adjustments[0].item_id).toEqual(itemId);
    expect(adjustments[0].adjustment_type).toEqual('ADJUSTMENT');
    expect(adjustments[0].quantity_change).toEqual(20);
    expect(adjustments[0].previous_stock).toEqual(100);
    expect(adjustments[0].new_stock).toEqual(120);
    expect(adjustments[0].created_by).toEqual(testUser.id);
  });

  it('should handle reference fields correctly', async () => {
    const input = {
      ...testAdjustmentInput,
      item_id: itemId,
      reference_id: 123,
      reference_type: 'purchase_order'
    };

    const result = await createStockAdjustment(input, testUser.id);

    expect(result.reference_id).toEqual(123);
    expect(result.reference_type).toEqual('purchase_order');
  });

  it('should prevent negative stock from adjustment', async () => {
    const input = {
      ...testAdjustmentInput,
      item_id: itemId,
      quantity_change: -150, // Would result in -50 stock
      reason: 'Large consumption'
    };

    await expect(createStockAdjustment(input, testUser.id))
      .rejects.toThrow(/negative stock/i);
  });

  it('should throw error for non-existent item', async () => {
    const input = {
      ...testAdjustmentInput,
      item_id: 999999, // Non-existent item ID
      quantity_change: 10
    };

    await expect(createStockAdjustment(input, testUser.id))
      .rejects.toThrow(/Item with ID 999999 not found/i);
  });

  it('should handle zero quantity change', async () => {
    const input = {
      ...testAdjustmentInput,
      item_id: itemId,
      quantity_change: 0,
      reason: 'Stock count verification - no change needed'
    };

    const result = await createStockAdjustment(input, testUser.id);

    expect(result.quantity_change).toEqual(0);
    expect(result.previous_stock).toEqual(100);
    expect(result.new_stock).toEqual(100);

    // Verify item stock unchanged
    const items = await db.select()
      .from(itemsTable)
      .where(eq(itemsTable.id, itemId))
      .execute();

    expect(items[0].current_stock).toEqual(100);
  });

  it('should handle multiple adjustments on same item', async () => {
    // First adjustment: +20
    const input1 = {
      ...testAdjustmentInput,
      item_id: itemId,
      quantity_change: 20,
      reason: 'First adjustment'
    };

    const result1 = await createStockAdjustment(input1, testUser.id);
    expect(result1.previous_stock).toEqual(100);
    expect(result1.new_stock).toEqual(120);

    // Second adjustment: -10
    const input2 = {
      ...testAdjustmentInput,
      item_id: itemId,
      quantity_change: -10,
      reason: 'Second adjustment'
    };

    const result2 = await createStockAdjustment(input2, testUser.id);
    expect(result2.previous_stock).toEqual(120);
    expect(result2.new_stock).toEqual(110);

    // Verify final item stock
    const items = await db.select()
      .from(itemsTable)
      .where(eq(itemsTable.id, itemId))
      .execute();

    expect(items[0].current_stock).toEqual(110);
  });
});