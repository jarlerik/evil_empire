import { db } from '$lib/server/db';
import { userTable } from './db/schema';
import bcrypt from "bcryptjs";

interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export async function register({ email, password, name }: RegisterData) {
  try {
    // Check if user already exists
    const existingUser = await db.query.userTable.findFirst({
      where: (users, { eq }) => eq(users.email, email)
    });

    if (existingUser) {
      return {
        error: 'User with this email already exists'
      };
    }

    // Hash the password using oslo
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = await db.insert(userTable).values({
      email,
      name,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date()
    });
 
    return {
      success: true,
      user: newUser
    };

  } catch (error) {
    console.error('Registration error:', error);
    return {
      error: 'Failed to register user'
    };
  }
}
