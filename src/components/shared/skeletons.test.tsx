import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  DashboardSkeleton,
  DetailSkeleton,
  TableRowsSkeleton,
} from '@/components/shared/skeletons';
import { Table, TableBody } from '@/components/ui/table';

function countSkeletons(container: HTMLElement) {
  return container.querySelectorAll('[data-slot="skeleton"]').length;
}

describe('skeletons', () => {
  it('renders multiple blocks in the dashboard skeleton', () => {
    const { container } = render(<DashboardSkeleton />);
    expect(countSkeletons(container)).toBeGreaterThan(3);
  });

  it('renders a profile header in the detail skeleton', () => {
    const { container } = render(<DetailSkeleton />);
    expect(countSkeletons(container)).toBeGreaterThan(5);
  });

  it('renders rows x columns skeleton cells', () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRowsSkeleton rows={2} columns={3} />
        </TableBody>
      </Table>,
    );
    expect(countSkeletons(container)).toBe(6);
  });
});
