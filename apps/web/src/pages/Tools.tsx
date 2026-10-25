import { useMemo, useState } from 'react';
import { CATEGORY_LABELS } from '@open-creator/shared';
import type { ToolCategory } from '@open-creator/shared';
import { useApp } from '../state/AppState.tsx';
import { ToolCard } from '../components/ToolCard.tsx';
import { EmptyState } from '../components/EmptyState.tsx';

const FILTERS: { id: ToolCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All tools' },
  { id: 'video', label: CATEGORY_LABELS.video },
  { id: 'image', label: CATEGORY_LABELS.image },
  { id: 'audio', label: CATEGORY_LABELS.audio },
  { id: 'text', label: CATEGORY_LABELS.text },
  { id: 'utility', label: CATEGORY_LABELS.utility },
];

export function Tools({
  search,
  onSelectTool,
}: {
  search: string;
  onSelectTool: (toolId: string) => void;
}): JSX.Element {
  const { tools } = useApp();
  const [category, setCategory] = useState<ToolCategory | 'all'>('all');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tools.filter((tool) => {
      const matchesCategory = category === 'all' || tool.category === category;
      if (!matchesCategory) return false;
      if (!term) return true;
      return (
        tool.name.toLowerCase().includes(term) ||
        tool.summary.toLowerCase().includes(term) ||
        tool.id.includes(term) ||
        tool.outputs.some((output) => output.toLowerCase().includes(term))
      );
    });
  }, [category, search, tools]);

  return (
    <>
      <div className="chips">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={`chip${category === filter.id ? ' chip--active' : ''}`}
            onClick={() => setCategory(filter.id)}
          >
            {filter.label}
            <span className="faint" style={{ marginLeft: 6, fontSize: 11 }}>
              {filter.id === 'all'
                ? tools.length
                : tools.filter((tool) => tool.category === filter.id).length}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="search"
          title="No tools match that search"
          description="Try a different keyword, or reset the filter to see every creator tool."
        />
      ) : (
        <div className="tool-grid">
          {filtered.map((tool) => (
            <ToolCard key={tool.id} tool={tool} onSelect={() => onSelectTool(tool.id)} />
          ))}
        </div>
      )}
    </>
  );
}
