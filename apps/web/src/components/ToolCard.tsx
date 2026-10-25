import type { ToolDefinition } from '@open-creator/shared';
import { CATEGORY_LABELS } from '@open-creator/shared';
import { Icon } from './Icon.tsx';

export function ToolCard({
  tool,
  onSelect,
}: {
  tool: ToolDefinition;
  onSelect: (tool: ToolDefinition) => void;
}): JSX.Element {
  return (
    <article
      className="tool-card"
      role="button"
      tabIndex={0}
      onClick={() => onSelect(tool)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onSelect(tool);
      }}
      style={
        {
          '--tool-tint': `${tool.accent}22`,
          '--tool-glow': `${tool.accent}33`,
        } as React.CSSProperties
      }
    >
      <div className="tool-card__head">
        <div className="tool-card__icon" style={{ color: tool.accent }}>
          <Icon name={tool.icon} size={19} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="tool-card__name">{tool.name}</div>
          <div className="tool-card__cat">{CATEGORY_LABELS[tool.category]}</div>
        </div>
        <span className={`badge badge--${tool.status}`}>{tool.status}</span>
      </div>

      <p className="tool-card__summary">{tool.summary}</p>

      <div className="tool-card__foot">
        <span>{tool.outputs.length} outputs</span>
        <span>·</span>
        <span>{tool.pipeline.length} steps</span>
        {tool.requires.length > 0 && (
          <>
            <span>·</span>
            <span className="mono">{tool.requires.join(', ')}</span>
          </>
        )}
      </div>
    </article>
  );
}
