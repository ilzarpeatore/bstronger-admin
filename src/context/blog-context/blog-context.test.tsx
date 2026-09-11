import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useContext } from 'react';
import { BlogProvider, BlogContext } from 'src/context/blog-context';
import { api } from 'src/lib/api';

vi.mock('src/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
  },
}));

function Probe() {
  const { posts, toggleStatus } = useContext(BlogContext);
  const post = posts[0];
  return (
    <div>
      <span data-testid="status">{post?.status ?? 'none'}</span>
      <button type="button" onClick={() => toggleStatus(1, post?.status ?? 'publish')}>
        toggle
      </button>
    </div>
  );
}

describe('blog-context toggleStatus (optimistic)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ data: [] } as any);
  });

  it('flips the status before the API responds and rolls back on error', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [{ id: 1, title: 'Artículo', status: 'publish' }],
    } as any);

    let rejectPut!: (reason?: unknown) => void;
    const pending = new Promise((_, reject) => {
      rejectPut = reject;
    });
    vi.mocked(api.put).mockReturnValue(pending as any);

    const user = userEvent.setup();
    render(
      <BlogProvider>
        <Probe />
      </BlogProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('publish'));

    await user.click(screen.getByRole('button', { name: 'toggle' }));

    expect(screen.getByTestId('status')).toHaveTextContent('inactive');
    expect(api.put).toHaveBeenCalledWith('/admin/posts/1', { status: 'inactive' });

    rejectPut(new Error('boom'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('publish'));
  });
});
