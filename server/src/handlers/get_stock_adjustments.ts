import { db } from '../db';
import { stockAdjustmentsTable, itemsTable, usersTable } from '../db/schema';
import { type StockAdjustment } from '../schema';
import { eq, desc } from 'drizzle-orm';

export const getStockAdjustments = async (itemId?: number): Promise<StockAdjustment[]> => {
  try {
    // Build base query with joins for complete audit trail
    const baseQuery = db.select({
      id: stockAdjustmentsTable.id,
      item_id: stockAdjustmentsTable.item_id,
      adjustment_type: stockAdjustmentsTable.adjustment_type,
      quantity_change: stockAdjustmentsTable.quantity_change,
      previous_stock: stockAdjustmentsTable.previous_stock,
      new_stock: stockAdjustmentsTable.new_stock,
      reason: stockAdjustmentsTable.reason,
      reference_id: stockAdjustmentsTable.reference_id,
      reference_type: stockAdjustmentsTable.reference_type,
      created_by: stockAdjustmentsTable.created_by,
      created_at: stockAdjustmentsTable.created_at,
      // Include related item information
      item_name: itemsTable.name,
      item_sku: itemsTable.sku,
      // Include user information
      user_first_name: usersTable.first_name,
      user_last_name: usersTable.last_name
    })
    .from(stockAdjustmentsTable)
    .innerJoin(itemsTable, eq(stockAdjustmentsTable.item_id, itemsTable.id))
    .innerJoin(usersTable, eq(stockAdjustmentsTable.created_by, usersTable.id));

    // Build final query with conditional where clause
    const finalQuery = itemId !== undefined
      ? baseQuery
          .where(eq(stockAdjustmentsTable.item_id, itemId))
          .orderBy(desc(stockAdjustmentsTable.created_at))
      : baseQuery
          .orderBy(desc(stockAdjustmentsTable.created_at));

    const results = await finalQuery.execute();

    // Map results to match StockAdjustment schema
    return results.map(result => ({
      id: result.id,
      item_id: result.item_id,
      adjustment_type: result.adjustment_type,
      quantity_change: result.quantity_change,
      previous_stock: result.previous_stock,
      new_stock: result.new_stock,
      reason: result.reason,
      reference_id: result.reference_id,
      reference_type: result.reference_type,
      created_by: result.created_by,
      created_at: result.created_at
    }));
  } catch (error) {
    console.error('Failed to fetch stock adjustments:', error);
    throw error;
  }
};