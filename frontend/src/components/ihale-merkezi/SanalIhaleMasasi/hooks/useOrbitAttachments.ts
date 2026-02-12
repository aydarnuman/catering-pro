import { useCallback, useMemo, useState } from 'react';
import { API_BASE_URL } from '@/lib/config';
import type { AnalysisData } from '../../types';
import { ATTACHMENT_TYPE_MAP, ORBIT_RING_CONFIG } from '../constants';
import type {
  AgentPersona,
  AttachmentDetailState,
  AttachmentType,
  OrbitAttachment,
  ToolResult,
} from '../types';

// ─── API helpers ────────────────────────────────────────

const API = `${API_BASE_URL}/api`;

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts?.headers as Record<string, string>) },
    ...opts,
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// ─── Backend → Frontend mapping ─────────────────────────

function mapNoteToAttachment(note: Record<string, unknown>): OrbitAttachment {
  const meta = (note.metadata || {}) as Record<string, unknown>;
  const attachmentType = (meta.attachment_type as AttachmentType) || 'note';
  const config = ATTACHMENT_TYPE_MAP[attachmentType];

  return {
    id: String(note.id),
    title: (note.title as string) || '',
    type: attachmentType,
    content: (note.content as string) || '',
    contentFormat: ((note.content_format as string) || 'plain') as 'plain' | 'markdown',
    color: config?.color || (note.color as string) || 'yellow',
    pinned: (note.pinned as boolean) || false,
    sourceAgent: meta.source_agent as AgentPersona['id'] | undefined,
    sourceToolId: meta.source_tool_id as string | undefined,
    url: meta.url as string | undefined,
    files: Array.isArray(note.attachments)
      ? (note.attachments as Record<string, unknown>[]).map((a) => ({
          id: a.id as number,
          fileName: (a.original_filename || a.filename) as string,
          fileUrl: a.filename as string,
          fileType: (a.file_type as string) || '',
          fileSize: (a.file_size as number) || 0,
        }))
      : [],
    tags: Array.isArray(note.tags)
      ? (note.tags as { id: number; name: string; color: string }[])
      : [],
    metadata: meta,
    createdAt: (note.created_at as string) || '',
    updatedAt: (note.updated_at as string) || '',
  };
}

// ─── Analysis Seed Generator ─────────────────────────────

interface SeedConfig {
  agentId: AgentPersona['id'];
  title: string;
  color: string;
  field: string; // unique key to deduplicate against DB
  build: (a: AnalysisData) => string | null;
}

const SEED_CONFIGS: SeedConfig[] = [
  {
    agentId: 'mevzuat',
    title: 'Hukuki Ozet',
    color: 'indigo',
    field: 'seed-mevzuat',
    build: (a) => {
      const parts: string[] = [];
      if (a.ihale_usulu) parts.push(`**Ihale Usulu:** ${a.ihale_usulu}`);
      if (a.operasyonel_kurallar) {
        const ok = a.operasyonel_kurallar;
        if (ok.alt_yuklenici) parts.push(`**Alt Yuklenici:** ${ok.alt_yuklenici}`);
        if (ok.personel_kurallari?.length)
          parts.push(
            `**Personel Kurallari:**\n${ok.personel_kurallari.map((r) => `- ${r}`).join('\n')}`
          );
        if (ok.yemek_kurallari?.length)
          parts.push(`**Yemek Kurallari:**\n${ok.yemek_kurallari.map((r) => `- ${r}`).join('\n')}`);
        if (ok.muayene_kabul) parts.push(`**Muayene Kabul:** ${ok.muayene_kabul}`);
        if (ok.denetim) parts.push(`**Denetim:** ${ok.denetim}`);
      }
      if (a.ceza_kosullari?.length)
        parts.push(
          `**Ceza Kosullari:**\n${a.ceza_kosullari.map((c) => `- ${c.tur}: ${c.oran}${c.aciklama ? ` (${c.aciklama})` : ''}`).join('\n')}`
        );
      if (a.gerekli_belgeler?.length)
        parts.push(
          `**Gerekli Belgeler:**\n${a.gerekli_belgeler.map((b) => `- ${b.belge}${b.zorunlu ? ' (Zorunlu)' : ''}${b.puan ? ` [${b.puan} puan]` : ''}`).join('\n')}`
        );
      if (a.is_artisi) {
        const ia = a.is_artisi;
        if (ia.oran) parts.push(`**Is Artisi Orani:** ${ia.oran}`);
        if (ia.kosullar) parts.push(`**Is Artisi Kosullari:** ${ia.kosullar}`);
      }
      if (a.fiyat_farki) {
        const ff = a.fiyat_farki;
        const ffParts: string[] = [];
        if (ff.formul) ffParts.push(`Formul: ${ff.formul}`);
        if (ff.katsayilar) {
          const ks = Object.entries(ff.katsayilar)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');
          if (ks) ffParts.push(`Katsayilar: ${ks}`);
        }
        if (ffParts.length) parts.push(`**Fiyat Farki:** ${ffParts.join(' | ')}`);
      }
      return parts.length > 0 ? parts.join('\n\n') : null;
    },
  },
  {
    agentId: 'maliyet',
    title: 'Finansal Ozet',
    color: 'green',
    field: 'seed-maliyet',
    build: (a) => {
      const parts: string[] = [];
      if (a.tahmini_bedel) parts.push(`**Tahmini Bedel:** ${a.tahmini_bedel}`);
      if (a.iscilik_orani) parts.push(`**Iscilik Orani:** ${a.iscilik_orani}`);
      if (a.birim_fiyat_cetveli) parts.push(`**Birim Fiyat Cetveli:** ${a.birim_fiyat_cetveli}`);
      if (a.birim_fiyatlar?.length)
        parts.push(
          `**Birim Fiyatlar:**\n${a.birim_fiyatlar.map((b) => `- ${b.kalem || b.aciklama || ''}: ${b.fiyat || b.tutar || ''}`).join('\n')}`
        );
      if (a.mali_kriterler) {
        const mk = a.mali_kriterler;
        const mkParts: string[] = [];
        if (mk.cari_oran) mkParts.push(`Cari Oran: ${mk.cari_oran}`);
        if (mk.is_deneyimi) mkParts.push(`Is Deneyimi: ${mk.is_deneyimi}`);
        if (mk.ciro_orani) mkParts.push(`Ciro Orani: ${mk.ciro_orani}`);
        if (mk.ozkaynak_orani) mkParts.push(`Ozkaynak: ${mk.ozkaynak_orani}`);
        if (mkParts.length)
          parts.push(`**Mali Kriterler:**\n${mkParts.map((p) => `- ${p}`).join('\n')}`);
      }
      if (a.teminat_oranlari) {
        const to = a.teminat_oranlari;
        const toParts: string[] = [];
        if (to.gecici) toParts.push(`Gecici: ${to.gecici}`);
        if (to.kesin) toParts.push(`Kesin: ${to.kesin}`);
        if (to.ek_kesin) toParts.push(`Ek Kesin: ${to.ek_kesin}`);
        if (toParts.length) parts.push(`**Teminat Oranlari:** ${toParts.join(' | ')}`);
      }
      if (a.odeme_kosullari) {
        const ok = a.odeme_kosullari;
        const okParts: string[] = [];
        if (ok.odeme_periyodu) okParts.push(`Periyot: ${ok.odeme_periyodu}`);
        if (ok.hakedis_suresi) okParts.push(`Hakedis: ${ok.hakedis_suresi}`);
        if (ok.odeme_suresi) okParts.push(`Odeme Suresi: ${ok.odeme_suresi}`);
        if (ok.avans) okParts.push(`Avans: ${ok.avans}`);
        if (okParts.length)
          parts.push(`**Odeme Kosullari:**\n${okParts.map((p) => `- ${p}`).join('\n')}`);
      }
      return parts.length > 0 ? parts.join('\n\n') : null;
    },
  },
  {
    agentId: 'teknik',
    title: 'Teknik Ozet',
    color: 'yellow',
    field: 'seed-teknik',
    build: (a) => {
      const parts: string[] = [];
      if (a.teknik_sartlar?.length) {
        const items = a.teknik_sartlar.map((t) => (typeof t === 'string' ? t : t.text));
        parts.push(`**Teknik Sartlar:**\n${items.map((i) => `- ${i}`).join('\n')}`);
      }
      if (a.personel_detaylari?.length)
        parts.push(
          `**Personel Detaylari:**\n${a.personel_detaylari.map((p) => `- ${p.pozisyon}: ${p.adet} kisi${p.ucret_orani ? ` (${p.ucret_orani})` : ''}`).join('\n')}`
        );
      if (a.ogun_bilgileri?.length)
        parts.push(
          `**Ogun Bilgileri:**\n${a.ogun_bilgileri.map((o) => `- ${o.tur || 'Ogun'}: ${o.miktar || '?'} ${o.birim || 'adet'}`).join('\n')}`
        );
      if (a.servis_saatleri) {
        const ss = a.servis_saatleri;
        const ssParts: string[] = [];
        if (ss.kahvalti) ssParts.push(`Kahvalti: ${ss.kahvalti}`);
        if (ss.ogle) ssParts.push(`Ogle: ${ss.ogle}`);
        if (ss.aksam) ssParts.push(`Aksam: ${ss.aksam}`);
        if (ssParts.length) parts.push(`**Servis Saatleri:** ${ssParts.join(' | ')}`);
      }
      if (a.ekipman_listesi) parts.push(`**Ekipman:** ${a.ekipman_listesi}`);
      if (a.kalite_standartlari) parts.push(`**Kalite Standartlari:** ${a.kalite_standartlari}`);
      if (a.sure) parts.push(`**Sure:** ${a.sure}`);
      return parts.length > 0 ? parts.join('\n\n') : null;
    },
  },
  {
    agentId: 'rekabet',
    title: 'Rekabet Ozeti',
    color: 'pink',
    field: 'seed-rekabet',
    build: (a) => {
      const parts: string[] = [];
      if (a.sinir_deger_katsayisi)
        parts.push(`**Sinir Deger Katsayisi:** ${a.sinir_deger_katsayisi}`);
      if (a.benzer_is_tanimi) parts.push(`**Benzer Is Tanimi:** ${a.benzer_is_tanimi}`);
      if (a.kapasite_gereksinimi) parts.push(`**Kapasite Gereksinimi:** ${a.kapasite_gereksinimi}`);
      if (a.teklif_turu) parts.push(`**Teklif Turu:** ${a.teklif_turu}`);
      if (a.onemli_notlar?.length) {
        const items = a.onemli_notlar.map((n) => (typeof n === 'string' ? n : n.not));
        parts.push(`**Onemli Notlar:**\n${items.map((i) => `- ${i}`).join('\n')}`);
      }
      if (a.eksik_bilgiler?.length)
        parts.push(`**Eksik Bilgiler:**\n${a.eksik_bilgiler.map((e) => `- ${e}`).join('\n')}`);
      return parts.length > 0 ? parts.join('\n\n') : null;
    },
  },
];

function generateAnalysisSeeds(
  analysisSummary: AnalysisData | null | undefined
): OrbitAttachment[] {
  if (!analysisSummary) return [];

  const seeds: OrbitAttachment[] = [];
  const now = new Date().toISOString();

  for (const config of SEED_CONFIGS) {
    const content = config.build(analysisSummary);
    if (!content) continue;

    seeds.push({
      id: config.field, // seed-mevzuat, seed-maliyet, etc.
      title: config.title,
      type: 'ai_report',
      content,
      contentFormat: 'markdown',
      color: config.color,
      pinned: false,
      sourceAgent: config.agentId,
      files: [],
      tags: [],
      metadata: {
        attachment_type: 'ai_report',
        source: 'analysis_seed',
        analysis_field: config.field,
        source_agent: config.agentId,
      },
      createdAt: now,
      updatedAt: now,
      virtual: true,
    });
  }

  return seeds;
}

// ─── Position calculator ─────────────────────────────────

export function getNodePositions(count: number) {
  const { radiusX, radiusY, startAngle, maxVisibleNodes } = ORBIT_RING_CONFIG;
  const visible = Math.min(count, maxVisibleNodes);
  // +1 for the add button
  const total = visible + 1;
  const positions: { x: number; y: number; angle: number }[] = [];

  for (let i = 0; i < total; i++) {
    const angle = startAngle + (2 * Math.PI * i) / total;
    positions.push({
      x: Math.cos(angle) * radiusX,
      y: Math.sin(angle) * radiusY,
      angle,
    });
  }

  return positions;
}

// ─── Hook ────────────────────────────────────────────────

interface UseOrbitAttachmentsProps {
  tenderId: string | number | null;
  enabled: boolean;
  analysisSummary?: AnalysisData | null;
}

export function useOrbitAttachments({
  tenderId,
  enabled,
  analysisSummary,
}: UseOrbitAttachmentsProps) {
  const [attachments, setAttachments] = useState<OrbitAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailState, setDetailState] = useState<AttachmentDetailState>({
    attachmentId: null,
    mode: 'view',
  });
  const [compareNodes, setCompareNodes] = useState<[string, string] | null>(null);
  const [compareFirstId, setCompareFirstId] = useState<string | null>(null);

  // ── Fetch (merges DB attachments + virtual analysis seeds) ──
  const fetchAttachments = useCallback(async () => {
    if (!tenderId || !enabled) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ success: boolean; notes: Record<string, unknown>[] }>(
        `/notes/context/tender/${tenderId}`
      );
      if (data.success) {
        // Filter only notes that have attachment_type in metadata
        const orbitNotes = data.notes.filter((n) => {
          const meta = (n.metadata || {}) as Record<string, unknown>;
          return !!meta.attachment_type;
        });
        const dbAttachments = orbitNotes.map(mapNoteToAttachment);

        // Generate virtual seeds from analysis_summary
        const seeds = generateAnalysisSeeds(analysisSummary);
        // Filter out seeds that already have a saved DB counterpart
        const unseeded = seeds.filter(
          (seed) =>
            !dbAttachments.some((db) => db.metadata.analysis_field === seed.metadata.analysis_field)
        );

        setAttachments([...dbAttachments, ...unseeded]);
      }
    } catch {
      // silently fail — orbit ring just stays empty
    } finally {
      setLoading(false);
    }
  }, [tenderId, enabled, analysisSummary]);

  // ── Add ──
  const addAttachment = useCallback(
    async (input: {
      title: string;
      type: AttachmentType;
      content: string;
      contentFormat?: 'plain' | 'markdown';
      color?: string;
      url?: string;
      metadata?: Record<string, unknown>;
    }) => {
      if (!tenderId) return;
      const config = ATTACHMENT_TYPE_MAP[input.type];
      const body = {
        title: input.title,
        content: input.content,
        content_format: input.contentFormat || 'plain',
        color: input.color || config?.color || 'yellow',
        metadata: {
          attachment_type: input.type,
          source: 'manual',
          ...(input.url ? { url: input.url } : {}),
          ...(input.metadata || {}),
        },
      };

      try {
        const data = await apiFetch<{ success: boolean; note: Record<string, unknown> }>(
          `/notes/context/tender/${tenderId}`,
          { method: 'POST', body: JSON.stringify(body) }
        );
        if (data.success && data.note) {
          const newAttachment = mapNoteToAttachment(data.note);
          setAttachments((prev) => [...prev, newAttachment]);
          return newAttachment;
        }
      } catch {
        // handle error
      }
    },
    [tenderId]
  );

  // ── Update ──
  const updateAttachment = useCallback(
    async (
      id: string,
      updates: { title?: string; content?: string; pinned?: boolean; color?: string }
    ) => {
      try {
        const data = await apiFetch<{ success: boolean; note: Record<string, unknown> }>(
          `/notes/${id}`,
          { method: 'PUT', body: JSON.stringify(updates) }
        );
        if (data.success && data.note) {
          setAttachments((prev) =>
            prev.map((a) => (a.id === id ? mapNoteToAttachment(data.note) : a))
          );
        }
      } catch {
        // handle error
      }
    },
    []
  );

  // ── Delete ──
  const deleteAttachment = useCallback(async (id: string) => {
    try {
      const data = await apiFetch<{ success: boolean }>(`/notes/${id}`, { method: 'DELETE' });
      if (data.success) {
        setAttachments((prev) => prev.filter((a) => a.id !== id));
        setDetailState({ attachmentId: null, mode: 'view' });
      }
    } catch {
      // handle error
    }
  }, []);

  // ── Save Virtual (analysis seed → DB) ──
  const saveVirtualAttachment = useCallback(
    async (id: string) => {
      const virtual = attachments.find((a) => a.id === id && a.virtual);
      if (!virtual || !tenderId) return;

      const saved = await addAttachment({
        title: virtual.title,
        type: virtual.type,
        content: virtual.content,
        contentFormat: virtual.contentFormat,
        color: virtual.color,
        metadata: {
          ...virtual.metadata,
          source: 'analysis_saved',
        },
      });

      if (saved) {
        // Replace virtual with saved (real) version
        setAttachments((prev) => prev.map((a) => (a.id === id ? { ...saved, virtual: false } : a)));
      }
    },
    [attachments, tenderId, addAttachment]
  );

  // ── Agent Auto-Attach ──
  const addFromToolResult = useCallback(
    async (agentId: AgentPersona['id'], toolId: string, result: ToolResult) => {
      if (!tenderId) return;

      let type: AttachmentType;
      let title: string;
      let content: string;
      let contentFormat: 'plain' | 'markdown' = 'plain';

      switch (result.type) {
        case 'draft':
          type = 'petition';
          title = result.draftTitle || 'Zeyilname Taslagi';
          content = result.draftBody || '';
          break;
        case 'precedent':
          type = 'ai_report';
          title = 'Emsal Karar Raporu';
          content = result.citations
            ? result.citations
                .map((c) => `**${c.reference}** (${c.relevance})\n${c.summary}`)
                .join('\n\n---\n\n')
            : '';
          contentFormat = 'markdown';
          break;
        case 'redline':
          type = 'ai_report';
          title = 'Madde Redline Analizi';
          content = `**Orijinal:**\n${result.originalText}\n\n**Revize:**\n${result.revisedText}\n\n**Aciklama:**\n${result.explanation}`;
          contentFormat = 'markdown';
          break;
        default:
          type = 'ai_report';
          title = 'AI Analiz Sonucu';
          content = result.content || JSON.stringify(result);
          break;
      }

      return addAttachment({
        title,
        type,
        content,
        contentFormat,
        metadata: {
          source: 'agent',
          source_agent: agentId,
          source_tool_id: toolId,
        },
      });
    },
    [addAttachment, tenderId]
  );

  // ── Detail State ──
  const openDetail = useCallback((id: string) => {
    setDetailState({ attachmentId: id, mode: 'view' });
  }, []);

  const openEdit = useCallback((id: string) => {
    setDetailState({ attachmentId: id, mode: 'edit' });
  }, []);

  const openCreate = useCallback((createType?: AttachmentType) => {
    setDetailState({ attachmentId: null, mode: 'create', createType });
  }, []);

  const closeDetail = useCallback(() => {
    setDetailState({ attachmentId: null, mode: 'view' });
  }, []);

  // ── Compare ──
  const handleNodeClick = useCallback(
    (id: string, shiftKey: boolean) => {
      if (shiftKey && compareFirstId && compareFirstId !== id) {
        setCompareNodes([compareFirstId, id]);
        setCompareFirstId(null);
      } else if (shiftKey) {
        setCompareFirstId(id);
      } else {
        setCompareFirstId(null);
        openDetail(id);
      }
    },
    [compareFirstId, openDetail]
  );

  const endCompare = useCallback(() => {
    setCompareNodes(null);
    setCompareFirstId(null);
  }, []);

  // ── Node Positions ──
  const nodePositions = useMemo(() => getNodePositions(attachments.length), [attachments.length]);

  return {
    attachments,
    loading,
    detailState,
    nodePositions,
    compareNodes,
    compareFirstId,
    fetchAttachments,
    addAttachment,
    updateAttachment,
    deleteAttachment,
    saveVirtualAttachment,
    addFromToolResult,
    handleNodeClick,
    endCompare,
    openDetail,
    openEdit,
    openCreate,
    closeDetail,
  };
}
