import { db } from '../db';
import { purchaseOrdersTable, purchaseOrderItemsTable, itemsTable, stockAdjustmentsTable } from '../db/schema';
import { type UpdatePurchaseOrderStatusInput, type PurchaseOrder } from '../schema';
import { eq } from 'drizzle-orm';

export const updatePurchaseOrderStatus = async (input: UpdatePurchaseOrderStatusInput, updatedBy: string): Promise<PurchaseOrder> => {
  try {
    // First, get the current purchase order to check if it exists and get current status
    const existingPO = await db.select()
      .from(purchaseOrdersTable)
      .where(eq(purchaseOrdersTable.id, input.id))
      .execute();

    if (existingPO.length === 0) {
      throw new Error(`Purchase order with id ${input.id} not found`);
    }

    const currentPO = existingPO[0];

    // Prepare update data
    const updateData: any = {
      status: input.status,
      updated_at: new Date()
    };

    // If status is being changed to 'APPROVED', set approved_by field
    if (input.status === 'APPROVED') {
      updateData.approved_by = updatedBy;
    }

    // Update the purchase order status
    const updatedPOResult = await db.update(purchaseOrdersTable)
      .set(updateData)
      .where(eq(purchaseOrdersTable.id, input.id))
      .returning()
      .execute();

    const updatedPO = updatedPOResult[0];

    // If status is 'RECEIVED', update stock levels and create stock adjustments
    if (input.status === 'RECEIVED') {
      // Get all items from this purchase order
      const poItems = await db.select()
        .from(purchaseOrderItemsTable)
        .where(eq(purchaseOrderItemsTable.purchase_order_id, input.id))
        .execute();

      // Update stock levels and create stock adjustments for each item
      for (const poItem of poItems) {
        // Get current item stock
        const currentItem = await db.select()
          .from(itemsTable)
          .where(eq(itemsTable.id, poItem.item_id))
          .execute();

        if (currentItem.length === 0) {
          throw new Error(`Item with id ${poItem.item_id} not found`);
        }

        const item = currentItem[0];
        const previousStock = item.current_stock;
        const quantityToReceive = poItem.quantity - poItem.received_quantity; // Only receive what hasn't been received yet
        const newStock = previousStock + quantityToReceive;

        // Update item stock
        await db.update(itemsTable)
          .set({
            current_stock: newStock,
            updated_at: new Date()
          })
          .where(eq(itemsTable.id, poItem.item_id))
          .execute();

        // Update received quantity in purchase order item
        await db.update(purchaseOrderItemsTable)
          .set({
            received_quantity: poItem.quantity // Mark all as received
          })
          .where(eq(purchaseOrderItemsTable.id, poItem.id))
          .execute();

        // Create stock adjustment record
        if (quantityToReceive > 0) {
          await db.insert(stockAdjustmentsTable)
            .values({
              item_id: poItem.item_id,
              adjustment_type: 'RECEIVED',
              quantity_change: quantityToReceive,
              previous_stock: previousStock,
              new_stock: newStock,
              reason: `Items received from Purchase Order ${currentPO.po_number}`,
              reference_id: input.id,
              reference_type: 'purchase_order',
              created_by: updatedBy
            })
            .execute();
        }
      }
    }

    // Convert numeric fields back to numbers before returning
    return {
      ...updatedPO,
      total_amount: parseFloat(updatedPO.total_amount),
      expected_delivery_date: updatedPO.expected_delivery_date ? new Date(updatedPO.expected_delivery_date) : null
    };
  } catch (error) {
    console.error('Purchase order status update failed:', error);
    throw error;
  }
};