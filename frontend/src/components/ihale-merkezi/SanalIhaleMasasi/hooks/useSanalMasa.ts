import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { aiAPI } from '@/lib/api/services/ai';
import type { AgentAnalysisResult } from '@/lib/api/services/ai';
import type { AnalysisData, SavedTender } from '../../types';
import { AGENTS } from '../constants';
import type {
  AgentAnalysis,
  AgentFinding,
  AgentHighlight,
  AgentPersona,
  ChecklistItem,
  CrossReference,
  SnippetDrop,
  VerdictData,
  ViewMode,
} from '../types';

// ─── Agent Weights for Verdict Scoring ───────────────────────

const AGENT_WEIGHTS: Record<AgentPersona['id'], number> = {
  mevzuat: 0.30,
  maliyet: 0.30,
  teknik: 0.25,
  rekabet: 0.15,
};

// ─── Backend Result → Frontend AgentAnalysis Mapper ──────────

function mapBackendToAgentAnalysis(agentId: AgentPersona['id'], result: AgentAnalysisResult): AgentAnalysis {
  let status: AgentAnalysis['status'] = result.status === 'complete' ? 'complete' : 'analyzing';
  if (result.status === 'error') status = 'no-data';
  if (result.status === 'complete') {
    if (result.findings.length === 0) status = 'no-data';
    else if (result.riskScore < 40) status = 'critical';
    else if (result.riskScore < 60) status = 'warning';
  }

  return {
    agentId,
    status,
    findings: result.findings.map((f) => ({
      label: f.label,
      value: f.value,
      severity: f.severity,
      confidence: f.confidence,
      reasoning: f.reasoning,
    })),
    riskScore: result.riskScore,
    summary: result.summary || (result.findings[0] ? `${result.findings[0].label}: ${result.findings[0].value}` : 'Analiz tamamlandi'),
  };
}

function createAnalyzingState(): AgentAnalysis[] {
  return AGENTS.map((agent) => ({
    agentId: agent.id,
    status: 'analyzing' as const,
    findings: [],
    riskScore: 0,
    summary: 'AI analiz ediliyor...',
  }));
}

function createNoDataState(): AgentAnalysis[] {
  return AGENTS.map((agent) => ({
    agentId: agent.id,
    status: 'no-data' as const,
    findings: [],
    riskScore: 0,
    summary: 'Analiz verisi bulunamadi',
  }));
}

// ─── Verdict Generation (Faz 6'da AI ile degisecek) ──────────

function generateVerdict(analyses: AgentAnalysis[], data?: AnalysisData | null): VerdictData {
  const validScores = analyses.filter((a) => a.status !== 'no-data' && a.status !== 'analyzing');

  let overallScore = 0;
  if (validScores.length > 0) {
    let totalWeight = 0;
    let weightedSum = 0;
    for (const a of validScores) {
      const w = AGENT_WEIGHTS[a.agentId] ?? 0.25;
      weightedSum += a.riskScore * w;
      totalWeight += w;
    }
    overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  }

  let recommendation: VerdictData['recommendation'];
  let recommendationLabel: string;

  if (overallScore >= 70) {
    recommendation = 'gir';
    recommendationLabel = 'Ihaleye Girilebilir';
  } else if (overallScore >= 45) {
    recommendation = 'dikkat';
    recommendationLabel = 'Dikkatli Degerlendirme Gerekli';
  } else {
    recommendation = 'girme';
    recommendationLabel = 'Yuksek Risk — Onerilmez';
  }

  const checklist = data ? generateChecklist(data, analyses) : [];

  return {
    overallScore,
    recommendation,
    recommendationLabel,
    agents: analyses,
    generatedAt: new Date().toISOString(),
    weights: { ...AGENT_WEIGHTS },
    checklist,
  };
}

// ─── Checklist Generation (Faz 6'da AI ile degisecek) ────────

function generateChecklist(data: AnalysisData, analyses: AgentAnalysis[]): ChecklistItem[] {
  const items: ChecklistItem[] = [];

  items.push({
    id: 'bedel',
    label: 'Tahmini bedel bilgisi mevcut',
    status: data.tahmini_bedel ? 'pass' : 'fail',
    detail: data.tahmini_bedel || 'Bedel bilgisi eksik',
    severity: 'critical',
  });

  const belgeSayisi = data.gerekli_belgeler?.length ?? 0;
  items.push({
    id: 'belgeler',
    label: 'Gerekli belgeler tanimli',
    status: belgeSayisi > 0 ? 'pass' : 'fail',
    detail: belgeSayisi > 0 ? `${belgeSayisi} belge` : 'Belge listesi yok',
    severity: 'critical',
  });

  const personelVar = (data.personel_detaylari?.length ?? 0) > 0 || !!data.kisi_sayisi;
  items.push({
    id: 'personel',
    label: 'Personel gereksinimleri belirli',
    status: personelVar ? 'pass' : 'unknown',
    detail: personelVar
      ? `${data.personel_detaylari?.reduce((s, p) => s + p.adet, 0) ?? data.kisi_sayisi} kisi`
      : 'Personel detaylari belirtilmemis',
    severity: 'warning',
  });

  const maliVar = !!(data.mali_kriterler?.cari_oran || data.mali_kriterler?.ozkaynak_orani || data.mali_kriterler?.is_deneyimi);
  items.push({
    id: 'mali_kriter',
    label: 'Mali yeterlilik kriterleri mevcut',
    status: maliVar ? 'pass' : 'fail',
    detail: maliVar ? 'Kriterler tanimli' : 'Mali kriterler eksik',
    severity: 'critical',
  });

  items.push({
    id: 'benzer_is',
    label: 'Benzer is tanimi mevcut',
    status: data.benzer_is_tanimi ? 'pass' : 'fail',
    detail: data.benzer_is_tanimi || 'Benzer is tanimi bulunamadi',
    severity: 'critical',
  });

  items.push({
    id: 'sure',
    label: 'Sozlesme suresi belirli',
    status: (data.sure || data.teslim_suresi) ? 'pass' : 'unknown',
    detail: data.sure || data.teslim_suresi || 'Sure bilgisi yok',
    severity: 'warning',
  });

  const cezaSayisi = data.ceza_kosullari?.length ?? 0;
  items.push({
    id: 'ceza',
    label: 'Ceza kosullari makul duzeyde',
    status: cezaSayisi === 0 ? 'unknown' : cezaSayisi <= 3 ? 'pass' : 'fail',
    detail: cezaSayisi > 0 ? `${cezaSayisi} ceza maddesi` : 'Ceza kosullari belirsiz',
    severity: cezaSayisi > 3 ? 'warning' : 'info',
  });

  items.push({
    id: 'fiyat_farki',
    label: 'Fiyat farki formulu tanimli',
    status: data.fiyat_farki?.formul ? 'pass' : 'unknown',
    detail: data.fiyat_farki?.formul || 'Fiyat farki bilgisi yok',
    severity: 'info',
  });

  items.push({
    id: 'is_artisi',
    label: 'Is artisi maddesi mevcut',
    status: data.is_artisi?.oran ? 'pass' : 'fail',
    detail: data.is_artisi?.oran || 'Is artisi maddesi bulunamadi',
    severity: 'warning',
  });

  const criticalAgents = analyses.filter((a) => a.riskScore < 40 && a.status === 'complete');
  items.push({
    id: 'agent_risk',
    label: 'Tum ajanlarda kabul edilebilir risk',
    status: criticalAgents.length === 0 ? 'pass' : 'fail',
    detail: criticalAgents.length > 0
      ? `${criticalAgents.map((a) => AGENTS.find((ag) => ag.id === a.agentId)?.name).join(', ')} kritik`
      : 'Tum ajanlar kabul edilebilir',
    severity: 'critical',
  });

  return items;
}

// ─── Agent Highlight Generation ──────────────────────────────

function generateAgentHighlights(data: AnalysisData | undefined, analyses: AgentAnalysis[]): AgentHighlight[] {
  if (!data?.tam_metin) return [];
  const tamMetin = data.tam_metin.toLowerCase();
  const highlights: AgentHighlight[] = [];

  for (const analysis of analyses) {
    const agent = AGENTS.find((a) => a.id === analysis.agentId);
    if (!agent) continue;

    for (const finding of analysis.findings) {
      if (!finding.severity || finding.severity === 'info') continue;

      const searchTerms = extractSearchTerms(finding);
      for (const term of searchTerms) {
        if (term.length < 4) continue;
        const lowerTerm = term.toLowerCase();
        if (tamMetin.includes(lowerTerm)) {
          const idx = data.tam_metin!.toLowerCase().indexOf(lowerTerm);
          if (idx !== -1) {
            highlights.push({
              agentId: agent.id,
              text: data.tam_metin!.substring(idx, idx + term.length),
              color: agent.color,
              finding: finding.label,
            });
          }
          break;
        }
      }
    }
  }

  return highlights;
}

// ─── Cross-Reference Generation (Faz 6'da AI ile degisecek) ──

function generateCrossReferences(data: AnalysisData | null | undefined): CrossReference[] {
  if (!data) return [];
  const refs: CrossReference[] = [];

  if (data.ceza_kosullari?.length && data.ceza_kosullari.length > 2) {
    refs.push({
      fromAgentId: 'mevzuat',
      toAgentId: 'maliyet',
      fromFinding: 'Ceza Kosullari',
      impact: `${data.ceza_kosullari.length} ceza maddesi maliyet riskini artiriyor`,
      severity: data.ceza_kosullari.length > 4 ? 'critical' : 'warning',
    });
  }

  if (data.personel_detaylari?.length) {
    const toplamPersonel = data.personel_detaylari.reduce((s, p) => s + p.adet, 0);
    if (toplamPersonel > 20) {
      refs.push({
        fromAgentId: 'teknik',
        toAgentId: 'maliyet',
        fromFinding: 'Personel Ihtiyaci',
        impact: `${toplamPersonel} personel maliyeti butceyi onemli olcude etkiler`,
        severity: 'warning',
      });
    }
  }

  if (!data.benzer_is_tanimi) {
    refs.push({
      fromAgentId: 'rekabet',
      toAgentId: 'mevzuat',
      fromFinding: 'Benzer Is',
      impact: 'Benzer is tanimi olmadan yeterlilik degerlendirmesi yapilamaz',
      severity: 'critical',
    });
  }

  if (!data.mali_kriterler?.cari_oran && !data.mali_kriterler?.is_deneyimi) {
    refs.push({
      fromAgentId: 'maliyet',
      toAgentId: 'rekabet',
      fromFinding: 'Mali Kriterler',
      impact: 'Mali yeterlilik kriterleri belirsiz — teklif stratejisi riskli',
      severity: 'warning',
    });
  }

  if (data.fiyat_farki?.formul) {
    refs.push({
      fromAgentId: 'mevzuat',
      toAgentId: 'maliyet',
      fromFinding: 'Fiyat Farki',
      impact: `Fiyat farki formulu maliyet projeksiyonunu etkiler: ${data.fiyat_farki.formul}`,
      severity: 'info',
    });
  }

  if (data.teknik_sartlar && data.teknik_sartlar.length > 15) {
    refs.push({
      fromAgentId: 'teknik',
      toAgentId: 'maliyet',
      fromFinding: 'Teknik Sartlar',
      impact: `${data.teknik_sartlar.length} teknik sart — uyum maliyeti yuksek olabilir`,
      severity: 'warning',
    });
  }

  return refs;
}

function extractSearchTerms(finding: AgentFinding): string[] {
  const terms: string[] = [];
  if (finding.value && finding.value.length > 4 && finding.value.length < 100) {
    terms.push(finding.value);
  }
  const quoted = finding.value?.match(/"([^"]+)"/g);
  if (quoted) {
    for (const q of quoted) terms.push(q.replace(/"/g, ''));
  }
  if (finding.label && finding.label.length > 4) {
    terms.push(finding.label);
  }
  return terms;
}

// ─── Hook ────────────────────────────────────────────────────

export function useSanalMasa(tender: SavedTender) {
  const [viewMode, setViewMode] = useState<ViewMode>('ORBIT');
  const [focusedAgentId, setFocusedAgentId] = useState<string | null>(null);
  const [verdictData, setVerdictData] = useState<VerdictData | null>(null);
  const [snippetDrops, setSnippetDrops] = useState<SnippetDrop[]>([]);
  const [agentAnalyses, setAgentAnalyses] = useState<AgentAnalysis[]>(createAnalyzingState);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Track tender ID to avoid duplicate calls
  const analyzedTenderRef = useRef<number | null>(null);

  // ─── AI Analysis: Load from cache or trigger new analysis ──
  useEffect(() => {
    const rawId = tender?.tender_id ?? tender?.id;
    const tenderId = typeof rawId === 'string' ? Number.parseInt(rawId, 10) : rawId;
    if (!tenderId || Number.isNaN(tenderId)) return;
    if (analyzedTenderRef.current === tenderId) return;
    analyzedTenderRef.current = tenderId;

    (async () => {
      setIsAnalyzing(true);
      setAgentAnalyses(createAnalyzingState());

      try {
        // 1. Try cache first
        const cacheResponse = await aiAPI.getCachedAgentAnalyses(tenderId);

        if (cacheResponse.success && cacheResponse.data?.analyses) {
          const cached = cacheResponse.data.analyses;
          setAgentAnalyses(
            AGENTS.map((agent) => {
              const result = cached[agent.id];
              return result
                ? mapBackendToAgentAnalysis(agent.id, result)
                : { agentId: agent.id, status: 'no-data' as const, findings: [], riskScore: 0, summary: 'Analiz yapilmamis' };
            }),
          );
          setIsAnalyzing(false);
          return;
        }

        // 2. No cache — full AI analysis
        const response = await aiAPI.analyzeAllAgents(tenderId);

        if (response.success && response.data?.analyses) {
          const results = response.data.analyses;
          setAgentAnalyses(
            AGENTS.map((agent) => {
              const result = results[agent.id];
              return result
                ? mapBackendToAgentAnalysis(agent.id, result)
                : { agentId: agent.id, status: 'no-data' as const, findings: [], riskScore: 0, summary: 'Analiz tamamlanamadi' };
            }),
          );
        } else {
          setAgentAnalyses(createNoDataState());
        }
      } catch {
        setAgentAnalyses(createNoDataState());
      } finally {
        setIsAnalyzing(false);
      }
    })();
  }, [tender?.id, tender?.tender_id]);

  // ─── Re-analyze single agent ──────────────────────────────
  const reanalyzeAgent = useCallback(async (agentId: string) => {
    const rawId = tender?.tender_id ?? tender?.id;
    const tenderId = typeof rawId === 'string' ? Number.parseInt(rawId, 10) : rawId;
    if (!tenderId || Number.isNaN(tenderId)) return;

    // Set this agent to analyzing
    setAgentAnalyses((prev) =>
      prev.map((a) => a.agentId === agentId ? { ...a, status: 'analyzing' as const, findings: [], riskScore: 0, summary: 'Yeniden analiz ediliyor...' } : a),
    );

    try {
      // Agent'a atanan snippet'leri ek context olarak gönder
      const agentSnippetTexts = snippetDrops
        .filter((s) => s.agentId === agentId)
        .map((s) => s.text);

      const additionalContext = agentSnippetTexts.length > 0
        ? { snippets: agentSnippetTexts }
        : undefined;

      const response = await aiAPI.analyzeSingleAgent(tenderId, agentId, true, additionalContext);
      if (response.success && response.data?.analysis) {
        const result = response.data.analysis;
        setAgentAnalyses((prev) =>
          prev.map((a) => a.agentId === agentId ? mapBackendToAgentAnalysis(agentId as AgentPersona['id'], result) : a),
        );
      }
    } catch {
      setAgentAnalyses((prev) =>
        prev.map((a) => a.agentId === agentId ? { ...a, status: 'no-data' as const, summary: 'Analiz hatasi' } : a),
      );
    }
  }, [tender?.id, tender?.tender_id, snippetDrops]);

  // ─── Derived computations ─────────────────────────────────

  const agentHighlights = useMemo(
    () => generateAgentHighlights(tender?.analysis_summary ?? undefined, agentAnalyses),
    [tender?.analysis_summary, agentAnalyses],
  );

  const crossReferences = useMemo(
    () => generateCrossReferences(tender?.analysis_summary ?? null),
    [tender?.analysis_summary],
  );

  // ─── Actions ──────────────────────────────────────────────

  const handleAgentClick = useCallback((agentId: string) => {
    setFocusedAgentId(agentId);
    setViewMode('FOCUS');
  }, []);

  const handleBackToOrbit = useCallback(() => {
    setFocusedAgentId(null);
    setViewMode('ORBIT');
  }, []);

  const [verdictLoading, setVerdictLoading] = useState(false);

  const handleAssemble = useCallback(async () => {
    setViewMode('ASSEMBLE');
    // Hemen kural-bazlı fallback verdict göster
    setVerdictData(generateVerdict(agentAnalyses, tender?.analysis_summary));

    // Arka planda AI verdict üret
    const rawId = tender?.tender_id ?? tender?.id;
    const tenderId = typeof rawId === 'string' ? Number.parseInt(rawId, 10) : rawId;
    if (!tenderId || Number.isNaN(tenderId)) return;

    // Completed analizleri backend formatına dönüştür
    const completedAnalyses: Record<string, { riskScore: number; summary: string; findings: AgentAnalysis['findings']; keyRisks?: string[]; recommendations?: string[] }> = {};
    for (const a of agentAnalyses) {
      if (a.status !== 'no-data' && a.status !== 'analyzing') {
        completedAnalyses[a.agentId] = {
          riskScore: a.riskScore,
          summary: a.summary,
          findings: a.findings,
        };
      }
    }

    if (Object.keys(completedAnalyses).length === 0) return;

    setVerdictLoading(true);
    try {
      const vResp = await aiAPI.generateAIVerdict(tenderId, completedAnalyses as Record<string, AgentAnalysisResult>);
      if (vResp.success && vResp.data?.verdict) {
        const v = vResp.data.verdict;
        setVerdictData({
          overallScore: v.overallScore,
          recommendation: v.recommendation,
          recommendationLabel: v.recommendationLabel,
          agents: agentAnalyses,
          generatedAt: v.generatedAt,
          weights: { ...AGENT_WEIGHTS },
          checklist: v.checklist.map((c) => ({
            id: c.id,
            label: c.label,
            status: c.status,
            detail: c.detail,
            severity: c.severity,
          })),
          reasoning: v.reasoning,
          strategicNotes: v.strategicNotes,
          generatedBy: 'ai',
        });
      }
    } catch {
      // Fallback zaten set edildi, AI başarısız olsa da kural-bazlı verdict görünür
    } finally {
      setVerdictLoading(false);
    }
  }, [agentAnalyses, tender?.analysis_summary, tender?.id, tender?.tender_id]);

  const handleReset = useCallback(() => {
    setViewMode('ORBIT');
    setVerdictData(null);
    setFocusedAgentId(null);
  }, []);

  const handleSnippetDrop = useCallback((agentId: string, text: string) => {
    setSnippetDrops((prev) => [
      ...prev,
      { agentId: agentId as AgentPersona['id'], text, timestamp: new Date().toISOString() },
    ]);
  }, []);

  const focusedAgent = focusedAgentId ? AGENTS.find((a) => a.id === focusedAgentId) ?? null : null;
  const focusedAnalysis = focusedAgentId
    ? agentAnalyses.find((a) => a.agentId === focusedAgentId) ?? null
    : null;

  return {
    viewMode,
    focusedAgent,
    focusedAnalysis,
    verdictData,
    verdictLoading,
    agentAnalyses,
    agentHighlights,
    crossReferences,
    snippetDrops,
    isAnalyzing,
    handleAgentClick,
    handleBackToOrbit,
    handleAssemble,
    handleReset,
    handleSnippetDrop,
    reanalyzeAgent,
  };
}
