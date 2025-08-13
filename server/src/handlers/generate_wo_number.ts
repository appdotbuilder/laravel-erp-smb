import { db } from '../db';
import { workOrdersTable } from '../db/schema';
import { sql } from 'drizzle-orm';

export const generateWONumber = async (): Promise<string> => {
  try {
    const year = new Date().getFullYear();
    
    // Query for the highest WO number for the current year
    // Using raw SQL to extract the numeric part and find the maximum
    const result = await db.execute(
      sql`
        SELECT COALESCE(MAX(CAST(RIGHT(wo_number, 6) AS INTEGER)), 0) as max_number
        FROM ${workOrdersTable}
        WHERE wo_number LIKE ${`WO-${year}-%`}
      `
    );
    
    const maxNumber = (result.rows[0] as any)?.max_number || 0;
    const nextNumber = maxNumber + 1;
    
    // Format with leading zeros (6 digits total)
    const formattedNumber = nextNumber.toString().padStart(6, '0');
    
    return `WO-${year}-${formattedNumber}`;
  } catch (error) {
    console.error('WO number generation failed:', error);
    throw error;
  }
};