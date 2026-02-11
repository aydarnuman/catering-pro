import { useEffect, useRef, useState } from 'react';
import { AGENTS } from '../constants';
import type { AgentAnalysis, CrossReference, ViewMode } from '../types';

interface NetworkLinesProps {
  viewMode: ViewMode;
  focusedAgentId: string | null;
  agentAnalyses: AgentAnalysis[];
  stageRef: React.RefObject<HTMLDivElement | null>;
  crossReferences?: CrossReference[];
}

interface NodePos {
  x: number;
  y: number;
}

/** Compute a curved path from center to agent */
function buildCurvePath(cx: number, cy: number, ax: number, ay: number): string {
  const mx = (cx + ax) / 2;
  const my = (cy + ay) / 2;
  const dx = ax - cx;
  const dy = ay - cy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const curveAmount = len * 0.12;
  const cpx = mx + (-dy / len) * curveAmount;
  const cpy = my + (dx / len) * curveAmount;
  return `M${cx},${cy} Q${cpx},${cpy} ${ax},${ay}`;
}

const SEVERITY_COLORS: Record<CrossReference['severity'], string> = {
  critical: '#f43f5e',
  warning: '#f59e0b',
  info: '#6366f1',
};

export function NetworkLines({ viewMode, focusedAgentId, agentAnalyses, stageRef, crossReferences = [] }: NetworkLinesProps) {
  const [positions, setPositions] = useState<Record<string, NodePos>>({});
  const [centerPos, setCenterPos] = useState<NodePos>({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const updatePositions = () => {
      if (!stageRef.current) return;
      const stageRect = stageRef.current.getBoundingClientRect();

      const centerEl = stageRef.current.querySelector('[data-node="center"]');
      if (centerEl) {
        const rect = centerEl.getBoundingClientRect();
        setCenterPos({
          x: rect.left + rect.width / 2 - stageRect.left,
          y: rect.top + rect.height / 2 - stageRect.top,
        });
      }

      const newPositions: Record<string, NodePos> = {};
      for (const agent of AGENTS) {
        const el = stageRef.current.querySelector(`[data-node="${agent.id}"]`);
        if (el) {
          const rect = el.getBoundingClientRect();
          newPositions[agent.id] = {
            x: rect.left + rect.width / 2 - stageRect.left,
            y: rect.top + rect.height / 2 - stageRect.top,
          };
        }
      }
      setPositions(newPositions);
    };

    let running = true;
    const tick = () => {
      if (!running) return;
      updatePositions();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [stageRef, viewMode, focusedAgentId]);

  if (viewMode === 'ASSEMBLE') return null;

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 3,
      }}
    >
      <defs>
        {AGENTS.map((agent) => {
          const agentPos = positions[agent.id];
          const analysis = agentAnalyses.find((a) => a.agentId === agent.id);
          const isComplete = analysis?.status === 'complete' || analysis?.status === 'warning' || analysis?.status === 'critical';
          const isAnalyzing = analysis?.status === 'analyzing';

          const startColor = isComplete ? agent.accentHex : isAnalyzing ? '#3b82f6' : 'rgba(255,255,255,0.2)';
          const endColor = isComplete ? '#10b981' : isAnalyzing ? `${agent.accentHex}80` : 'rgba(255,255,255,0.06)';

          return (
            <linearGradient
              key={`grad-${agent.id}`}
              id={`line-grad-${agent.id}`}
              gradientUnits="userSpaceOnUse"
              x1={centerPos.x}
              y1={centerPos.y}
              x2={agentPos?.x ?? 0}
              y2={agentPos?.y ?? 0}
            >
              <stop offset="0%" stopColor={startColor} stopOpacity={isComplete ? 0.5 : 0.7} />
              <stop offset="100%" stopColor={endColor} stopOpacity={0.3} />
            </linearGradient>
          );
        })}

        {/* Glow filter for focused line */}
        <filter id="line-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Connection paths: center → agent */}
      {AGENTS.map((agent) => {
        const agentPos = positions[agent.id];
        if (!agentPos || !centerPos.x) return null;

        const analysis = agentAnalyses.find((a) => a.agentId === agent.id);
        const isComplete = analysis?.status === 'complete' || analysis?.status === 'warning' || analysis?.status === 'critical';
        const isFocused = viewMode === 'FOCUS' && focusedAgentId === agent.id;
        const isDimmed = viewMode === 'FOCUS' && focusedAgentId !== agent.id;
        const opacity = isDimmed ? 0.04 : isFocused ? 0.85 : 0.4;

        const pathD = buildCurvePath(centerPos.x, centerPos.y, agentPos.x, agentPos.y);

        // Dash sizing
        const dashSize = isFocused ? 14 : 8;
        const gapSize = isFocused ? 7 : 8;
        const cycleLen = dashSize + gapSize;

        // Animation speed: focused = fast, complete = medium, default = slow
        const animDuration = isFocused ? 0.3 : isComplete ? 0.6 : 0.8;
        // Complete status: flow reverses (negative = agent → center)
        const flowOffset = isComplete ? -cycleLen : cycleLen;

        return (
          <g key={agent.id}>
            {/* Base line (subtle solid) */}
            <path
              d={pathD}
              fill="none"
              stroke={`url(#line-grad-${agent.id})`}
              strokeWidth={isFocused ? 2.5 : 1.5}
              opacity={opacity * 0.4}
              filter={isFocused ? 'url(#line-glow)' : undefined}
            />

            {/* Animated dashed flow */}
            {!isDimmed && (
              <path
                d={pathD}
                fill="none"
                stroke={`url(#line-grad-${agent.id})`}
                strokeWidth={isFocused ? 2 : 1}
                opacity={opacity}
                strokeDasharray={`${dashSize} ${gapSize}`}
                filter={isFocused ? 'url(#line-glow)' : undefined}
                style={{
                  animation: `network-flow ${animDuration}s linear infinite`,
                  ['--flow-offset' as string]: `${flowOffset}px`,
                }}
              />
            )}
          </g>
        );
      })}

      {/* Cross-reference lines: agent → agent (dashed) */}
      {crossReferences.map((ref, idx) => {
        const fromPos = positions[ref.fromAgentId];
        const toPos = positions[ref.toAgentId];
        if (!fromPos || !toPos) return null;

        const color = SEVERITY_COLORS[ref.severity];
        const pathD = buildCurvePath(fromPos.x, fromPos.y, toPos.x, toPos.y);

        return (
          <g key={`xref-${idx}`}>
            <title>{`${ref.fromFinding}: ${ref.impact}`}</title>
            <path
              d={pathD}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeDasharray="6 4"
              opacity={0.5}
              style={{
                animation: `network-flow 1.2s linear infinite`,
                ['--flow-offset' as string]: '10px',
              }}
            />
          </g>
        );
      })}
    </svg>
  );
}
