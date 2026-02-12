import {
  Badge,
  Box,
  CloseButton,
  Divider,
  Group,
  ScrollArea,
  Stack,
  Table,
  Tabs,
  Text,
  Tooltip,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconClipboardList,
  IconCoin,
  IconFileText,
  IconGripVertical,
  IconHelmet,
  IconSend,
  IconUsers,
} from '@tabler/icons-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import type { AnalysisData } from '../../types';
import { AGENTS } from '../constants';
import type { AgentHighlight, AgentPersona } from '../types';

// ─── Tab Definitions ─────────────────────────────────────────

const DOC_TABS = [
  { value: 'metin', label: 'Tam Metin', icon: IconFileText },
  { value: 'teknik', label: 'Teknik', icon: IconHelmet },
  { value: 'mali', label: 'Mali', icon: IconCoin },
  { value: 'personel', label: 'Personel', icon: IconUsers },
  { value: 'kosullar', label: 'Kosullar', icon: IconClipboardList },
] as const;

type DocTab = (typeof DOC_TABS)[number]['value'];

// ─── Props ───────────────────────────────────────────────────

interface DocumentViewerProps {
  title: string;
  kurum: string;
  bedel?: string;
  tamMetin?: string;
  analysisSummary?: AnalysisData;
  agentHighlights?: AgentHighlight[];
  expanded?: boolean;
  onExpand?: () => void;
  onCollapse?: () => void;
  onDragStart?: (text: string) => void;
  onDragEnd?: () => void;
  onSendToAgent?: (agentId: AgentPersona['id'], text: string) => void;
  onBroadcast?: (text: string) => void;
}

// ─── Defensive Helpers ───────────────────────────────────────

function getTeknikSartText(item: unknown): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    return String(obj.text || obj.madde || obj.aciklama || '');
  }
  return String(item);
}

function getCezaText(item: unknown): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    if (obj.aciklama) return String(obj.aciklama);
    if (obj.text) return String(obj.text);
    const parts: string[] = [];
    if (obj.tur) parts.push(String(obj.tur));
    if (obj.oran) parts.push(String(obj.oran));
    return parts.join(': ') || '';
  }
  return String(item);
}

function getBelgeInfo(item: unknown): { text: string; zorunlu: boolean } {
  if (typeof item === 'string') return { text: item, zorunlu: true };
  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    return {
      text: String(obj.belge || obj.text || obj.name || ''),
      zorunlu: obj.zorunlu !== false,
    };
  }
  return { text: String(item), zorunlu: true };
}

function getNotText(item: unknown): { text: string; tur?: string } {
  if (typeof item === 'string') return { text: item };
  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    return {
      text: String(obj.not || obj.metin || obj.text || ''),
      tur: obj.tur ? String(obj.tur) : undefined,
    };
  }
  return { text: String(item) };
}

function isOgunTable(item: unknown): item is { rows: string[][]; headers: string[] } {
  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    return Array.isArray(obj.rows) && Array.isArray(obj.headers);
  }
  return false;
}

function isMaliKriterValid(val: unknown): val is string {
  return typeof val === 'string' && val.length > 0 && val.toLowerCase() !== 'belirtilmemiş' && val !== '-';
}

// ─── Shared Table Styles ────────────────────────────────────

const DARK_TABLE_STYLES = {
  table: { borderColor: 'rgba(255,255,255,0.06)' },
  th: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    padding: '6px 10px',
    background: 'rgba(255,255,255,0.02)',
  },
  td: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    padding: '5px 10px',
  },
} as const;

// ─── Component ───────────────────────────────────────────────

export function DocumentViewer({
  title,
  kurum,
  bedel,
  tamMetin,
  analysisSummary,
  agentHighlights = [],
  expanded = false,
  onExpand,
  onCollapse,
  onDragStart,
  onDragEnd,
  onSendToAgent,
  onBroadcast,
}: DocumentViewerProps) {
  const [activeTab, setActiveTab] = useState<DocTab>('metin');
  const [selectedText, setSelectedText] = useState('');
  const [showDragHandle, setShowDragHandle] = useState(false);
  const [handlePos, setHandlePos] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; text: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ─── Text Selection & Drag ─────────────────────────────────

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && text.length > 10) {
      setSelectedText(text);
      const range = selection?.getRangeAt(0);
      if (range && containerRef.current) {
        const rect = range.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();
        setHandlePos({
          x: rect.right - containerRect.left + 8,
          y: rect.top - containerRect.top + rect.height / 2 - 14,
        });
        setShowDragHandle(true);
      }
    } else {
      setShowDragHandle(false);
      setSelectedText('');
    }
  }, []);

  const handleDragHandleStart = useCallback(() => {
    if (selectedText && onDragStart) {
      onDragStart(selectedText);
    }
  }, [selectedText, onDragStart]);

  const handleDragHandleEnd = useCallback(() => {
    setShowDragHandle(false);
    setSelectedText('');
    window.getSelection()?.removeAllRanges();
    onDragEnd?.();
  }, [onDragEnd]);

  // ─── Context Menu ──────────────────────────────────────────

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && text.length > 5) {
      e.preventDefault();
      if (containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        setContextMenu({
          x: e.clientX - containerRect.left,
          y: e.clientY - containerRect.top,
        text,
        });
      }
    }
  }, []);

  const handleSendTo = useCallback(
    (agentId: AgentPersona['id']) => {
      if (contextMenu?.text && onSendToAgent) {
        onSendToAgent(agentId, contextMenu.text);
      }
      setContextMenu(null);
    },
    [contextMenu, onSendToAgent]
  );

  const handleBroadcast = useCallback(() => {
    if (contextMenu?.text && onBroadcast) {
      onBroadcast(contextMenu.text);
    }
    setContextMenu(null);
  }, [contextMenu, onBroadcast]);

  const handleContainerClick = useCallback(() => {
    if (contextMenu) setContextMenu(null);
  }, [contextMenu]);

  // ─── Paragraphs with Highlights ────────────────────────────

  const paragraphs = useMemo(() => {
    return tamMetin ? tamMetin.split(/\n\n+/).filter((p) => p.trim()) : [];
  }, [tamMetin]);

  // ─── Click to expand ──────────────────────────────────────

  const handleCardClick = useCallback(() => {
    if (!expanded && onExpand) {
      onExpand();
    }
  }, [expanded, onExpand]);

  // ─── Render ────────────────────────────────────────────────

  return (
    <AnimatePresence mode="wait">
      {expanded ? (
        <motion.div
          key="expanded"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 25 }}
          style={{ borderRadius: 20 }}
        >
          <Box
            ref={containerRef}
            onClick={handleContainerClick}
            style={{
              position: 'relative',
              width: 'min(820px, 65vw)',
              height: 'min(620px, 72vh)',
              borderRadius: 20,
              background: 'linear-gradient(145deg, rgba(30, 30, 50, 0.96), rgba(18, 18, 32, 0.98))',
              backdropFilter: 'blur(32px)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 40px rgba(139,92,246,0.08)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* ── Expanded Header ─── */}
            <Box
              px="lg"
              py="sm"
              style={{
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.02)',
                flexShrink: 0,
              }}
            >
              <Group justify="space-between" align="center">
                <Group gap="sm" align="center" style={{ flex: 1, minWidth: 0 }}>
                  <IconFileText size={20} color="rgba(200,200,220,0.8)" />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Text size="sm" fw={700} c="white" lineClamp={1}>
                      {title}
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {kurum}
                    </Text>
                  </div>
                  {bedel && (
                    <Badge size="sm" variant="light" color="cyan" style={{ flexShrink: 0 }}>
                      {bedel}
                    </Badge>
                  )}
                </Group>
                <CloseButton
                  variant="subtle"
                  color="gray"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCollapse?.();
                  }}
                />
              </Group>
            </Box>

            {/* ── Tab Navigation ─── */}
            <Tabs
              value={activeTab}
              onChange={(v) => setActiveTab((v as DocTab) || 'metin')}
              variant="pills"
              radius="xl"
              styles={{
                root: { borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 },
                list: { padding: '8px 16px', gap: 6 },
                tab: {
                  fontSize: 12,
                  padding: '6px 14px',
                  color: 'rgba(255,255,255,0.5)',
                  fontWeight: 600,
                },
              }}
            >
              <Tabs.List>
                {DOC_TABS.map((tab) => (
                  <Tabs.Tab key={tab.value} value={tab.value} leftSection={<tab.icon size={14} />}>
                    {tab.label}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs>

            {/* ── Tab Content (expanded) ─── */}
            <ScrollArea style={{ flex: 1, minHeight: 0 }} type="hover" offsetScrollbars scrollbarSize={6}>
              <Box
                p="lg"
                onMouseUp={handleMouseUp}
                onContextMenu={handleContextMenu}
                style={{ userSelect: 'text', cursor: 'text' }}
              >
                {activeTab === 'metin' && (
                  <MetinTab paragraphs={paragraphs} agentHighlights={agentHighlights} expanded />
                )}
                {activeTab === 'teknik' && <TeknikTabExpanded data={analysisSummary} />}
                {activeTab === 'mali' && <MaliTabExpanded data={analysisSummary} />}
                {activeTab === 'personel' && <PersonelTabExpanded data={analysisSummary} />}
                {activeTab === 'kosullar' && <KosullarTabExpanded data={analysisSummary} />}
              </Box>
            </ScrollArea>

            {/* ── Drag Handle (expanded) ─── */}
            {showDragHandle && (
              <DragHandle
                pos={handlePos}
                text={selectedText}
                onDragStart={handleDragHandleStart}
                onDragEnd={handleDragHandleEnd}
              />
            )}

            {/* ── Context Menu (expanded) ─── */}
            {contextMenu && (onSendToAgent || onBroadcast) && (
              <ContextMenuPopup
                x={contextMenu.x}
                y={contextMenu.y}
                onSendTo={handleSendTo}
                onBroadcast={onBroadcast ? handleBroadcast : undefined}
              />
            )}
          </Box>
        </motion.div>
      ) : (
        /* ── Collapsed (orbit small card) ─── */
        <motion.div
          key="collapsed"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 25 }}
          style={{ borderRadius: 16 }}
        >
          <motion.div
            animate={{
              scale: [1, 1.015, 1],
              boxShadow: [
                '0 0 30px rgba(255,255,255,0.04)',
                '0 0 50px rgba(255,255,255,0.1)',
                '0 0 30px rgba(255,255,255,0.04)',
              ],
            }}
            transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
            style={{ borderRadius: 16 }}
          >
            <Tooltip label="Tikla — dokumani genislet" position="top" withArrow>
              <Box
                className="document-stack"
                ref={containerRef}
                style={{ position: 'relative', cursor: 'pointer' }}
                onClick={handleCardClick}
              >
                <Box className="document-viewer">
                  <div className="document-scan-bar" />

                  {/* Header */}
                  <Box className="document-viewer-header">
                    <Stack align="center" gap={8}>
                      <IconFileText size={24} color="rgba(200,200,220,0.8)" />
                      <Text size="sm" fw={700} ta="center" c="white" lineClamp={2} style={{ lineHeight: 1.4 }}>
                        {title}
                      </Text>
                      <Text size="xs" ta="center" c="dimmed" lineClamp={1}>
                        {kurum}
                      </Text>
                      {bedel && (
                        <Badge size="sm" variant="light" color="cyan">
                          {bedel}
                        </Badge>
                      )}
                    </Stack>
                  </Box>

                  {/* Mini summary in collapsed mode */}
                  <Box px="sm" py={8}>
                    <Stack gap={4}>
                      {analysisSummary?.teknik_sartlar?.length ? (
                        <MiniStat label="Teknik" value={`${analysisSummary.teknik_sartlar.length} madde`} />
                      ) : null}
                      {analysisSummary?.birim_fiyatlar?.length ? (
                        <MiniStat label="Fiyat" value={`${analysisSummary.birim_fiyatlar.length} kalem`} />
                      ) : null}
                      {analysisSummary?.personel_detaylari?.length ? (
                        <MiniStat
                          label="Personel"
                          value={`${analysisSummary.personel_detaylari.reduce((s, p) => s + (p.adet || 0), 0)} kisi`}
                        />
                      ) : null}
                      {analysisSummary?.gerekli_belgeler?.length ? (
                        <MiniStat label="Belge" value={`${analysisSummary.gerekli_belgeler.length} belge`} />
                      ) : null}
                    </Stack>
                  </Box>
                </Box>
              </Box>
            </Tooltip>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB COMPONENTS — EXPANDED (Rich data views)
// ═══════════════════════════════════════════════════════════════

// ─── Tam Metin Tab ──────────────────────────────────────────

function MetinTab({
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

// ─── Teknik Sartlar Tab (Expanded) ──────────────────────────

function TeknikTabExpanded({ data }: { data?: AnalysisData }) {
  if (!data) return <EmptyTab />;

  const hasTeknik = !!data.teknik_sartlar?.length;
  const hasEkipman = !!data.ekipman_listesi;
  const hasKalite = !!data.kalite_standartlari;
  const hasOgun = !!data.ogun_bilgileri?.length;
  const hasServis = !!(data.servis_saatleri?.kahvalti || data.servis_saatleri?.ogle || data.servis_saatleri?.aksam);
  const hasSure = !!(data.sure || data.teslim_suresi);

  if (!hasTeknik && !hasEkipman && !hasKalite && !hasOgun && !hasServis && !hasSure) {
    return <EmptyTab message="Teknik veri bulunamadi" />;
  }

  return (
    <Stack gap="lg">
      {/* Teknik Sartlar */}
      {hasTeknik && (
        <SectionBlock title="Teknik Sartlar" count={data.teknik_sartlar?.length}>
          <Stack gap={6}>
            {(data.teknik_sartlar ?? []).map((item, idx) => {
              const text = getTeknikSartText(item);
              if (!text) return null;
              const isZorunlu = text.toLowerCase().includes('zorunlu');
              return (
                <Group key={`ts-${text.slice(0, 60)}`} gap="xs" wrap="nowrap" align="flex-start">
                  <Text size="xs" c="dimmed" w={24} ta="right" style={{ flexShrink: 0 }}>
                    {idx + 1}.
                  </Text>
                  <Text size="xs" c="gray.3" style={{ lineHeight: 1.6, flex: 1 }}>
                    {text}
                  </Text>
                  {isZorunlu && (
                    <Badge size="xs" variant="light" color="red" style={{ flexShrink: 0 }}>
                      Zorunlu
                    </Badge>
                  )}
                </Group>
              );
            })}
          </Stack>
        </SectionBlock>
      )}

      {/* Ekipman & Kalite */}
      {(hasEkipman || hasKalite) && (
        <SectionBlock title="Ekipman & Kalite">
          <Stack gap={8}>
            {hasEkipman && <DataRow label="Ekipman Listesi" value={data.ekipman_listesi ?? ''} />}
            {hasKalite && <DataRow label="Kalite Standartlari" value={data.kalite_standartlari ?? ''} />}
          </Stack>
        </SectionBlock>
      )}

      {/* Ogun Bilgileri (shared component) */}
      {hasOgun && <OgunSection data={data} />}

      {/* Servis Saatleri (shared component) */}
      {hasServis && <ServisSaatleriSection data={data} />}

      {/* Sure */}
      {hasSure && (
        <SectionBlock title="Sure / Teslim">
          <DataRow label="Sure" value={data.sure || data.teslim_suresi || ''} />
        </SectionBlock>
      )}
    </Stack>
  );
}

// ─── Mali Tab (Expanded) ────────────────────────────────────

function MaliTabExpanded({ data }: { data?: AnalysisData }) {
  if (!data) return <EmptyTab />;

  const hasBedel = !!data.tahmini_bedel;
  const hasIscilik = !!data.iscilik_orani;
  const hasBirimFiyat = !!data.birim_fiyatlar?.length;
  const hasMali = !!(
    isMaliKriterValid(data.mali_kriterler?.cari_oran) ||
    isMaliKriterValid(data.mali_kriterler?.ozkaynak_orani) ||
    isMaliKriterValid(data.mali_kriterler?.is_deneyimi) ||
    isMaliKriterValid(data.mali_kriterler?.ciro_orani)
  );
  const hasTeminat = !!(data.teminat_oranlari?.gecici || data.teminat_oranlari?.kesin || data.teminat_oranlari?.ek_kesin);
  const hasOdeme = !!(data.odeme_kosullari?.odeme_suresi || data.odeme_kosullari?.avans || data.odeme_kosullari?.odeme_periyodu);
  const hasFiyatFarki = !!data.fiyat_farki?.formul;

  if (!hasBedel && !hasBirimFiyat && !hasMali && !hasTeminat && !hasOdeme) {
    return <EmptyTab message="Mali veri bulunamadi" />;
  }

  return (
    <Stack gap="lg">
      {/* Genel Mali Bilgiler */}
      {(hasBedel || hasIscilik) && (
        <SectionBlock title="Genel Mali Bilgiler">
          <Stack gap={8}>
            {hasBedel && <DataRow label="Tahmini Bedel" value={data.tahmini_bedel ?? ''} highlight />}
            {hasIscilik && <DataRow label="Iscilik Orani" value={data.iscilik_orani ?? ''} />}
          </Stack>
        </SectionBlock>
      )}

      {/* Birim Fiyatlar Tablosu */}
      {hasBirimFiyat && (
        <SectionBlock title="Birim Fiyat Cetveli" count={data.birim_fiyatlar?.length}>
          <Table
            withTableBorder
            withColumnBorders
            highlightOnHover
            styles={DARK_TABLE_STYLES}
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th>#</Table.Th>
                <Table.Th>Kalem</Table.Th>
                <Table.Th>Birim</Table.Th>
                <Table.Th ta="right">Miktar</Table.Th>
                <Table.Th ta="right">Fiyat</Table.Th>
                <Table.Th ta="right">Tutar</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(data.birim_fiyatlar ?? []).map((bf, idx) => {
                const kalem = bf.kalem || bf.aciklama || bf.text || '—';
                return (
                  <Table.Tr key={`bf-${kalem}-${bf.birim || ''}-${bf.miktar ?? ''}`}>
                    <Table.Td>{idx + 1}</Table.Td>
                    <Table.Td style={{ maxWidth: 240, wordBreak: 'break-word' }}>{kalem}</Table.Td>
                    <Table.Td>{bf.birim || '—'}</Table.Td>
                    <Table.Td ta="right">{bf.miktar ?? '—'}</Table.Td>
                    <Table.Td ta="right">{bf.fiyat ?? '—'}</Table.Td>
                    <Table.Td ta="right">{bf.tutar ?? '—'}</Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </SectionBlock>
      )}

      {/* Mali Yeterlilik Kriterleri */}
      {hasMali && (
        <SectionBlock title="Mali Yeterlilik Kriterleri">
          <Stack gap={6}>
            {isMaliKriterValid(data.mali_kriterler?.cari_oran) && (
              <DataRow label="Cari Oran" value={data.mali_kriterler?.cari_oran ?? ''} />
            )}
            {isMaliKriterValid(data.mali_kriterler?.ozkaynak_orani) && (
              <DataRow label="Ozkaynak Orani" value={data.mali_kriterler?.ozkaynak_orani ?? ''} />
            )}
            {isMaliKriterValid(data.mali_kriterler?.is_deneyimi) && (
              <DataRow label="Is Deneyimi" value={data.mali_kriterler?.is_deneyimi ?? ''} />
            )}
            {isMaliKriterValid(data.mali_kriterler?.ciro_orani) && (
              <DataRow label="Ciro Orani" value={data.mali_kriterler?.ciro_orani ?? ''} />
            )}
          </Stack>
        </SectionBlock>
      )}

      {/* Teminat */}
      {hasTeminat && (
        <SectionBlock title="Teminat Oranlari">
          <Stack gap={6}>
            {data.teminat_oranlari?.gecici && <DataRow label="Gecici Teminat" value={data.teminat_oranlari.gecici} />}
            {data.teminat_oranlari?.kesin && <DataRow label="Kesin Teminat" value={data.teminat_oranlari.kesin} />}
            {data.teminat_oranlari?.ek_kesin && <DataRow label="Ek Kesin Teminat" value={data.teminat_oranlari.ek_kesin} />}
          </Stack>
        </SectionBlock>
      )}

      {/* Odeme Kosullari */}
      {hasOdeme && (
        <SectionBlock title="Odeme Kosullari">
          <Stack gap={6}>
            {data.odeme_kosullari?.odeme_suresi && <DataRow label="Odeme Suresi" value={data.odeme_kosullari.odeme_suresi} />}
            {data.odeme_kosullari?.avans && <DataRow label="Avans" value={data.odeme_kosullari.avans} />}
            {data.odeme_kosullari?.odeme_periyodu && <DataRow label="Periyot" value={data.odeme_kosullari.odeme_periyodu} />}
            {data.odeme_kosullari?.hakedis_suresi && <DataRow label="Hakedis Suresi" value={data.odeme_kosullari.hakedis_suresi} />}
          </Stack>
        </SectionBlock>
      )}

      {/* Fiyat Farki */}
      {hasFiyatFarki && (
        <SectionBlock title="Fiyat Farki">
          <DataRow label="Formul" value={data.fiyat_farki?.formul ?? ''} />
        </SectionBlock>
      )}
    </Stack>
  );
}

// ─── Personel Tab (Expanded) ────────────────────────────────

function PersonelTabExpanded({ data }: { data?: AnalysisData }) {
  if (!data) return <EmptyTab />;

  const hasPersonel = !!data.personel_detaylari?.length;
  const hasKisiSayisi = !!data.kisi_sayisi;
  const hasOgun = !!data.ogun_bilgileri?.length;
  const hasServis = !!(data.servis_saatleri?.kahvalti || data.servis_saatleri?.ogle || data.servis_saatleri?.aksam);
  const hasIsYerleri = !!data.is_yerleri?.length;
  const hasKurallar = !!data.operasyonel_kurallar?.personel_kurallari?.length;

  if (!hasPersonel && !hasKisiSayisi && !hasOgun && !hasIsYerleri) {
    return <EmptyTab message="Personel verisi bulunamadi" />;
  }

  // Filter out zero-count entries
  const personelFiltered = data.personel_detaylari?.filter((p) => p.adet > 0) ?? [];
  const toplamPersonel = personelFiltered.reduce((s, p) => s + p.adet, 0);

  return (
    <Stack gap="lg">
      {/* Personel Detaylari */}
      {(personelFiltered.length > 0 || hasKisiSayisi) && (
        <SectionBlock
          title="Personel Gereksinimleri"
          count={personelFiltered.length || undefined}
          badge={toplamPersonel > 0 ? `Toplam: ${toplamPersonel} kisi` : data.kisi_sayisi || undefined}
        >
          {personelFiltered.length > 0 ? (
            <Table
              withTableBorder
              withColumnBorders
              highlightOnHover
              styles={DARK_TABLE_STYLES}
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Pozisyon</Table.Th>
                  <Table.Th ta="center">Adet</Table.Th>
                  <Table.Th>Ucret Orani</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {personelFiltered.map((p) => (
                  <Table.Tr key={`${p.pozisyon}-${p.adet}`}>
                    <Table.Td>{p.pozisyon}</Table.Td>
                    <Table.Td ta="center">{p.adet}</Table.Td>
                    <Table.Td>{p.ucret_orani || '—'}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <DataRow label="Kisi Sayisi" value={data.kisi_sayisi ?? ''} />
          )}
        </SectionBlock>
      )}

      {/* Ogun Bilgileri (shared component) */}
      {hasOgun && <OgunSection data={data} />}

      {/* Servis Saatleri (shared component) */}
      {hasServis && <ServisSaatleriSection data={data} />}

      {/* Is Yerleri */}
      {hasIsYerleri && (
        <SectionBlock title="Is Yerleri" count={data.is_yerleri?.length}>
          <Stack gap={4}>
            {(data.is_yerleri ?? []).map((yer, idx) => (
              <Text key={yer} size="xs" c="gray.3" style={{ lineHeight: 1.5 }}>
                {idx + 1}. {yer}
              </Text>
            ))}
          </Stack>
        </SectionBlock>
      )}

      {/* Personel Kurallari */}
      {hasKurallar && (
        <SectionBlock title="Personel Kurallari" count={data.operasyonel_kurallar?.personel_kurallari?.length}>
          <Stack gap={4}>
            {(data.operasyonel_kurallar?.personel_kurallari ?? []).map((kural) => (
              <Text key={kural.slice(0, 80)} size="xs" c="gray.3" style={{ lineHeight: 1.5 }}>
                {kural}
              </Text>
            ))}
          </Stack>
        </SectionBlock>
      )}
    </Stack>
  );
}

// ─── Kosullar Tab (Expanded) ────────────────────────────────

function KosullarTabExpanded({ data }: { data?: AnalysisData }) {
  if (!data) return <EmptyTab />;

  const hasGenel = !!(data.ihale_usulu || data.ihale_turu || data.teklif_turu || data.sinir_deger_katsayisi);
  const hasBenzerIs = !!data.benzer_is_tanimi;
  const hasCeza = !!data.ceza_kosullari?.length;
  const hasBelge = !!data.gerekli_belgeler?.length;
  const hasIsArtisi = !!data.is_artisi?.oran;
  const hasOp = !!(data.operasyonel_kurallar?.alt_yuklenici || data.operasyonel_kurallar?.muayene_kabul || data.operasyonel_kurallar?.denetim);
  const hasEksik = !!data.eksik_bilgiler?.length;
  const hasNotlar = !!data.onemli_notlar?.length;
  const hasYemekKural = !!data.operasyonel_kurallar?.yemek_kurallari?.length;

  if (!hasGenel && !hasCeza && !hasBelge && !hasEksik && !hasNotlar) {
    return <EmptyTab message="Kosul verisi bulunamadi" />;
  }

  return (
    <Stack gap="lg">
      {/* Genel Ihale Bilgileri */}
      {hasGenel && (
        <SectionBlock title="Genel Ihale Bilgileri">
          <Stack gap={6}>
            {data.ihale_usulu && <DataRow label="Ihale Usulu" value={data.ihale_usulu} />}
            {data.ihale_turu && <DataRow label="Ihale Turu" value={data.ihale_turu} />}
            {data.teklif_turu && <DataRow label="Teklif Turu" value={data.teklif_turu} />}
            {data.sinir_deger_katsayisi && <DataRow label="Sinir Deger Katsayisi" value={data.sinir_deger_katsayisi} />}
          </Stack>
        </SectionBlock>
      )}

      {/* Benzer Is */}
      {hasBenzerIs && (
        <SectionBlock title="Benzer Is Tanimi">
          <Text size="xs" c="gray.3" style={{ lineHeight: 1.6 }}>
            {data.benzer_is_tanimi}
          </Text>
        </SectionBlock>
      )}

      {/* Ceza Kosullari */}
      {hasCeza && (
        <SectionBlock title="Ceza Kosullari" count={data.ceza_kosullari?.length}>
          <Stack gap={6}>
            {(data.ceza_kosullari ?? []).map((item) => {
              const text = getCezaText(item);
              if (!text) return null;
              return (
                <Group key={`ceza-${text.slice(0, 60)}`} gap="xs" wrap="nowrap" align="flex-start">
                  <IconAlertTriangle size={14} color="rgba(244,63,94,0.7)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <Text size="xs" c="gray.3" style={{ lineHeight: 1.6 }}>
                    {text}
                  </Text>
                </Group>
              );
            })}
          </Stack>
        </SectionBlock>
      )}

      {/* Gerekli Belgeler */}
      {hasBelge && (
        <SectionBlock title="Gerekli Belgeler" count={data.gerekli_belgeler?.length}>
          <Stack gap={4}>
            {(data.gerekli_belgeler ?? []).map((item) => {
              const belge = getBelgeInfo(item);
              if (!belge.text) return null;
              return (
                <Group key={`belge-${belge.text.slice(0, 60)}`} gap="xs" wrap="nowrap">
                  <Badge
                    size="xs"
                    variant="light"
                    color={belge.zorunlu ? 'red' : 'gray'}
                    style={{ flexShrink: 0 }}
                  >
                    {belge.zorunlu ? 'Zorunlu' : 'Opsiyonel'}
                  </Badge>
                  <Text size="xs" c="gray.3" style={{ lineHeight: 1.5 }}>
                    {belge.text}
                  </Text>
                </Group>
              );
            })}
          </Stack>
        </SectionBlock>
      )}

      {/* Is Artisi */}
      {hasIsArtisi && (
        <SectionBlock title="Is Artisi">
          <Stack gap={6}>
            <DataRow label="Oran" value={data.is_artisi?.oran ?? ''} />
            {data.is_artisi?.kosullar && <DataRow label="Kosullar" value={data.is_artisi.kosullar} />}
            {data.is_artisi?.is_eksilisi && <DataRow label="Is Eksilisi" value={data.is_artisi.is_eksilisi} />}
          </Stack>
        </SectionBlock>
      )}

      {/* Operasyonel Kurallar */}
      {hasOp && (
        <SectionBlock title="Operasyonel Kurallar">
          <Stack gap={6}>
            {data.operasyonel_kurallar?.alt_yuklenici && <DataRow label="Alt Yuklenici" value={data.operasyonel_kurallar.alt_yuklenici} />}
            {data.operasyonel_kurallar?.muayene_kabul && <DataRow label="Muayene & Kabul" value={data.operasyonel_kurallar.muayene_kabul} />}
            {data.operasyonel_kurallar?.denetim && <DataRow label="Denetim" value={data.operasyonel_kurallar.denetim} />}
          </Stack>
        </SectionBlock>
      )}

      {/* Yemek Kurallari */}
      {hasYemekKural && (
        <SectionBlock title="Yemek Kurallari" count={data.operasyonel_kurallar?.yemek_kurallari?.length}>
          <Stack gap={4}>
            {(data.operasyonel_kurallar?.yemek_kurallari ?? []).map((kural) => (
              <Text key={kural.slice(0, 80)} size="xs" c="gray.3" style={{ lineHeight: 1.5 }}>
                {kural}
              </Text>
            ))}
          </Stack>
        </SectionBlock>
      )}

      {/* Eksik Bilgiler */}
      {hasEksik && (
        <SectionBlock title="Eksik Bilgiler" count={data.eksik_bilgiler?.length}>
          <Box
            p="sm"
            style={{
              background: 'rgba(244, 63, 94, 0.06)',
              borderRadius: 8,
              border: '1px solid rgba(244, 63, 94, 0.15)',
            }}
          >
            <Stack gap={4}>
              {(data.eksik_bilgiler ?? []).map((e) => (
                <Group key={e.slice(0, 80)} gap="xs" wrap="nowrap">
                  <IconAlertTriangle size={12} color="rgba(244,63,94,0.8)" style={{ flexShrink: 0 }} />
                  <Text size="xs" c="red.3" style={{ lineHeight: 1.5 }}>
                    {e}
                  </Text>
                </Group>
              ))}
            </Stack>
          </Box>
        </SectionBlock>
      )}

      {/* Onemli Notlar */}
      {hasNotlar && (
        <SectionBlock title="Onemli Notlar" count={data.onemli_notlar?.length}>
          <Stack gap={6}>
            {(data.onemli_notlar ?? []).map((item) => {
              const not = getNotText(item);
              if (!not.text) return null;
              const turColor = not.tur === 'uyari' ? 'yellow' : not.tur === 'kritik' || not.tur === 'gereklilik' ? 'red' : 'gray';
              return (
                <Group key={`not-${not.text.slice(0, 60)}`} gap="xs" wrap="nowrap" align="flex-start">
                  {not.tur && (
                    <Badge size="xs" variant="light" color={turColor} style={{ flexShrink: 0 }}>
                      {not.tur}
                    </Badge>
                  )}
                  <Text size="xs" c="gray.3" style={{ lineHeight: 1.6, flex: 1 }}>
                    {not.text}
                  </Text>
                </Group>
              );
            })}
          </Stack>
        </SectionBlock>
      )}
    </Stack>
  );
}

// ═══════════════════════════════════════════════════════════════
// SHARED UI COMPONENTS
// ═══════════════════════════════════════════════════════════════

function SectionBlock({
  title,
  count,
  badge,
  children,
}: {
  title: string;
  count?: number;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <Group gap="xs" mb={8}>
        <Text size="xs" fw={700} c="white" tt="uppercase" style={{ letterSpacing: 0.8 }}>
          {title}
        </Text>
        {count !== undefined && (
          <Badge size="xs" variant="light" color="gray" radius="sm">
            {count}
          </Badge>
        )}
        {badge && (
          <Badge size="xs" variant="light" color="cyan" radius="sm">
            {badge}
          </Badge>
        )}
      </Group>
      <Divider color="rgba(255,255,255,0.04)" mb={8} />
      {children}
    </Box>
  );
}

function DataRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Box
      p={8}
      style={{
        background: highlight ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.02)',
        borderRadius: 8,
        borderLeft: `2px solid ${highlight ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.06)'}`,
      }}
    >
      <Text size="10px" c="dimmed" fw={600} tt="uppercase" mb={2}>
        {label}
      </Text>
      <Text size="xs" c={highlight ? 'green.3' : 'gray.3'} fw={highlight ? 600 : 400} style={{ lineHeight: 1.5, wordBreak: 'break-word' }}>
        {value}
      </Text>
    </Box>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Group gap={6} wrap="nowrap">
      <Text size="9px" c="dimmed" fw={600} w={50}>
        {label}
      </Text>
      <Text size="9px" c="gray.4" fw={500}>
        {value}
      </Text>
    </Group>
  );
}

function EmptyTab({ message = 'Veri bulunamadi' }: { message?: string }) {
  return (
    <Text size="xs" c="dimmed" ta="center" py="xl">
      {message}
    </Text>
  );
}

// ─── Shared Tab Sections (used by multiple tabs) ────────────

function OgunSection({ data }: { data: AnalysisData }) {
  if (!data.ogun_bilgileri?.length) return null;
  return (
    <SectionBlock title="Ogun Bilgileri" count={data.ogun_bilgileri.length}>
      <Stack gap={8}>
        {data.ogun_bilgileri.map((ogun) => {
          if (isOgunTable(ogun)) {
            return (
              <Box key={`ogun-tbl-${ogun.headers.join('-')}`}>
                <Table
                  withTableBorder
                  withColumnBorders
                  highlightOnHover
                  styles={DARK_TABLE_STYLES}
                >
                  <Table.Thead>
                    <Table.Tr>
                      {ogun.headers.map((h) => (
                        <Table.Th key={h}>{h}</Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {ogun.rows.map((row) => (
                      <Table.Tr key={row.join('-')}>
                        {row.map((cell) => (
                          <Table.Td key={cell}>{cell}</Table.Td>
                        ))}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Box>
            );
          }
          if (!ogun.tur) return null;
          return (
            <DataRow
              key={`ogun-${ogun.tur}`}
              label={`Ogun: ${ogun.tur}`}
              value={ogun.miktar ? `${ogun.miktar} ${ogun.birim || 'kisi'}` : 'Detay mevcut'}
            />
          );
        })}
      </Stack>
    </SectionBlock>
  );
}

function ServisSaatleriSection({ data }: { data: AnalysisData }) {
  const has =
    data.servis_saatleri?.kahvalti || data.servis_saatleri?.ogle || data.servis_saatleri?.aksam;
  if (!has) return null;
  return (
    <SectionBlock title="Servis Saatleri">
      <Stack gap={6}>
        {data.servis_saatleri?.kahvalti && (
          <DataRow label="Kahvalti" value={data.servis_saatleri.kahvalti} />
        )}
        {data.servis_saatleri?.ogle && (
          <DataRow label="Ogle" value={data.servis_saatleri.ogle} />
        )}
        {data.servis_saatleri?.aksam && (
          <DataRow label="Aksam" value={data.servis_saatleri.aksam} />
        )}
      </Stack>
    </SectionBlock>
  );
}

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

// ─── Drag Handle ─────────────────────────────────────────────

function DragHandle({
  pos,
  text,
  onDragStart,
  onDragEnd,
}: {
  pos: { x: number; y: number };
  text: string;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  return (
    <motion.div
      drag
      dragSnapToOrigin
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.1 }}
      whileDrag={{ scale: 1.2, zIndex: 100 }}
      style={{
        position: 'absolute',
        top: pos.y,
        left: pos.x,
        cursor: 'grab',
        zIndex: 50,
      }}
    >
      <Box className="drag-handle-chip">
        <IconGripVertical size={12} />
        <Text size="9px" fw={600} lineClamp={1} style={{ maxWidth: 80 }}>
          {text.slice(0, 30)}...
        </Text>
      </Box>
    </motion.div>
  );
}

// ─── Context Menu ────────────────────────────────────────────

function ContextMenuPopup({
  x,
  y,
  onSendTo,
  onBroadcast,
}: {
  x: number;
  y: number;
  onSendTo: (agentId: AgentPersona['id']) => void;
  onBroadcast?: () => void;
}) {
  return (
    <Box
      style={{
        position: 'absolute',
        top: y,
        left: x,
        zIndex: 60,
        background: 'rgba(20,20,35,0.95)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10,
        padding: 4,
        backdropFilter: 'blur(12px)',
        minWidth: 200,
      }}
    >
      <Stack gap={2}>
        <Text size="9px" c="dimmed" px={8} pt={4} pb={2} fw={600}>
          Ajana Gonder
        </Text>
        {AGENTS.map((agent) => (
          <Box
            key={agent.id}
            px={8}
            py={5}
            style={{
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
            onClick={() => onSendTo(agent.id)}
          >
            <Group gap={6}>
              <Box
                w={8}
                h={8}
                style={{
                  borderRadius: '50%',
                  background: `var(--mantine-color-${agent.color}-5)`,
                  flexShrink: 0,
                }}
              />
              <Text size="xs" c="white" fw={500}>
                {agent.name}
              </Text>
            </Group>
          </Box>
        ))}
        {onBroadcast && (
          <>
            <Box style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '2px 8px' }} />
            <Box
              px={8}
              py={5}
              style={{
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
              onClick={onBroadcast}
            >
              <Group gap={6}>
                <IconSend size={12} color="rgba(255,255,255,0.6)" />
                <Text size="xs" c="white" fw={500}>
                  Tum Ajanlara Gonder
                </Text>
              </Group>
            </Box>
          </>
        )}
      </Stack>
    </Box>
  );
}
