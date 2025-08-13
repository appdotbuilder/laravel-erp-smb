import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { createUser } from '../handlers/create_user';
import { eq } from 'drizzle-orm';

// Test input with all required fields
const testInput: CreateUserInput = {
  id: 'clerk_user_123',
  email: 'test@example.com',
  first_name: 'John',
  last_name: 'Doe',
  role: 'TECHNICIAN'
};

describe('createUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a user', async () => {
    const result = await createUser(testInput);

    // Basic field validation
    expect(result.id).toEqual('clerk_user_123');
    expect(result.email).toEqual('test@example.com');
    expect(result.first_name).toEqual('John');
    expect(result.last_name).toEqual('Doe');
    expect(result.role).toEqual('TECHNICIAN');
    expect(result.is_active).toBe(true);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save user to database', async () => {
    const result = await createUser(testInput);

    // Query using proper drizzle syntax
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].id).toEqual('clerk_user_123');
    expect(users[0].email).toEqual('test@example.com');
    expect(users[0].first_name).toEqual('John');
    expect(users[0].last_name).toEqual('Doe');
    expect(users[0].role).toEqual('TECHNICIAN');
    expect(users[0].is_active).toBe(true);
    expect(users[0].created_at).toBeInstanceOf(Date);
    expect(users[0].updated_at).toBeInstanceOf(Date);
  });

  it('should create user with different roles', async () => {
    const adminInput: CreateUserInput = {
      ...testInput,
      id: 'admin_user_456',
      email: 'admin@example.com',
      role: 'ADMIN'
    };

    const result = await createUser(adminInput);

    expect(result.role).toEqual('ADMIN');
    expect(result.id).toEqual('admin_user_456');
    expect(result.email).toEqual('admin@example.com');
  });

  it('should create user with WAREHOUSE_MANAGER role', async () => {
    const managerInput: CreateUserInput = {
      ...testInput,
      id: 'manager_user_789',
      email: 'manager@example.com',
      role: 'WAREHOUSE_MANAGER'
    };

    const result = await createUser(managerInput);

    expect(result.role).toEqual('WAREHOUSE_MANAGER');
    expect(result.id).toEqual('manager_user_789');
    expect(result.email).toEqual('manager@example.com');
  });

  it('should create user with PURCHASING_STAFF role', async () => {
    const purchasingInput: CreateUserInput = {
      ...testInput,
      id: 'purchasing_user_101',
      email: 'purchasing@example.com',
      role: 'PURCHASING_STAFF'
    };

    const result = await createUser(purchasingInput);

    expect(result.role).toEqual('PURCHASING_STAFF');
    expect(result.id).toEqual('purchasing_user_101');
    expect(result.email).toEqual('purchasing@example.com');
  });

  it('should handle duplicate email error', async () => {
    // Create first user
    await createUser(testInput);

    // Try to create user with same email but different ID
    const duplicateEmailInput: CreateUserInput = {
      ...testInput,
      id: 'different_clerk_id'
    };

    await expect(createUser(duplicateEmailInput)).rejects.toThrow(/duplicate key value violates unique constraint|unique/i);
  });

  it('should handle duplicate ID error', async () => {
    // Create first user
    await createUser(testInput);

    // Try to create user with same ID but different email
    const duplicateIdInput: CreateUserInput = {
      ...testInput,
      email: 'different@example.com'
    };

    await expect(createUser(duplicateIdInput)).rejects.toThrow(/duplicate key value violates unique constraint|unique/i);
  });

  it('should set timestamps correctly', async () => {
    const beforeCreation = new Date();
    const result = await createUser(testInput);
    const afterCreation = new Date();

    // Verify timestamps are within reasonable range
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.created_at.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
    expect(result.created_at.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    expect(result.updated_at.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
    expect(result.updated_at.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
  });

  it('should default is_active to true', async () => {
    const result = await createUser(testInput);

    expect(result.is_active).toBe(true);

    // Verify in database as well
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users[0].is_active).toBe(true);
  });
});