import { type CreateUserInput, type User } from '../schema';

export const createUser = async (input: CreateUserInput): Promise<User> => {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is creating a new user record from Clerk webhook data
    // and persisting it in the database with the assigned role.
    return Promise.resolve({
        id: input.id,
        email: input.email,
        first_name: input.first_name,
        last_name: input.last_name,
        role: input.role,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
    } as User);
};