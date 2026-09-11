import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { ReactNode } from 'react';
import { RouteError } from '@/components/shared/RouteError';

function ThrowingView(): ReactNode {
  throw new Error('Se rompió la página');
}

function makeRouter() {
  return createMemoryRouter([
    {
      path: '/',
      errorElement: <RouteError />,
      children: [{ index: true, element: <ThrowingView /> }],
    },
  ]);
}

describe('RouteError', () => {
  it('shows the error message when a route crashes', async () => {
    render(<RouterProvider router={makeRouter()} />);
    expect(await screen.findByText('Se rompió la página')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /recargar/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /volver al inicio/i })).toBeInTheDocument();
  });
});
