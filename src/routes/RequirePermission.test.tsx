import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import RequirePermission from '@/routes/RequirePermission';
import { useAuth } from '@/context/auth-context/AuthContext';

vi.mock('@/context/auth-context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

function makeRouter(permission: string) {
  return createMemoryRouter(
    [
      {
        path: '/protected',
        element: (
          <RequirePermission permission={permission}>
            <div>Secret content</div>
          </RequirePermission>
        ),
      },
      { path: '/dashboard', element: <div>Dashboard home</div> },
    ],
    { initialEntries: ['/protected'] },
  );
}

describe('RequirePermission', () => {
  it('renders the page when the admin has the required permission', () => {
    vi.mocked(useAuth).mockReturnValue({
      hasPermission: (p: string) => p === 'roles',
    } as unknown as ReturnType<typeof useAuth>);

    render(<RouterProvider router={makeRouter('roles')} />);

    expect(screen.getByText('Secret content')).toBeInTheDocument();
  });

  it('redirects to the dashboard when the admin lacks the required permission', () => {
    vi.mocked(useAuth).mockReturnValue({
      hasPermission: () => false,
    } as unknown as ReturnType<typeof useAuth>);

    render(<RouterProvider router={makeRouter('roles')} />);

    expect(screen.queryByText('Secret content')).not.toBeInTheDocument();
    expect(screen.getByText('Dashboard home')).toBeInTheDocument();
  });

  it('does not crash and denies access when hasPermission reflects an empty/undefined permissions array', () => {
    // Mirrors AuthContext.hasPermission()'s behavior for a user with no permissions.
    vi.mocked(useAuth).mockReturnValue({
      hasPermission: () => false,
    } as unknown as ReturnType<typeof useAuth>);

    expect(() => render(<RouterProvider router={makeRouter('roles')} />)).not.toThrow();
    expect(screen.getByText('Dashboard home')).toBeInTheDocument();
  });
});
