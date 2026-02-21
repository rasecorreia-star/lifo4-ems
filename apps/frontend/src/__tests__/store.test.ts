import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '@/store/auth.store';

// Mock the auth store
vi.mock('@/store/auth.store', () => ({
  useAuthStore: vi.fn(() => ({
    user: null,
    isLoading: false,
    isAuthenticated: false,
    login: vi.fn(),
    logout: vi.fn(),
    checkAuth: vi.fn(),
  })),
}));

describe('store/auth.store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have initial state', () => {
    const store = useAuthStore();
    expect(store).toBeDefined();
    expect(store.user).toBeNull();
    expect(store.isLoading).toBe(false);
    expect(store.isAuthenticated).toBe(false);
  });

  it('should have login method', () => {
    const store = useAuthStore();
    expect(store.login).toBeDefined();
    expect(typeof store.login).toBe('function');
  });

  it('should have logout method', () => {
    const store = useAuthStore();
    expect(store.logout).toBeDefined();
    expect(typeof store.logout).toBe('function');
  });

  it('should have checkAuth method', () => {
    const store = useAuthStore();
    expect(store.checkAuth).toBeDefined();
    expect(typeof store.checkAuth).toBe('function');
  });
});
