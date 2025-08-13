import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { workOrdersTable, usersTable } from '../db/schema';
import { generateWONumber } from '../handlers/generate_wo_number';
import { eq } from 'drizzle-orm';

describe('generateWONumber', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should generate first WO number for current year', async () => {
    const result = await generateWONumber();
    const year = new Date().getFullYear();
    
    expect(result).toEqual(`WO-${year}-000001`);
  });

  it('should increment WO number when work orders exist', async () => {
    const year = new Date().getFullYear();
    
    // Create a test user first (required for foreign key)
    await db.insert(usersTable).values({
      id: 'test-user-1',
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      role: 'ADMIN'
    });

    // Insert existing work orders
    await db.insert(workOrdersTable).values([
      {
        wo_number: `WO-${year}-000001`,
        title: 'Test WO 1',
        created_by: 'test-user-1'
      },
      {
        wo_number: `WO-${year}-000003`,
        title: 'Test WO 3',
        created_by: 'test-user-1'
      }
    ]);

    const result = await generateWONumber();
    expect(result).toEqual(`WO-${year}-000004`);
  });

  it('should handle mixed year work orders correctly', async () => {
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;
    
    // Create a test user first
    await db.insert(usersTable).values({
      id: 'test-user-1',
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      role: 'ADMIN'
    });

    // Insert work orders from different years
    await db.insert(workOrdersTable).values([
      {
        wo_number: `WO-${lastYear}-000005`,
        title: 'Last Year WO',
        created_by: 'test-user-1'
      },
      {
        wo_number: `WO-${currentYear}-000002`,
        title: 'Current Year WO',
        created_by: 'test-user-1'
      }
    ]);

    const result = await generateWONumber();
    // Should only consider current year work orders
    expect(result).toEqual(`WO-${currentYear}-000003`);
  });

  it('should handle non-sequential work order numbers', async () => {
    const year = new Date().getFullYear();
    
    // Create a test user first
    await db.insert(usersTable).values({
      id: 'test-user-1',
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      role: 'ADMIN'
    });

    // Insert work orders with gaps in numbering
    await db.insert(workOrdersTable).values([
      {
        wo_number: `WO-${year}-000001`,
        title: 'Test WO 1',
        created_by: 'test-user-1'
      },
      {
        wo_number: `WO-${year}-000010`,
        title: 'Test WO 10',
        created_by: 'test-user-1'
      },
      {
        wo_number: `WO-${year}-000005`,
        title: 'Test WO 5',
        created_by: 'test-user-1'
      }
    ]);

    const result = await generateWONumber();
    // Should increment from the highest number (10)
    expect(result).toEqual(`WO-${year}-000011`);
  });

  it('should generate correct format with proper padding', async () => {
    const year = new Date().getFullYear();
    
    // Create a test user first
    await db.insert(usersTable).values({
      id: 'test-user-1',
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      role: 'ADMIN'
    });

    // Insert work order with high number to test padding
    await db.insert(workOrdersTable).values({
      wo_number: `WO-${year}-000099`,
      title: 'Test WO 99',
      created_by: 'test-user-1'
    });

    const result = await generateWONumber();
    expect(result).toEqual(`WO-${year}-000100`);
    expect(result.length).toEqual(14); // WO- + 4 digits year + - + 6 digits number
  });

  it('should verify generated number is unique in database', async () => {
    const year = new Date().getFullYear();
    
    // Create a test user first
    await db.insert(usersTable).values({
      id: 'test-user-1',
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      role: 'ADMIN'
    });

    const woNumber1 = await generateWONumber();
    
    // Insert the first generated number
    await db.insert(workOrdersTable).values({
      wo_number: woNumber1,
      title: 'Test WO 1',
      created_by: 'test-user-1'
    });

    const woNumber2 = await generateWONumber();
    
    // Second number should be different and incremented
    expect(woNumber2).not.toEqual(woNumber1);
    expect(woNumber2).toEqual(`WO-${year}-000002`);
    
    // Verify both numbers exist in database and are unique
    const workOrders = await db.select()
      .from(workOrdersTable)
      .where(eq(workOrdersTable.wo_number, woNumber1))
      .execute();
    
    expect(workOrders).toHaveLength(1);
    expect(workOrders[0].wo_number).toEqual(woNumber1);
  });

  it('should handle year transition correctly', async () => {
    const currentYear = new Date().getFullYear();
    
    // Create a test user first
    await db.insert(usersTable).values({
      id: 'test-user-1',
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      role: 'ADMIN'
    });

    // Mock work orders from previous year with high numbers
    const lastYear = currentYear - 1;
    await db.insert(workOrdersTable).values({
      wo_number: `WO-${lastYear}-999999`,
      title: 'Last Year High Number WO',
      created_by: 'test-user-1'
    });

    // Current year should start from 1 regardless of previous year numbers
    const result = await generateWONumber();
    expect(result).toEqual(`WO-${currentYear}-000001`);
  });
});