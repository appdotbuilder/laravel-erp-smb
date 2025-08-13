import { db } from '../db';
import { itemsTable } from '../db/schema';
import { type GetLowStockItemsInput, type Item } from '../schema';
import { and, lte, eq, sql } from 'drizzle-orm';

export const getLowStockItems = async (input: GetLowStockItemsInput): Promise<Item[]> => {
  try {
    // Query for items where current_stock <= (min_stock_level * threshold_multiplier)
    // and the item is active
    // Cast to numeric to handle fractional multipliers
    const results = await db.select()
      .from(itemsTable)
      .where(
        and(
          lte(itemsTable.current_stock, sql`CAST(${itemsTable.min_stock_level} AS NUMERIC) * ${input.threshold_multiplier}`),
          eq(itemsTable.is_active, true)
        )
      )
      .execute();

    // Convert numeric fields back to numbers before returning
    return results.map(item => ({
      ...item,
      unit_cost: parseFloat(item.unit_cost) // Convert string back to number
    }));
  } catch (error) {
    console.error('Failed to fetch low stock items:', error);
    throw error;
  }
};