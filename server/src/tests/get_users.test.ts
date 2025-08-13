import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { getUsers } from '../handlers/get_users';

// Test user data
const testUser1: CreateUserInput = {
  id: 'user_test_1',
  email: 'admin@example.com',
  first_name: 'John',
  last_name: 'Admin',
  role: 'ADMIN'
};

const testUser2: CreateUserInput = {
  id: 'user_test_2',
  email: 'manager@example.com',
  first_name: 'Jane',
  last_name: 'Manager',
  role: 'WAREHOUSE_MANAGER'
};

const testUser3: CreateUserInput = {
  id: 'user_test_3',
  email: 'tech@example.com',
  first_name: 'Bob',
  last_name: 'Technician',
  role: 'TECHNICIAN'
};

describe('getUsers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no users exist', async () => {
    const result = await getUsers();
    expect(result).toEqual([]);
  });

  it('should return all active users', async () => {
    // Create test users
    await db.insert(usersTable).values([
      {
        id: testUser1.id,
        email: testUser1.email,
        first_name: testUser1.first_name,
        last_name: testUser1.last_name,
        role: testUser1.role,
        is_active: true
      },
      {
        id: testUser2.id,
        email: testUser2.email,
        first_name: testUser2.first_name,
        last_name: testUser2.last_name,
        role: testUser2.role,
        is_active: true
      },
      {
        id: testUser3.id,
        email: testUser3.email,
        first_name: testUser3.first_name,
        last_name: testUser3.last_name,
        role: testUser3.role,
        is_active: true
      }
    ]).execute();

    const result = await getUsers();

    expect(result).toHaveLength(3);
    
    // Verify all users are returned with correct data
    const userIds = result.map(user => user.id);
    expect(userIds).toContain(testUser1.id);
    expect(userIds).toContain(testUser2.id);
    expect(userIds).toContain(testUser3.id);

    // Verify user details for admin user
    const adminUser = result.find(user => user.id === testUser1.id);
    expect(adminUser).toBeDefined();
    expect(adminUser!.email).toEqual(testUser1.email);
    expect(adminUser!.first_name).toEqual(testUser1.first_name);
    expect(adminUser!.last_name).toEqual(testUser1.last_name);
    expect(adminUser!.role).toEqual(testUser1.role);
    expect(adminUser!.is_active).toBe(true);
    expect(adminUser!.created_at).toBeInstanceOf(Date);
    expect(adminUser!.updated_at).toBeInstanceOf(Date);
  });

  it('should exclude inactive users', async () => {
    // Create one active and one inactive user
    await db.insert(usersTable).values([
      {
        id: testUser1.id,
        email: testUser1.email,
        first_name: testUser1.first_name,
        last_name: testUser1.last_name,
        role: testUser1.role,
        is_active: true
      },
      {
        id: testUser2.id,
        email: testUser2.email,
        first_name: testUser2.first_name,
        last_name: testUser2.last_name,
        role: testUser2.role,
        is_active: false // Inactive user
      }
    ]).execute();

    const result = await getUsers();

    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(testUser1.id);
    expect(result[0].is_active).toBe(true);
  });

  it('should return users with all role types', async () => {
    // Create users with different roles
    await db.insert(usersTable).values([
      {
        id: 'admin_user',
        email: 'admin@test.com',
        first_name: 'Admin',
        last_name: 'User',
        role: 'ADMIN',
        is_active: true
      },
      {
        id: 'warehouse_user',
        email: 'warehouse@test.com',
        first_name: 'Warehouse',
        last_name: 'Manager',
        role: 'WAREHOUSE_MANAGER',
        is_active: true
      },
      {
        id: 'purchasing_user',
        email: 'purchasing@test.com',
        first_name: 'Purchasing',
        last_name: 'Staff',
        role: 'PURCHASING_STAFF',
        is_active: true
      },
      {
        id: 'tech_user',
        email: 'tech@test.com',
        first_name: 'Tech',
        last_name: 'User',
        role: 'TECHNICIAN',
        is_active: true
      }
    ]).execute();

    const result = await getUsers();

    expect(result).toHaveLength(4);
    
    const roles = result.map(user => user.role);
    expect(roles).toContain('ADMIN');
    expect(roles).toContain('WAREHOUSE_MANAGER');
    expect(roles).toContain('PURCHASING_STAFF');
    expect(roles).toContain('TECHNICIAN');
  });

  it('should maintain proper data types', async () => {
    // Create a test user
    await db.insert(usersTable).values({
      id: testUser1.id,
      email: testUser1.email,
      first_name: testUser1.first_name,
      last_name: testUser1.last_name,
      role: testUser1.role,
      is_active: true
    }).execute();

    const result = await getUsers();

    expect(result).toHaveLength(1);
    const user = result[0];

    // Verify data types
    expect(typeof user.id).toBe('string');
    expect(typeof user.email).toBe('string');
    expect(typeof user.first_name).toBe('string');
    expect(typeof user.last_name).toBe('string');
    expect(typeof user.role).toBe('string');
    expect(typeof user.is_active).toBe('boolean');
    expect(user.created_at).toBeInstanceOf(Date);
    expect(user.updated_at).toBeInstanceOf(Date);
  });
});