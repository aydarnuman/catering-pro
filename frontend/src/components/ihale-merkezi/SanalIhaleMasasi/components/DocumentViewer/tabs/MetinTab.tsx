import { Text, Tooltip } from '@mantine/core';
import { Fragment } from 'react';
import { AGENTS } from '../../../constants';
import type { AgentHighlight } from '../../../types';
import { EmptyTab } from '../shared';

// ─── Highlight Renderer ──────────────────────────────────────

function HighlightedText({ text, highlights }: { text: string; highlights: AgentHighlight[] }) {
  if (!highlights.length) return <>{text}</>;

  const matches: { start: number; end: number; highlight: AgentHighlight }[] = [];
  const lowerText = text.toLowerCase();

  for (const hl of highlights) {
    const lowerHl = hl.text.toLowerCase();
    let searchFrom = 0;
    let idx = lowerText.indexOf(lowerHl, searchFrom);
    while (idx !== -1) {
      matches.push({ start: idx, end: idx + hl.text.length, highlight: hl });
      searchFrom = idx + hl.text.length;
      idx = lowerText.indexOf(lowerHl, searchFrom);
    }
  }

  if (matches.length === 0) return <>{text}</>;

  matches.sort((a, b) => a.start - b.start);

  const filtered: typeof matches = [];
  let lastEnd = 0;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      filtered.push(m);
      lastEnd = m.end;
    }
  }

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  for (const m of filtered) {
    if (m.start > cursor) {
      parts.push(<Fragment key={`t-${cursor}`}>{text.slice(cursor, m.start)}</Fragment>);
    }
    const agent = AGENTS.find((a) => a.id === m.highlight.agentId);
    parts.push(
      <Tooltip key={`h-${m.start}`} label={`${agent?.name ?? ''}: ${m.highlight.finding}`} withArrow>
        <span
          style={{
            background: `var(--mantine-color-${m.highlight.color}-9)`,
            color: `var(--mantine-color-${m.highlight.color}-2)`,
            borderRadius: 3,
            padding: '0 2px',
            cursor: 'help',
          }}
        >
          {text.slice(m.start, m.end)}
        </span>
      </Tooltip>
    );
    cursor = m.end;
  }

  if (cursor < text.length) {
    parts.push(<Fragment key={`t-${cursor}`}>{text.slice(cursor)}</Fragment>);
  }

  return <>{parts}</>;
}

// ─── Metin Tab ──────────────────────────────────────────────

export function MetinTab({
  paragraphs,
  agentHighlights,
  expanded,
}: {
  paragraphs: string[];
  agentHighlights: AgentHighlight[];
  expanded?: boolean;
}) {
  if (paragraphs.length === 0) {
    return <EmptyTab message="Tam metin yuklu degil. Dokuman analizi yapilmamis olabilir." />;
  }

  return (
    <>
      {paragraphs.map((p) => (
        <Text
          key={p.slice(0, 100)}
          size={expanded ? 'sm' : 'xs'}
          c="gray.4"
          mb={expanded ? 14 : 10}
          style={{ lineHeight: 1.75, letterSpacing: 0.15 }}
        >
          <HighlightedText text={p} highlights={agentHighlights} />
        </Text>
      ))}
    </>
  );
}
