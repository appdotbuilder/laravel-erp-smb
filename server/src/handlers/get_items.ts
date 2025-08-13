import { db } from '../db';
import { itemsTable } from '../db/schema';
import { type Item } from '../schema';
import { eq } from 'drizzle-orm';

export const getItems = async (): Promise<Item[]> => {
  try {
    // Fetch all active items from the database
    const results = await db.select()
      .from(itemsTable)
      .where(eq(itemsTable.is_active, true))
      .execute();

    // Convert numeric fields back to numbers before returning
    return results.map(item => ({
      ...item,
      unit_cost: parseFloat(item.unit_cost) // Convert string back to number
    }));
  } catch (error) {
    console.error('Fetching items failed:', error);
    throw error;
  }
};