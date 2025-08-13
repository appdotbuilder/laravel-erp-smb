import { db } from '../db';
import { suppliersTable } from '../db/schema';
import { type CreateSupplierInput, type Supplier } from '../schema';
import crypto from 'crypto';

// Simple encryption helper - in production, use a more robust encryption library
const encryptPaymentInfo = (paymentInfo: string): string => {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(process.env['ENCRYPTION_KEY'] || 'default-key-dev', 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(paymentInfo, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
};

export const createSupplier = async (input: CreateSupplierInput): Promise<Supplier> => {
  try {
    // Encrypt payment info if provided and not empty
    const encryptedPaymentInfo = (input.payment_info && input.payment_info !== '')
      ? encryptPaymentInfo(input.payment_info)
      : null;

    // Insert supplier record
    const result = await db.insert(suppliersTable)
      .values({
        name: input.name,
        contact_person: input.contact_person === '' ? null : (input.contact_person || null),
        email: input.email === '' ? null : (input.email || null),
        phone: input.phone === '' ? null : (input.phone || null),
        address: input.address === '' ? null : (input.address || null),
        encrypted_payment_info: encryptedPaymentInfo,
        is_active: true
      })
      .returning()
      .execute();

    const supplier = result[0];
    return {
      ...supplier,
      // Ensure dates are properly typed
      created_at: supplier.created_at,
      updated_at: supplier.updated_at
    };
  } catch (error) {
    console.error('Supplier creation failed:', error);
    throw error;
  }
};