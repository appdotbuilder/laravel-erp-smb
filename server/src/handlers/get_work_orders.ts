import { db } from '../db';
import { workOrdersTable, usersTable } from '../db/schema';
import { type WorkOrder } from '../schema';
import { eq } from 'drizzle-orm';

export const getWorkOrders = async (): Promise<WorkOrder[]> => {
  try {
    // Query work orders with user information (created_by and assigned_to)
    const results = await db.select({
      id: workOrdersTable.id,
      wo_number: workOrdersTable.wo_number,
      title: workOrdersTable.title,
      description: workOrdersTable.description,
      status: workOrdersTable.status,
      priority: workOrdersTable.priority,
      assigned_to: workOrdersTable.assigned_to,
      estimated_hours: workOrdersTable.estimated_hours,
      actual_hours: workOrdersTable.actual_hours,
      due_date: workOrdersTable.due_date,
      completed_date: workOrdersTable.completed_date,
      created_by: workOrdersTable.created_by,
      created_at: workOrdersTable.created_at,
      updated_at: workOrdersTable.updated_at
    })
    .from(workOrdersTable)
    .leftJoin(usersTable, eq(workOrdersTable.created_by, usersTable.id))
    .execute();

    // Convert numeric and date fields back to proper types before returning
    return results.map(workOrder => ({
      ...workOrder,
      estimated_hours: workOrder.estimated_hours ? parseFloat(workOrder.estimated_hours) : null,
      actual_hours: workOrder.actual_hours ? parseFloat(workOrder.actual_hours) : null,
      due_date: workOrder.due_date ? new Date(workOrder.due_date) : null
    }));
  } catch (error) {
    console.error('Get work orders failed:', error);
    throw error;
  }
};