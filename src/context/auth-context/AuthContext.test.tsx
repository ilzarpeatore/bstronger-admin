import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/context/auth-context/AuthContext';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
  },
  setToken: vi.fn(),
  removeToken: vi.fn(),
}));

function Probe({ permission }: { permission: string }) {
  const { hasPermission, loading } = useAuth();
  if (loading) return <span>loading</span>;
  return <span data-testid="result">{String(hasPermission(permission))}</span>;
}

describe('AuthContext hasPermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('grants access when the admin has the exact permission', async () => {
    localStorage.setItem('admin_token', 'tok');
    vi.mocked(api.get).mockResolvedValue({ data: { id: 1, permissions: ['roles'] } } as any);

    render(
      <AuthProvider>
        <Probe permission="roles" />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('true'));
  });

  it('grants every permission to a wildcard super-admin', async () => {
    localStorage.setItem('admin_token', 'tok');
    vi.mocked(api.get).mockResolvedValue({ data: { id: 1, permissions: ['*'] } } as any);

    render(
      <AuthProvider>
        <Probe permission="anything-not-explicitly-listed" />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('true'));
  });

  it('denies access without crashing when permissions is an empty array', async () => {
    localStorage.setItem('admin_token', 'tok');
    vi.mocked(api.get).mockResolvedValue({ data: { id: 1, permissions: [] } } as any);

    render(
      <AuthProvider>
        <Probe permission="roles" />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('false'));
  });

  it('denies access without crashing when permissions is undefined', async () => {
    localStorage.setItem('admin_token', 'tok');
    // Simulates a backend response that omits the field entirely.
    vi.mocked(api.get).mockResolvedValue({ data: { id: 1, permissions: undefined } } as any);

    render(
      <AuthProvider>
        <Probe permission="roles" />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('false'));
  });

  it('denies access when there is no logged-in user', async () => {
    render(
      <AuthProvider>
        <Probe permission="roles" />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('false'));
  });
});
