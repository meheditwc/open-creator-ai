import type { ReactNode } from 'react';

/**
 * A deliberately tiny markdown renderer.
 *
 * It only handles what the agent actually emits (headings, bullets, numbered
 * lists, quotes, rules, bold/italic/code) and it never touches
 * `dangerouslySetInnerHTML`, so the output is safe by construction.
 */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    const key = `${keyPrefix}-i${index++}`;

    if (token.startsWith('**') || token.startsWith('__')) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export function Markdown({ content }: { content: string }): JSX.Element {
  const lines = content.split('\n');
  const blocks: ReactNode[] = [];
  let index = 0;
  let key = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim() === '') {
      index += 1;
      continue;
    }

    if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^#+/)?.length ?? 1;
      const text = line.replace(/^#+\s*/, '');
      const Tag = (['h3', 'h4', 'h5'] as const)[level - 1];
      blocks.push(<Tag key={`b${key++}`}>{renderInline(text, `h${key}`)}</Tag>);
      index += 1;
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      blocks.push(<hr key={`b${key++}`} />);
      index += 1;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, ''));
        index += 1;
      }
      blocks.push(
        <ul key={`b${key++}`}>
          {items.map((item, itemIndex) => (
            <li key={`l${itemIndex}`}>{renderInline(item, `li${itemIndex}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ''));
        index += 1;
      }
      blocks.push(
        <ol key={`b${key++}`}>
          {items.map((item, itemIndex) => (
            <li key={`l${itemIndex}`}>{renderInline(item, `ol${itemIndex}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() !== '' &&
      !/^#{1,3}\s/.test(lines[index]) &&
      !/^\s*[-*]\s+/.test(lines[index]) &&
      !/^\s*\d+\.\s+/.test(lines[index])
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }

    blocks.push(<p key={`b${key++}`}>{renderInline(paragraph.join(' '), `p${key}`)}</p>);
  }

  return <div className="md">{blocks}</div>;
}
