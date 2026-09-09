import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { NoteSidebar } from './NotesPage';

describe('NoteSidebar', () => {
  it('renders selection and row actions as sibling buttons', () => {
    const html = renderToStaticMarkup(
      <NoteSidebar
        notes={[{
          id: 'note-1',
          title: 'Release notes',
          emoji: '🚀',
          starred: true,
          createdAt: '2026-09-09T00:00:00.000Z',
          updatedAt: '2026-09-09T00:00:00.000Z',
          noteTheme: 'purple',
          blocks: [],
        }]}
        activeId="note-1"
        onSelect={vi.fn()}
        onNew={vi.fn()}
        onDelete={vi.fn()}
        onToggleStar={vi.fn()}
        searchQuery=""
        onSearchChange={vi.fn()}
      />
    );

    let buttonDepth = 0;
    let maximumButtonDepth = 0;
    for (const tag of html.matchAll(/<\/?button\b[^>]*>/g)) {
      if (tag[0].startsWith('</')) buttonDepth -= 1;
      else {
        buttonDepth += 1;
        maximumButtonDepth = Math.max(maximumButtonDepth, buttonDepth);
      }
    }

    expect(maximumButtonDepth).toBe(1);
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('aria-label="Unstar Release notes"');
    expect(html).toContain('aria-label="Delete Release notes"');
  });
});
