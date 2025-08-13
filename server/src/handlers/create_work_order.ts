import { db } from '../db';
import { workOrdersTable, workOrderItemsTable } from '../db/schema';
import { type CreateWorkOrderInput, type WorkOrder } from '../schema';
import { sql, desc } from 'drizzle-orm';

export const createWorkOrder = async (input: CreateWorkOrderInput, createdBy: string): Promise<WorkOrder> => {
  try {
    // Generate unique WO number
    const woNumber = await generateWONumber();
    
    // Start transaction to ensure data consistency
    const result = await db.transaction(async (tx) => {
      // Create the work order
      const workOrderResult = await tx.insert(workOrdersTable)
        .values({
          wo_number: woNumber,
          title: input.title,
          description: input.description || null,
          status: 'CREATED',
          priority: input.priority,
          assigned_to: input.assigned_to || null,
          estimated_hours: input.estimated_hours ? input.estimated_hours.toString() : null,
          actual_hours: null,
          due_date: input.due_date ? input.due_date.toISOString().split('T')[0] : null,
          completed_date: null,
          created_by: createdBy
        })
        .returning()
        .execute();

      const workOrder = workOrderResult[0];

      // Create work order items if provided
      if (input.items && input.items.length > 0) {
        await tx.insert(workOrderItemsTable)
          .values(input.items.map(item => ({
            work_order_id: workOrder.id,
            item_id: item.item_id,
            quantity_planned: item.quantity_planned,
            quantity_used: 0
          })))
          .execute();
      }

      return workOrder;
    });

    // Convert numeric and date fields back to proper types before returning
    return {
      ...result,
      estimated_hours: result.estimated_hours ? parseFloat(result.estimated_hours) : null,
      actual_hours: result.actual_hours ? parseFloat(result.actual_hours) : null,
      due_date: result.due_date ? new Date(result.due_date) : null
    };
  } catch (error) {
    console.error('Work order creation failed:', error);
    throw error;
  }
};

// Helper function to generate unique WO number
const generateWONumber = async (): Promise<string> => {
  const currentYear = new Date().getFullYear();
  
  // Get the latest WO number for the current year
  const latestWO = await db.select()
    .from(workOrdersTable)
    .where(sql`${workOrdersTable.wo_number} LIKE 'WO-' || ${currentYear} || '-%'`)
    .orderBy(desc(workOrdersTable.wo_number))
    .limit(1)
    .execute();

  let nextNumber = 1;
  if (latestWO.length > 0) {
    // Extract the number part from WO-YYYY-NNNNNN format
    const match = latestWO[0].wo_number.match(/WO-\d{4}-(\d{6})/);
    if (match) {
      nextNumber = parseInt(match[1]) + 1;
    }
  }

  // Format as WO-YYYY-NNNNNN (6-digit padded number)
  return `WO-${currentYear}-${nextNumber.toString().padStart(6, '0')}`;
};