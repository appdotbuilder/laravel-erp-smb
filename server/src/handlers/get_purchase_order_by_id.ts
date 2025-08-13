import { db } from '../db';
import { purchaseOrdersTable } from '../db/schema';
import { type PurchaseOrder } from '../schema';
import { eq } from 'drizzle-orm';

export const getPurchaseOrderById = async (id: number): Promise<PurchaseOrder | null> => {
  try {
    const results = await db.select()
      .from(purchaseOrdersTable)
      .where(eq(purchaseOrdersTable.id, id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    // Convert numeric fields back to numbers and handle date conversion
    const purchaseOrder = results[0];
    return {
      ...purchaseOrder,
      total_amount: parseFloat(purchaseOrder.total_amount),
      expected_delivery_date: purchaseOrder.expected_delivery_date 
        ? new Date(purchaseOrder.expected_delivery_date) 
        : null
    };
  } catch (error) {
    console.error('Get purchase order by ID failed:', error);
    throw error;
  }
};