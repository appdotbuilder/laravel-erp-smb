import { db } from '../db';
import { suppliersTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type Supplier } from '../schema';

export const getSuppliers = async (): Promise<Supplier[]> => {
  try {
    const results = await db.select()
      .from(suppliersTable)
      .where(eq(suppliersTable.is_active, true))
      .execute();

    // Convert date fields and return the suppliers
    return results.map(supplier => ({
      ...supplier,
      created_at: new Date(supplier.created_at),
      updated_at: new Date(supplier.updated_at)
    }));
  } catch (error) {
    console.error('Failed to fetch suppliers:', error);
    throw error;
  }
};