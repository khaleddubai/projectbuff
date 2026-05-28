import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * Derive a 32-byte key from the configured encryption key using SHA-256.
 * This ensures the key is always the correct length regardless of input.
 */
function deriveKey(): Buffer {
  return crypto.createHash('sha256').update(config.encryptionKey).digest();
}

/**
 * Encrypt a plaintext string.
 * Returns a base64-encoded string containing: iv + authTag + ciphertext.
 */
export function encrypt(plaintext: string): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf-8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  // Prepend IV and authTag to the ciphertext
  return `${iv.toString('base64')}.${authTag.toString('base64')}.${encrypted}`;
}

/**
 * Decrypt a base64-encoded encrypted string.
 * Returns the original plaintext, or the input unchanged if it's not encrypted.
 */
export function decrypt(encryptedValue: string): string {
  // If it doesn't have the expected format, return as-is (not encrypted)
  if (!encryptedValue || !encryptedValue.includes('.')) {
    return encryptedValue;
  }

  try {
    const parts = encryptedValue.split('.');
    if (parts.length !== 3) return encryptedValue;

    const key = deriveKey();
    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const ciphertext = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'base64', 'utf-8');
    decrypted += decipher.final('utf-8');
    return decrypted;
  } catch {
    // If decryption fails, return the original value
    return encryptedValue;
  }
}

