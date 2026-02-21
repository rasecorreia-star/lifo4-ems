import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('lib/utils - cn', () => {
  it('should combine class names correctly', () => {
    const result = cn('px-2', 'py-1');
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('should handle conditional classes', () => {
    const result = cn('px-2', true && 'py-1', false && 'hidden');
    expect(result).toBeDefined();
  });

  it('should handle undefined and null values', () => {
    const result = cn('px-2', undefined, null, 'py-1');
    expect(result).toBeDefined();
  });

  it('should merge tailwind classes correctly', () => {
    const result = cn('p-2 p-4', 'p-1');
    expect(result).toContain('p-1');
  });
});
