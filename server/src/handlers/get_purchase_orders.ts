import { db } from '../db';
import { purchaseOrdersTable, suppliersTable, usersTable } from '../db/schema';
import { type PurchaseOrder } from '../schema';
import { eq } from 'drizzle-orm';

export const getPurchaseOrders = async (): Promise<PurchaseOrder[]> => {
  try {
    // Fetch purchase orders with supplier and creator information
    const results = await db
      .select()
      .from(purchaseOrdersTable)
      .leftJoin(suppliersTable, eq(purchaseOrdersTable.supplier_id, suppliersTable.id))
      .leftJoin(usersTable, eq(purchaseOrdersTable.created_by, usersTable.id))
      .execute();

    // Map the joined results back to PurchaseOrder format
    return results.map(result => {
      const purchaseOrder = result.purchase_orders;
      
      // Convert numeric and date fields to proper types
      return {
        ...purchaseOrder,
        total_amount: parseFloat(purchaseOrder.total_amount),
        expected_delivery_date: purchaseOrder.expected_delivery_date 
          ? new Date(purchaseOrder.expected_delivery_date) 
          : null,
        // Keep the foreign key relationships as they are
        supplier_id: purchaseOrder.supplier_id,
        created_by: purchaseOrder.created_by,
        approved_by: purchaseOrder.approved_by
      };
    });
  } catch (error) {
    console.error('Failed to fetch purchase orders:', error);
    throw error;
  }
};