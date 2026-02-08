'use client';

/**
 * İlişki Ağı Paneli — Ortak Girişim Network Grafiği
 * ──────────────────────────────────────────────────
 * Yüklenicinin ortak girişim yaptığı firmaları ve rakiplerini
 * interaktif ağ (network) görünümünde gösterir.
 *
 * Saf SVG + React. Ek bağımlılık gerektirmez.
 * - Merkez node: Seçili yüklenici
 * - Yeşil halo: Ortak girişim partnerleri
 * - Kırmızı halo: Rakipler
 * - Hover: Detay tooltip
 * - Node boyutu: Sözleşme tutarına orantılı
 */

import {
  Alert,
  Badge,
  Box,
  Center,
  Group,
  Loader,
  Paper,
  SegmentedControl,
  Stack,
  Text,
} from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getApiUrl } from '@/lib/config';
import { formatCurrency } from '@/types/yuklenici';

/* ─── Tipler ─── */

interface Props {
  yukleniciId: number;
  yukleniciAdi?: string;
}

interface OrtakGirisim {
  partner_adi: string;
  devam_eden: number;
  tamamlanan: number;
  toplam_sozlesme: number;
}

interface Rakip {
  rakip_adi: string;
  ihale_sayisi: number;
  toplam_sozlesme: number;
}

type GorunumModu = 'grafik' | 'liste';

interface GraphNode {
  id: string;
  label: string;
  type: 'center' | 'partner' | 'rakip';
  radius: number;
  x: number;
  y: number;
  // detay
  ihaleSayisi?: number;
  devamEden?: number;
  tamamlanan?: number;
  toplamSozlesme: number;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number; // kalınlık
}

/* ─── Yardımcılar ─── */

/** Firma adını max 28 karaktere kısalt */
function truncate(str: string, max = 28): string {
  if (str.length <= max) return str;
  return `${str.slice(0, max - 1)}…`;
}

/** Değer aralığını belirli min-max'a map'le */
function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  if (inMax === inMin) return (outMin + outMax) / 2;
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

/* ─── SVG Network Graph ─── */

const GRAPH_WIDTH = 700;
const GRAPH_HEIGHT = 520;
const CENTER_X = GRAPH_WIDTH / 2;
const CENTER_Y = GRAPH_HEIGHT / 2;
const CENTER_RADIUS = 32;
const PARTNER_ORBIT = 140;
const RAKIP_ORBIT = 210;
const NODE_MIN_R = 14;
const NODE_MAX_R = 28;

function buildGraph(
  ortaklar: OrtakGirisim[],
  rakipler: Rakip[],
  merkezAdi: string
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Merkez node
  nodes.push({
    id: 'center',
    label: merkezAdi,
    type: 'center',
    radius: CENTER_RADIUS,
    x: CENTER_X,
    y: CENTER_Y,
    toplamSozlesme: 0,
  });

  // Sözleşme min/max hesapla (node boyutu)
  const allValues = [
    ...ortaklar.map((o) => o.toplam_sozlesme || 0),
    ...rakipler.map((r) => r.toplam_sozlesme || 0),
  ];
  const minVal = Math.min(...allValues, 0);
  const maxVal = Math.max(...allValues, 1);

  // Ortaklar — iç halka
  ortaklar.forEach((og, i) => {
    const angle = (2 * Math.PI * i) / Math.max(ortaklar.length, 1) - Math.PI / 2;
    const r = mapRange(og.toplam_sozlesme || 0, minVal, maxVal, NODE_MIN_R, NODE_MAX_R);
    const id = `partner-${i}`;
    nodes.push({
      id,
      label: og.partner_adi,
      type: 'partner',
      radius: r,
      x: CENTER_X + PARTNER_ORBIT * Math.cos(angle),
      y: CENTER_Y + PARTNER_ORBIT * Math.sin(angle),
      devamEden: og.devam_eden,
      tamamlanan: og.tamamlanan,
      toplamSozlesme: og.toplam_sozlesme || 0,
    });
    edges.push({
      source: 'center',
      target: id,
      weight: Math.max(1.5, Math.min(5, (og.devam_eden + og.tamamlanan) * 1.5)),
    });
  });

  // Rakipler — dış halka
  rakipler.forEach((r, i) => {
    const angle = (2 * Math.PI * i) / Math.max(rakipler.length, 1) - Math.PI / 2;
    const rad = mapRange(r.toplam_sozlesme || 0, minVal, maxVal, NODE_MIN_R, NODE_MAX_R);
    const id = `rakip-${i}`;
    nodes.push({
      id,
      label: r.rakip_adi,
      type: 'rakip',
      radius: rad,
      x: CENTER_X + RAKIP_ORBIT * Math.cos(angle),
      y: CENTER_Y + RAKIP_ORBIT * Math.sin(angle),
      ihaleSayisi: r.ihale_sayisi,
      toplamSozlesme: r.toplam_sozlesme || 0,
    });
    edges.push({
      source: 'center',
      target: id,
      weight: Math.max(1, Math.min(4, r.ihale_sayisi * 0.5)),
    });
  });

  return { nodes, edges };
}

/* ─── Tooltip Component ─── */

function GraphTooltip({
  node,
  mouseX,
  mouseY,
}: {
  node: GraphNode;
  mouseX: number;
  mouseY: number;
}) {
  const left = Math.min(mouseX + 12, GRAPH_WIDTH - 230);
  const top = mouseY > GRAPH_HEIGHT - 130 ? mouseY - 110 : mouseY + 12;

  const partnerCount = (node.devamEden ?? 0) + (node.tamamlanan ?? 0);

  return (
    <foreignObject x={left} y={top} width={230} height={120}>
      <div
        style={{
          background: 'rgba(15, 16, 21, 0.95)',
          border: '1px solid rgba(201,168,76,0.2)',
          borderRadius: 10,
          padding: '8px 12px',
          fontSize: 12,
          color: '#fff',
          lineHeight: 1.6,
          pointerEvents: 'none',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 13, color: '#C9A84C' }}>
          {node.label}
        </div>
        {node.type === 'partner' && (
          <>
            <div style={{ color: '#a5d8ff' }}>Toplam ortaklik: {partnerCount} ihale</div>
            {(node.devamEden ?? 0) > 0 && (
              <div style={{ color: '#74c0fc' }}>Devam eden: {node.devamEden}</div>
            )}
            {(node.tamamlanan ?? 0) > 0 && (
              <div style={{ color: '#69db7c' }}>Tamamlanan: {node.tamamlanan}</div>
            )}
          </>
        )}
        {node.type === 'rakip' && node.ihaleSayisi && (
          <div style={{ color: '#ff8787' }}>Ortak ihale: {node.ihaleSayisi}</div>
        )}
        {node.toplamSozlesme > 0 && (
          <div style={{ color: '#C9A84C', marginTop: 2, fontWeight: 600 }}>
            {formatCurrency(node.toplamSozlesme)}
          </div>
        )}
      </div>
    </foreignObject>
  );
}

/* ─── Ana Network SVG ─── */

function NetworkGraph({
  ortaklar,
  rakipler,
  merkezAdi,
}: {
  ortaklar: OrtakGirisim[];
  rakipler: Rakip[];
  merkezAdi: string;
}) {
  const totalNodes = ortaklar.length + rakipler.length;
  // 50+ node varsa sadece en buyukleri goster
  const [showAll, setShowAll] = useState(totalNodes <= 50);
  const limitedOrtaklar = showAll ? ortaklar : ortaklar.slice(0, 15);
  const limitedRakipler = showAll ? rakipler : rakipler.slice(0, 30);

  const { nodes, edges } = useMemo(
    () => buildGraph(limitedOrtaklar, limitedRakipler, merkezAdi),
    [limitedOrtaklar, limitedRakipler, merkezAdi]
  );

  const [hovered, setHovered] = useState<string | null>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);

  const nodeMap = useMemo(() => {
    const m = new Map<string, GraphNode>();
    for (const n of nodes) {
      m.set(n.id, n);
    }
    return m;
  }, [nodes]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    setMouse({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  const hoveredNode = hovered ? nodeMap.get(hovered) : null;

  // Renk paletleri — Premium gold center
  const colors = {
    center: { fill: '#C9A84C', stroke: '#B8963F', glow: 'rgba(201,168,76,0.4)' },
    partner: { fill: '#40c057', stroke: '#2f9e44', glow: 'rgba(64,192,87,0.3)' },
    rakip: { fill: '#fa5252', stroke: '#e03131', glow: 'rgba(250,82,82,0.3)' },
  };

  // Zoom helpers
  const zoomIn = () => setZoom((z) => Math.min(z + 0.2, 2.5));
  const zoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.4));
  const zoomReset = () => setZoom(1);

  // Visible viewBox based on zoom
  const vbW = GRAPH_WIDTH / zoom;
  const vbH = GRAPH_HEIGHT / zoom;
  const vbX = (GRAPH_WIDTH - vbW) / 2;
  const vbY = (GRAPH_HEIGHT - vbH) / 2;

  // Label visibility: only show labels for large nodes when 50+ nodes
  const shouldShowLabel = (node: GraphNode) => {
    if (hovered === node.id) return true;
    if (totalNodes <= 30) return true;
    return node.radius > (NODE_MIN_R + NODE_MAX_R) / 2;
  };

  return (
    <Box pos="relative">
      {/* Zoom controls — premium */}
      <Group
        gap={4}
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          zIndex: 5,
        }}
      >
        <button
          type="button"
          onClick={zoomIn}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: '1px solid rgba(201,168,76,0.2)',
            background: 'rgba(15,16,21,0.9)',
            color: '#C9A84C',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          +
        </button>
        <button
          type="button"
          onClick={zoomOut}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: '1px solid rgba(201,168,76,0.2)',
            background: 'rgba(15,16,21,0.9)',
            color: '#C9A84C',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          −
        </button>
        <button
          type="button"
          onClick={zoomReset}
          style={{
            height: 28,
            borderRadius: 6,
            border: '1px solid rgba(201,168,76,0.2)',
            background: 'rgba(15,16,21,0.9)',
            color: '#C9A84C',
            cursor: 'pointer',
            fontSize: 10,
            padding: '0 8px',
          }}
        >
          Reset
        </button>
      </Group>

      {/* Legend overlay — premium */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 5,
          background: 'rgba(15,16,21,0.9)',
          border: '1px solid rgba(201,168,76,0.15)',
          borderRadius: 8,
          padding: '6px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          fontSize: 11,
          color: 'rgba(255,255,255,0.7)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#C9A84C' }} />
          <span style={{ color: '#C9A84C' }}>Merkez</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#40c057' }} />
          <span>Ortak Girisim ({ortaklar.length})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fa5252' }} />
          <span>Rakip ({rakipler.length})</span>
        </div>
        <div style={{ fontSize: 10, color: 'rgba(201,168,76,0.4)', marginTop: 2 }}>
          Node = sozlesme tutari
        </div>
      </div>

      {/* Show all toggle */}
      {totalNodes > 50 && (
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 5,
          }}
        >
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            style={{
              height: 26,
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(26,27,30,0.85)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 11,
              padding: '0 12px',
            }}
          >
            {showAll ? `En onemli ${45}'ini goster` : `Tumunu goster (${totalNodes})`}
          </button>
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        width="100%"
        role="img"
        aria-label="Iliski agi grafigi"
        style={{
          maxHeight: 520,
          borderRadius: 12,
          background:
            'radial-gradient(ellipse at center, rgba(201,168,76,0.03) 0%, rgba(15,16,21,0.95) 70%)',
          border: '1px solid var(--yk-border)',
          cursor: 'default',
        }}
        onMouseMove={handleMouseMove}
      >
        <title>Iliski Agi Grafigi</title>
        {/* Defs — glow filter */}
        <defs>
          <filter id="glow-blue" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-green" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-red" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Orbit çemberleri — gold hint */}
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r={PARTNER_ORBIT}
          fill="none"
          stroke="rgba(201,168,76,0.06)"
          strokeWidth={1}
          strokeDasharray="4 6"
        />
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r={RAKIP_ORBIT}
          fill="none"
          stroke="rgba(201,168,76,0.04)"
          strokeWidth={1}
          strokeDasharray="4 6"
        />

        {/* Edges */}
        {edges.map((edge) => {
          const src = nodeMap.get(edge.source);
          const tgt = nodeMap.get(edge.target);
          if (!src || !tgt) return null;
          const isHighlighted = hovered === edge.source || hovered === edge.target;
          const tgtNode = nodeMap.get(edge.target);
          const edgeColor =
            tgtNode?.type === 'partner' ? 'rgba(64,192,87,0.35)' : 'rgba(250,82,82,0.25)';
          const edgeColorHi =
            tgtNode?.type === 'partner' ? 'rgba(64,192,87,0.7)' : 'rgba(250,82,82,0.6)';

          return (
            <line
              key={`${edge.source}-${edge.target}`}
              x1={src.x}
              y1={src.y}
              x2={tgt.x}
              y2={tgt.y}
              stroke={isHighlighted ? edgeColorHi : edgeColor}
              strokeWidth={isHighlighted ? edge.weight + 1 : edge.weight}
              style={{ transition: 'all 0.2s ease' }}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const c = colors[node.type];
          const isHov = hovered === node.id;
          const isConnected =
            hovered === 'center' ||
            hovered === node.id ||
            (node.id === 'center' && hovered !== null);
          const dimmed = hovered !== null && !isHov && !isConnected;
          const filterMap = {
            center: 'url(#glow-blue)',
            partner: 'url(#glow-green)',
            rakip: 'url(#glow-red)',
          };

          return (
            // biome-ignore lint/a11y/useSemanticElements: SVG <g> cannot be replaced with <button>
            <g
              key={node.id}
              role="button"
              tabIndex={0}
              aria-label={node.label}
              onMouseEnter={() => setHovered(node.id)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(node.id)}
              onBlur={() => setHovered(null)}
              style={{
                cursor: 'pointer',
                opacity: dimmed ? 0.3 : 1,
                transition: 'opacity 0.2s ease',
              }}
            >
              {/* Glow ring (hover) */}
              {isHov && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.radius + 6}
                  fill="none"
                  stroke={c.glow}
                  strokeWidth={3}
                  filter={filterMap[node.type]}
                />
              )}

              {/* Ana daire */}
              <circle
                cx={node.x}
                cy={node.y}
                r={isHov ? node.radius + 2 : node.radius}
                fill={c.fill}
                stroke={c.stroke}
                strokeWidth={2}
                style={{ transition: 'r 0.15s ease' }}
              />

              {/* İkon / etiket */}
              {node.type === 'center' ? (
                <text
                  x={node.x}
                  y={node.y + 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize={11}
                  fontWeight={700}
                  style={{ pointerEvents: 'none' }}
                >
                  SİZ
                </text>
              ) : (
                <>
                  {/* Node içi rakam (ihale sayısı veya toplam) */}
                  <text
                    x={node.x}
                    y={node.y + 1}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="white"
                    fontSize={node.radius > 20 ? 11 : 9}
                    fontWeight={600}
                    style={{ pointerEvents: 'none' }}
                  >
                    {node.type === 'rakip'
                      ? node.ihaleSayisi
                      : (node.devamEden ?? 0) + (node.tamamlanan ?? 0)}
                  </text>
                  {/* Dis etiket (firma adi) — sadece buyuk node'larda veya hover'da */}
                  {shouldShowLabel(node) && (
                    <text
                      x={node.x}
                      y={node.y + node.radius + 14}
                      textAnchor="middle"
                      fill={isHov ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.7)'}
                      fontSize={isHov ? 10 : 9}
                      fontWeight={isHov ? 600 : 400}
                      style={{ pointerEvents: 'none', transition: 'all 0.15s ease' }}
                    >
                      {truncate(node.label, 22)}
                    </text>
                  )}
                </>
              )}
            </g>
          );
        })}

        {/* Merkez etiket (firma adı alt) */}
        <text
          x={CENTER_X}
          y={CENTER_Y + CENTER_RADIUS + 16}
          textAnchor="middle"
          fill="rgba(255,255,255,0.9)"
          fontSize={11}
          fontWeight={600}
          style={{ pointerEvents: 'none' }}
        >
          {truncate(merkezAdi, 35)}
        </text>

        {/* Tooltip */}
        {hoveredNode && hoveredNode.type !== 'center' && (
          <GraphTooltip node={hoveredNode} mouseX={mouse.x} mouseY={mouse.y} />
        )}
      </svg>

      {/* Legend is now an overlay inside the graph area */}
    </Box>
  );
}

/* ─── Liste Görünümü (eski hali) ─── */

function ListeGorunumu({ ortaklar, rakipler }: { ortaklar: OrtakGirisim[]; rakipler: Rakip[] }) {
  return (
    <Stack gap="md">
      {ortaklar.length > 0 && (
        <div>
          <Text size="sm" fw={600} mb="xs" c="green">
            Ortak Girişim Partnerleri ({ortaklar.length})
          </Text>
          <Stack gap={4}>
            {ortaklar.map((og) => (
              <Group key={og.partner_adi} justify="space-between" wrap="nowrap">
                <Text size="xs" lineClamp={1} style={{ flex: 1 }}>
                  {og.partner_adi}
                </Text>
                <Group gap={6} wrap="nowrap">
                  {og.devam_eden > 0 && (
                    <Badge size="xs" variant="light" color="blue">
                      {og.devam_eden} devam
                    </Badge>
                  )}
                  {og.tamamlanan > 0 && (
                    <Badge size="xs" variant="light" color="green">
                      {og.tamamlanan} tamam
                    </Badge>
                  )}
                  {og.toplam_sozlesme > 0 && (
                    <Text size="xs" c="orange">
                      {formatCurrency(og.toplam_sozlesme)}
                    </Text>
                  )}
                </Group>
              </Group>
            ))}
          </Stack>
        </div>
      )}

      {rakipler.length > 0 && (
        <div>
          <Text size="sm" fw={600} mb="xs" c="red">
            En Sık Karşılaşılan Rakipler ({rakipler.length})
          </Text>
          <Stack gap={4}>
            {rakipler.slice(0, 15).map((r) => (
              <Group key={r.rakip_adi} justify="space-between" wrap="nowrap">
                <Text size="xs" lineClamp={1} style={{ flex: 1 }}>
                  {r.rakip_adi}
                </Text>
                <Group gap={6} wrap="nowrap">
                  <Badge size="xs" variant="light">
                    {r.ihale_sayisi} ihale
                  </Badge>
                  {r.toplam_sozlesme > 0 && (
                    <Text size="xs" c="orange">
                      {formatCurrency(r.toplam_sozlesme)}
                    </Text>
                  )}
                </Group>
              </Group>
            ))}
          </Stack>
        </div>
      )}
    </Stack>
  );
}

/* ─── Ana Export ─── */

export function IliskiAgiPaneli({ yukleniciId, yukleniciAdi }: Props) {
  const [analiz, setAnaliz] = useState<Record<string, unknown> | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [gorunum, setGorunum] = useState<GorunumModu>('grafik');

  const fetchAnaliz = useCallback(async () => {
    setYukleniyor(true);
    try {
      const res = await fetch(getApiUrl(`/contractors/${yukleniciId}/modul/profil_analizi/veri`), {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success && json.data?.analiz) {
        setAnaliz(json.data.analiz);
      }
    } catch (err) {
      console.error('İlişki ağı veri hatası:', err);
    } finally {
      setYukleniyor(false);
    }
  }, [yukleniciId]);

  useEffect(() => {
    fetchAnaliz();
  }, [fetchAnaliz]);

  if (yukleniyor)
    return (
      <Center py="xl">
        <Loader size="md" />
      </Center>
    );

  const ortakGirisimler = (analiz?.ortak_girisimler as OrtakGirisim[]) || [];
  const rakipler = (analiz?.rakipler as Rakip[]) || [];

  if (ortakGirisimler.length === 0 && rakipler.length === 0) {
    return (
      <Alert icon={<IconInfoCircle size={16} />} color="gray" variant="light" title="Veri Yetersiz">
        İlişki ağı için yeterli ortak girişim veya rakip verisi bulunamadı. Önce &quot;Profil
        Analizi&quot; modülünü çalıştırın.
      </Alert>
    );
  }

  const merkezAdi = yukleniciAdi || 'Seçili Yüklenici';

  return (
    <Stack gap="sm">
      {/* Görünüm seçici */}
      <Group justify="flex-end">
        <SegmentedControl
          size="xs"
          value={gorunum}
          onChange={(v) => setGorunum(v as GorunumModu)}
          data={[
            { label: 'Ağ Grafiği', value: 'grafik' },
            { label: 'Liste', value: 'liste' },
          ]}
        />
      </Group>

      {/* İçerik */}
      <Paper radius="md" p={0} style={{ overflow: 'hidden' }}>
        {gorunum === 'grafik' ? (
          <NetworkGraph ortaklar={ortakGirisimler} rakipler={rakipler} merkezAdi={merkezAdi} />
        ) : (
          <Box p="md">
            <ListeGorunumu ortaklar={ortakGirisimler} rakipler={rakipler} />
          </Box>
        )}
      </Paper>
    </Stack>
  );
}
