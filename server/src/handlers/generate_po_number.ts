import { db } from '../db';
import { purchaseOrdersTable } from '../db/schema';
import { desc, like } from 'drizzle-orm';

export const generatePONumber = async (): Promise<string> => {
  try {
    const currentYear = new Date().getFullYear();
    const yearPrefix = `PO-${currentYear}-`;

    // Find all PO numbers for the current year
    const existingPOs = await db.select()
      .from(purchaseOrdersTable)
      .where(like(purchaseOrdersTable.po_number, `${yearPrefix}%`))
      .execute();

    let nextNumber = 1;

    if (existingPOs.length > 0) {
      // Find the highest valid sequence number
      let maxSequence = 0;
      
      for (const po of existingPOs) {
        const parts = po.po_number.split('-');
        if (parts.length === 3 && parts[2].length === 6) {
          const sequenceNumber = parseInt(parts[2], 10);
          if (!isNaN(sequenceNumber) && sequenceNumber > maxSequence) {
            maxSequence = sequenceNumber;
          }
        }
      }
      
      if (maxSequence > 0) {
        nextNumber = maxSequence + 1;
      }
    }

    // Format the sequence number with leading zeros (6 digits)
    const formattedSequence = nextNumber.toString().padStart(6, '0');
    
    return `${yearPrefix}${formattedSequence}`;
  } catch (error) {
    console.error('PO number generation failed:', error);
    throw error;
  }
};