import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from './cryptoService';

describe('cryptoService', () => {
  describe('encrypt / decrypt', () => {
    it('should encrypt and decrypt a simple string', () => {
      const original = 'sk-or-v1-my-secret-api-key-12345';
      const encrypted = encrypt(original);
      
      // Encrypted value should not match original
      expect(encrypted).not.toBe(original);
      // Should have the iv.tag.ciphertext format
      expect(encrypted.split('.')).toHaveLength(3);
      // Should be base64-ish
      expect(encrypted).toMatch(/^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/);

      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('should produce different ciphertexts for the same input (random IV)', () => {
      const input = 'same-value';
      const encrypted1 = encrypt(input);
      const encrypted2 = encrypt(input);
      
      // Different IVs should produce different ciphertexts
      expect(encrypted1).not.toBe(encrypted2);
      // But both should decrypt to the same value
      expect(decrypt(encrypted1)).toBe(input);
      expect(decrypt(encrypted2)).toBe(input);
    });

    it('should handle empty strings', () => {
      const encrypted = encrypt('');
      expect(encrypted.split('.')).toHaveLength(3);
      expect(decrypt(encrypted)).toBe('');
    });

    it('should handle special characters', () => {
      const specials = [
        'key with spaces',
        'key_with_underscores',
        'key-with-dashes',
        'sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        'api_key_123!@#$%^&*()',
        'a'.repeat(500), // Long string
      ];

      for (const original of specials) {
        const encrypted = encrypt(original);
        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(original);
      }
    });

    it('should handle unicode characters', () => {
      const unicode = 'héllo wörld 🚀 🔑 api_key_中文';
      const encrypted = encrypt(unicode);
      expect(decrypt(encrypted)).toBe(unicode);
    });

    it('should return non-encrypted values unchanged from decrypt', () => {
      expect(decrypt('')).toBe('');
      expect(decrypt('plain-text-value')).toBe('plain-text-value');
      expect(decrypt('sk-or-v1-abc123')).toBe('sk-or-v1-abc123');
    });

    it('should return invalid encrypted format unchanged', () => {
      // Two parts instead of three
      expect(decrypt('part1.part2')).toBe('part1.part2');
      // Four parts
      expect(decrypt('a.b.c.d')).toBe('a.b.c.d');
    });

    it('should return tampered ciphertext unchanged (auth tag validation)', () => {
      const original = 'my-secret-key';
      const encrypted = encrypt(original);
      
      // Tamper with the ciphertext part (third segment)
      const parts = encrypted.split('.');
      const tampered = [parts[0], parts[1], 'tampered-ciphertext'].join('.');
      
      // Decrypting tampered data should return the tampered value as-is
      expect(decrypt(tampered)).toBe(tampered);
    });
  });
});
