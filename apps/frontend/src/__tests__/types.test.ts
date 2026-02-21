import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Define test schemas
const EmailSchema = z.string().email('Invalid email');
const UserRoleSchema = z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'OPERATOR', 'VIEWER', 'USER']);

describe('Type Validation - Zod Schemas', () => {
  describe('EmailSchema', () => {
    it('should validate correct email', () => {
      const result = EmailSchema.safeParse('user@example.com');
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = EmailSchema.safeParse('invalid-email');
      expect(result.success).toBe(false);
    });

    it('should reject empty email', () => {
      const result = EmailSchema.safeParse('');
      expect(result.success).toBe(false);
    });
  });

  describe('UserRoleSchema', () => {
    it('should validate valid roles', () => {
      const validRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'OPERATOR', 'VIEWER', 'USER'];
      validRoles.forEach(role => {
        const result = UserRoleSchema.safeParse(role);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid role', () => {
      const result = UserRoleSchema.safeParse('INVALID_ROLE');
      expect(result.success).toBe(false);
    });

    it('should be case-sensitive', () => {
      const result = UserRoleSchema.safeParse('admin');
      expect(result.success).toBe(false);
    });
  });
});
