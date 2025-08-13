import { db } from '../db';
import { workOrdersTable, workOrderItemsTable, itemsTable, stockAdjustmentsTable } from '../db/schema';
import { type WorkOrder } from '../schema';
import { eq } from 'drizzle-orm';

export const completeWorkOrder = async (workOrderId: number, actualHours: number, completedBy: string): Promise<WorkOrder> => {
  try {
    // Start transaction to ensure all operations succeed or fail together
    return await db.transaction(async (tx) => {
      // 1. Check if work order exists and get current status
      const existingWorkOrders = await tx.select()
        .from(workOrdersTable)
        .where(eq(workOrdersTable.id, workOrderId))
        .execute();

      if (existingWorkOrders.length === 0) {
        throw new Error(`Work order with ID ${workOrderId} not found`);
      }

      const existingWorkOrder = existingWorkOrders[0];

      if (existingWorkOrder.status === 'COMPLETED') {
        throw new Error(`Work order ${workOrderId} is already completed`);
      }

      if (existingWorkOrder.status === 'CANCELLED') {
        throw new Error(`Cannot complete cancelled work order ${workOrderId}`);
      }

      // 2. Get all work order items with their current usage
      const workOrderItems = await tx.select()
        .from(workOrderItemsTable)
        .where(eq(workOrderItemsTable.work_order_id, workOrderId))
        .execute();

      // 3. Process each item: deduct from inventory and create stock adjustments
      for (const workOrderItem of workOrderItems) {
        if (workOrderItem.quantity_used > 0) {
          // Get current item stock
          const items = await tx.select()
            .from(itemsTable)
            .where(eq(itemsTable.id, workOrderItem.item_id))
            .execute();

          if (items.length === 0) {
            throw new Error(`Item with ID ${workOrderItem.item_id} not found`);
          }

          const item = items[0];
          const quantityToDeduct = workOrderItem.quantity_used;
          
          if (item.current_stock < quantityToDeduct) {
            throw new Error(`Insufficient stock for item ${item.name}. Available: ${item.current_stock}, Required: ${quantityToDeduct}`);
          }

          const previousStock = item.current_stock;
          const newStock = previousStock - quantityToDeduct;

          // Update item stock
          await tx.update(itemsTable)
            .set({ 
              current_stock: newStock,
              updated_at: new Date()
            })
            .where(eq(itemsTable.id, workOrderItem.item_id))
            .execute();

          // Create stock adjustment record for audit trail
          await tx.insert(stockAdjustmentsTable)
            .values({
              item_id: workOrderItem.item_id,
              adjustment_type: 'CONSUMED',
              quantity_change: -quantityToDeduct, // Negative for consumption
              previous_stock: previousStock,
              new_stock: newStock,
              reason: `Consumed in work order ${existingWorkOrder.wo_number}`,
              reference_id: workOrderId,
              reference_type: 'work_order',
              created_by: completedBy
            })
            .execute();
        }
      }

      // 4. Update work order status to COMPLETED
      const completedDate = new Date();
      const updatedWorkOrders = await tx.update(workOrdersTable)
        .set({
          status: 'COMPLETED',
          actual_hours: actualHours.toString(), // Convert to string for numeric column
          completed_date: completedDate,
          updated_at: completedDate
        })
        .where(eq(workOrdersTable.id, workOrderId))
        .returning()
        .execute();

      const updatedWorkOrder = updatedWorkOrders[0];

      // Convert numeric and date fields properly for return
      return {
        ...updatedWorkOrder,
        actual_hours: updatedWorkOrder.actual_hours ? parseFloat(updatedWorkOrder.actual_hours) : null,
        estimated_hours: updatedWorkOrder.estimated_hours ? parseFloat(updatedWorkOrder.estimated_hours) : null,
        due_date: updatedWorkOrder.due_date ? new Date(updatedWorkOrder.due_date) : null
      };
    });
  } catch (error) {
    console.error('Work order completion failed:', error);
    throw error;
  }
};