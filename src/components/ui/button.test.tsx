import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('renders its children', () => {
    render(<Button>Hola</Button>);
    expect(screen.getByRole('button', { name: 'Hola' })).toBeInTheDocument();
  });

  it('applies the variant class', () => {
    render(<Button variant="outline">X</Button>);
    expect(screen.getByRole('button')).toHaveClass('cn-button-variant-outline');
  });

  it('renders a destructive variant', () => {
    render(<Button variant="destructive">Borrar</Button>);
    expect(screen.getByRole('button', { name: 'Borrar' })).toHaveClass(
      'cn-button-variant-destructive',
    );
  });
});
