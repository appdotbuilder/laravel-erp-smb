import { db } from '../db';
import { workOrdersTable } from '../db/schema';
import { type WorkOrder } from '../schema';
import { eq } from 'drizzle-orm';

export const getWorkOrderById = async (id: number): Promise<WorkOrder | null> => {
  try {
    const results = await db.select()
      .from(workOrdersTable)
      .where(eq(workOrdersTable.id, id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const workOrder = results[0];
    
    // Convert numeric fields back to numbers and date fields to Date objects
    return {
      ...workOrder,
      estimated_hours: workOrder.estimated_hours ? parseFloat(workOrder.estimated_hours) : null,
      actual_hours: workOrder.actual_hours ? parseFloat(workOrder.actual_hours) : null,
      due_date: workOrder.due_date ? new Date(workOrder.due_date) : null
    };
  } catch (error) {
    console.error('Failed to get work order by ID:', error);
    throw error;
  }
};