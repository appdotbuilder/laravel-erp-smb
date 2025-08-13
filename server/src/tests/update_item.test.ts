import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { itemsTable, stockAdjustmentsTable, usersTable } from '../db/schema';
import { type UpdateItemInput, type CreateItemInput } from '../schema';
import { updateItem } from '../handlers/update_item';
import { eq, desc } from 'drizzle-orm';

// Helper function to create a test user
const createTestUser = async () => {
  const result = await db.insert(usersTable)
    .values({
      id: 'test-user-id',
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      role: 'ADMIN'
    })
    .returning()
    .execute();
  
  return result[0];
};

// Helper function to create a test item
const createTestItem = async (overrides: any = {}) => {
  const testInput: CreateItemInput = {
    name: 'Test Item',
    description: 'A test item',
    sku: 'TEST-001',
    category: 'Test Category',
    unit_of_measure: 'pieces',
    current_stock: 100,
    min_stock_level: 10,
    unit_cost: 25.50,
    ...overrides
  };

  const result = await db.insert(itemsTable)
    .values({
      ...testInput,
      unit_cost: testInput.unit_cost.toString(),
      description: testInput.description || null
    })
    .returning()
    .execute();

  return result[0];
};

describe('updateItem', () => {
  let testUser: any;

  beforeEach(async () => {
    await createDB();
    testUser = await createTestUser();
  });
  
  afterEach(resetDB);

  it('should update basic item fields', async () => {
    const existingItem = await createTestItem();

    const updateInput: UpdateItemInput = {
      id: existingItem.id,
      name: 'Updated Item Name',
      description: 'Updated description',
      category: 'Updated Category',
      unit_of_measure: 'kg'
    };

    const result = await updateItem(updateInput, testUser.id);

    expect(result.id).toEqual(existingItem.id);
    expect(result.name).toEqual('Updated Item Name');
    expect(result.description).toEqual('Updated description');
    expect(result.category).toEqual('Updated Category');
    expect(result.unit_of_measure).toEqual('kg');
    expect(result.sku).toEqual(existingItem.sku); // Unchanged
    expect(result.current_stock).toEqual(existingItem.current_stock); // Unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at > existingItem.updated_at).toBe(true);
  });

  it('should update numeric fields correctly', async () => {
    const existingItem = await createTestItem();

    const updateInput: UpdateItemInput = {
      id: existingItem.id,
      unit_cost: 35.75,
      min_stock_level: 15
    };

    const result = await updateItem(updateInput, testUser.id);

    expect(typeof result.unit_cost).toBe('number');
    expect(result.unit_cost).toEqual(35.75);
    expect(result.min_stock_level).toEqual(15);
  });

  it('should update item in database', async () => {
    const existingItem = await createTestItem();

    const updateInput: UpdateItemInput = {
      id: existingItem.id,
      name: 'Database Updated Name',
      unit_cost: 42.00
    };

    await updateItem(updateInput, testUser.id);

    const updatedItems = await db.select()
      .from(itemsTable)
      .where(eq(itemsTable.id, existingItem.id))
      .execute();

    expect(updatedItems).toHaveLength(1);
    expect(updatedItems[0].name).toEqual('Database Updated Name');
    expect(parseFloat(updatedItems[0].unit_cost)).toEqual(42.00);
  });

  it('should create stock adjustment record when current_stock is updated', async () => {
    const existingItem = await createTestItem({ current_stock: 100 });

    const updateInput: UpdateItemInput = {
      id: existingItem.id,
      current_stock: 150
    };

    const result = await updateItem(updateInput, testUser.id);

    expect(result.current_stock).toEqual(150);

    // Check that stock adjustment record was created
    const adjustments = await db.select()
      .from(stockAdjustmentsTable)
      .where(eq(stockAdjustmentsTable.item_id, existingItem.id))
      .orderBy(desc(stockAdjustmentsTable.created_at))
      .execute();

    expect(adjustments).toHaveLength(1);
    expect(adjustments[0].adjustment_type).toEqual('ADJUSTMENT');
    expect(adjustments[0].quantity_change).toEqual(50); // 150 - 100
    expect(adjustments[0].previous_stock).toEqual(100);
    expect(adjustments[0].new_stock).toEqual(150);
    expect(adjustments[0].reason).toEqual('Manual stock adjustment via item update');
    expect(adjustments[0].reference_id).toBeNull();
    expect(adjustments[0].reference_type).toBeNull();
    expect(adjustments[0].created_by).toEqual(testUser.id);
  });

  it('should handle stock decrease with negative adjustment', async () => {
    const existingItem = await createTestItem({ current_stock: 100 });

    const updateInput: UpdateItemInput = {
      id: existingItem.id,
      current_stock: 75
    };

    await updateItem(updateInput, testUser.id);

    const adjustments = await db.select()
      .from(stockAdjustmentsTable)
      .where(eq(stockAdjustmentsTable.item_id, existingItem.id))
      .execute();

    expect(adjustments).toHaveLength(1);
    expect(adjustments[0].quantity_change).toEqual(-25); // 75 - 100
    expect(adjustments[0].previous_stock).toEqual(100);
    expect(adjustments[0].new_stock).toEqual(75);
  });

  it('should not create stock adjustment when current_stock is not changed', async () => {
    const existingItem = await createTestItem();

    const updateInput: UpdateItemInput = {
      id: existingItem.id,
      name: 'Updated Name Only',
      unit_cost: 30.00
    };

    await updateItem(updateInput, testUser.id);

    const adjustments = await db.select()
      .from(stockAdjustmentsTable)
      .where(eq(stockAdjustmentsTable.item_id, existingItem.id))
      .execute();

    expect(adjustments).toHaveLength(0);
  });

  it('should update is_active status', async () => {
    const existingItem = await createTestItem();

    const updateInput: UpdateItemInput = {
      id: existingItem.id,
      is_active: false
    };

    const result = await updateItem(updateInput, testUser.id);

    expect(result.is_active).toBe(false);

    // Verify in database
    const items = await db.select()
      .from(itemsTable)
      .where(eq(itemsTable.id, existingItem.id))
      .execute();

    expect(items[0].is_active).toBe(false);
  });

  it('should handle partial updates correctly', async () => {
    const existingItem = await createTestItem({
      name: 'Original Name',
      description: 'Original Description',
      unit_cost: 10.00
    });

    const updateInput: UpdateItemInput = {
      id: existingItem.id,
      unit_cost: 15.00 // Only updating unit_cost
    };

    const result = await updateItem(updateInput, testUser.id);

    expect(result.name).toEqual('Original Name'); // Unchanged
    expect(result.description).toEqual('Original Description'); // Unchanged
    expect(result.unit_cost).toEqual(15.00); // Updated
  });

  it('should handle null values in optional fields', async () => {
    const existingItem = await createTestItem({ description: 'Original Description' });

    const updateInput: UpdateItemInput = {
      id: existingItem.id,
      description: null
    };

    const result = await updateItem(updateInput, testUser.id);

    expect(result.description).toBeNull();
  });

  it('should throw error when item does not exist', async () => {
    const updateInput: UpdateItemInput = {
      id: 99999, // Non-existent ID
      name: 'Updated Name'
    };

    await expect(updateItem(updateInput)).rejects.toThrow(/Item with id 99999 not found/i);
  });

  it('should handle zero stock adjustment correctly', async () => {
    const existingItem = await createTestItem({ current_stock: 50 });

    const updateInput: UpdateItemInput = {
      id: existingItem.id,
      current_stock: 0
    };

    const result = await updateItem(updateInput, testUser.id);

    expect(result.current_stock).toEqual(0);

    const adjustments = await db.select()
      .from(stockAdjustmentsTable)
      .where(eq(stockAdjustmentsTable.item_id, existingItem.id))
      .execute();

    expect(adjustments).toHaveLength(1);
    expect(adjustments[0].quantity_change).toEqual(-50);
    expect(adjustments[0].new_stock).toEqual(0);
  });

  it('should update multiple fields including stock in single operation', async () => {
    const existingItem = await createTestItem({
      name: 'Old Name',
      current_stock: 100,
      unit_cost: 20.00,
      is_active: true
    });

    const updateInput: UpdateItemInput = {
      id: existingItem.id,
      name: 'New Name',
      current_stock: 200,
      unit_cost: 25.50,
      is_active: false
    };

    const result = await updateItem(updateInput, testUser.id);

    expect(result.name).toEqual('New Name');
    expect(result.current_stock).toEqual(200);
    expect(result.unit_cost).toEqual(25.50);
    expect(result.is_active).toBe(false);

    // Verify stock adjustment was created
    const adjustments = await db.select()
      .from(stockAdjustmentsTable)
      .where(eq(stockAdjustmentsTable.item_id, existingItem.id))
      .execute();

    expect(adjustments).toHaveLength(1);
    expect(adjustments[0].quantity_change).toEqual(100);
  });
});