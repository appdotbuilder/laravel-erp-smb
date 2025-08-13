import { db } from '../db';
import { stockAdjustmentsTable, itemsTable } from '../db/schema';
import { type CreateStockAdjustmentInput, type StockAdjustment } from '../schema';
import { eq } from 'drizzle-orm';

export const createStockAdjustment = async (input: CreateStockAdjustmentInput, createdBy: string): Promise<StockAdjustment> => {
  try {
    // Fetch current item to get current stock and validate existence
    const items = await db.select()
      .from(itemsTable)
      .where(eq(itemsTable.id, input.item_id))
      .execute();

    if (items.length === 0) {
      throw new Error(`Item with ID ${input.item_id} not found`);
    }

    const item = items[0];
    const previousStock = item.current_stock;
    const newStock = previousStock + input.quantity_change;

    // Validate that adjustment doesn't result in negative stock
    if (newStock < 0) {
      throw new Error(`Stock adjustment would result in negative stock. Current: ${previousStock}, Change: ${input.quantity_change}, Result: ${newStock}`);
    }

    // Create stock adjustment record
    const result = await db.insert(stockAdjustmentsTable)
      .values({
        item_id: input.item_id,
        adjustment_type: input.adjustment_type,
        quantity_change: input.quantity_change,
        previous_stock: previousStock,
        new_stock: newStock,
        reason: input.reason,
        reference_id: input.reference_id || null,
        reference_type: input.reference_type || null,
        created_by: createdBy
      })
      .returning()
      .execute();

    // Update item's current stock
    await db.update(itemsTable)
      .set({ 
        current_stock: newStock,
        updated_at: new Date()
      })
      .where(eq(itemsTable.id, input.item_id))
      .execute();

    return result[0];
  } catch (error) {
    console.error('Stock adjustment creation failed:', error);
    throw error;
  }
};