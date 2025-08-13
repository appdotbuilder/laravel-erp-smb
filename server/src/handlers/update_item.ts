import { db } from '../db';
import { itemsTable, stockAdjustmentsTable } from '../db/schema';
import { type UpdateItemInput, type Item } from '../schema';
import { eq } from 'drizzle-orm';

export const updateItem = async (input: UpdateItemInput, createdBy: string = 'admin-user'): Promise<Item> => {
  try {
    // First, get the current item to check if it exists and get current stock
    const existingItems = await db.select()
      .from(itemsTable)
      .where(eq(itemsTable.id, input.id))
      .execute();

    if (existingItems.length === 0) {
      throw new Error(`Item with id ${input.id} not found`);
    }

    const existingItem = existingItems[0];
    const previousStock = existingItem.current_stock;

    // Prepare update values, excluding id and handling numeric conversions
    const { id, ...updateValues } = input;
    const updateData: any = {};

    // Only include fields that are actually being updated
    Object.keys(updateValues).forEach(key => {
      const value = updateValues[key as keyof typeof updateValues];
      if (value !== undefined) {
        // Convert numeric fields to string for database storage
        if (key === 'unit_cost' && value !== null) {
          updateData[key] = value.toString();
        } else {
          updateData[key] = value;
        }
      }
    });

    // Add updated_at timestamp
    updateData.updated_at = new Date();

    // Update the item
    const result = await db.update(itemsTable)
      .set(updateData)
      .where(eq(itemsTable.id, input.id))
      .returning()
      .execute();

    const updatedItem = result[0];

    // If current_stock was updated, create a stock adjustment record for audit trail
    if (input.current_stock !== undefined && input.current_stock !== previousStock) {
      const quantityChange = input.current_stock - previousStock;
      
      await db.insert(stockAdjustmentsTable)
        .values({
          item_id: input.id,
          adjustment_type: 'ADJUSTMENT',
          quantity_change: quantityChange,
          previous_stock: previousStock,
          new_stock: input.current_stock,
          reason: 'Manual stock adjustment via item update',
          reference_id: null,
          reference_type: null,
          created_by: createdBy
        })
        .execute();
    }

    // Convert numeric fields back to numbers before returning
    return {
      ...updatedItem,
      unit_cost: parseFloat(updatedItem.unit_cost)
    };
  } catch (error) {
    console.error('Item update failed:', error);
    throw error;
  }
};