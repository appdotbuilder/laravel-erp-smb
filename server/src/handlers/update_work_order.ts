import { db } from '../db';
import { workOrdersTable, workOrderItemsTable, itemsTable, stockAdjustmentsTable } from '../db/schema';
import { type UpdateWorkOrderInput, type WorkOrder } from '../schema';
import { eq } from 'drizzle-orm';

export const updateWorkOrder = async (input: UpdateWorkOrderInput): Promise<WorkOrder> => {
  try {
    // Check if work order exists
    const existingWorkOrder = await db.select()
      .from(workOrdersTable)
      .where(eq(workOrdersTable.id, input.id))
      .execute();

    if (existingWorkOrder.length === 0) {
      throw new Error(`Work order with id ${input.id} not found`);
    }

    const currentWorkOrder = existingWorkOrder[0];
    const isCompletingWorkOrder = input.status === 'COMPLETED' && currentWorkOrder.status !== 'COMPLETED';

    // Prepare update data
    const updateData: any = {
      updated_at: new Date()
    };

    // Handle optional fields
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.assigned_to !== undefined) updateData.assigned_to = input.assigned_to;
    if (input.estimated_hours !== undefined) updateData.estimated_hours = input.estimated_hours ? input.estimated_hours.toString() : null;
    if (input.actual_hours !== undefined) updateData.actual_hours = input.actual_hours ? input.actual_hours.toString() : null;
    if (input.due_date !== undefined) {
      updateData.due_date = input.due_date ? input.due_date.toISOString().split('T')[0] : null;
    }
    if (input.completed_date !== undefined) updateData.completed_date = input.completed_date;

    // If completing work order, set completed_date if not provided
    if (isCompletingWorkOrder && input.completed_date === undefined) {
      updateData.completed_date = new Date();
    }

    // Start transaction for work order completion with inventory updates
    return await db.transaction(async (tx) => {
      // Update the work order
      const updatedWorkOrderResult = await tx.update(workOrdersTable)
        .set(updateData)
        .where(eq(workOrdersTable.id, input.id))
        .returning()
        .execute();

      const updatedWorkOrder = updatedWorkOrderResult[0];

      // If completing work order, handle inventory deductions
      if (isCompletingWorkOrder) {
        // Get work order items to process inventory deductions
        const workOrderItems = await tx.select()
          .from(workOrderItemsTable)
          .where(eq(workOrderItemsTable.work_order_id, input.id))
          .execute();

        // Process each work order item
        for (const workOrderItem of workOrderItems) {
          const quantityToDeduct = workOrderItem.quantity_used;
          
          if (quantityToDeduct > 0) {
            // Get current item stock
            const currentItem = await tx.select()
              .from(itemsTable)
              .where(eq(itemsTable.id, workOrderItem.item_id))
              .execute();

            if (currentItem.length === 0) {
              throw new Error(`Item with id ${workOrderItem.item_id} not found`);
            }

            const item = currentItem[0];
            const previousStock = item.current_stock;
            const newStock = previousStock - quantityToDeduct;

            if (newStock < 0) {
              throw new Error(`Insufficient stock for item ${item.name}. Current: ${previousStock}, Required: ${quantityToDeduct}`);
            }

            // Update item stock
            await tx.update(itemsTable)
              .set({
                current_stock: newStock,
                updated_at: new Date()
              })
              .where(eq(itemsTable.id, workOrderItem.item_id))
              .execute();

            // Create stock adjustment record
            await tx.insert(stockAdjustmentsTable)
              .values({
                item_id: workOrderItem.item_id,
                adjustment_type: 'CONSUMED',
                quantity_change: -quantityToDeduct,
                previous_stock: previousStock,
                new_stock: newStock,
                reason: `Consumed for work order ${updatedWorkOrder.wo_number}`,
                reference_id: input.id,
                reference_type: 'work_order',
                created_by: updatedWorkOrder.created_by
              })
              .execute();
          }
        }
      }

      // Convert numeric fields back to numbers and handle date fields
      return {
        ...updatedWorkOrder,
        estimated_hours: updatedWorkOrder.estimated_hours ? parseFloat(updatedWorkOrder.estimated_hours) : null,
        actual_hours: updatedWorkOrder.actual_hours ? parseFloat(updatedWorkOrder.actual_hours) : null,
        due_date: updatedWorkOrder.due_date ? new Date(updatedWorkOrder.due_date) : null
      };
    });
  } catch (error) {
    console.error('Work order update failed:', error);
    throw error;
  }
};