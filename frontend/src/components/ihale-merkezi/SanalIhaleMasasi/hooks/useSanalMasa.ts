import { notifications } from '@mantine/notifications';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AgentAnalysisResult } from '@/lib/api/services/ai';
import { aiAPI } from '@/lib/api/services/ai';
import type { SavedTender } from '../../types';
import { AGENTS } from '../constants';
import type { AgentAnalysis, AgentPersona, SnippetDrop, VerdictData, ViewMode } from '../types';
import {
  createAnalyzingState,
  createNoDataAnalysis,
  createNoDataState,
  generateAgentHighlights,
  mapBackendToAgentAnalysis,
  parseTenderId,
} from './analysis-helpers';
import { AGENT_WEIGHTS, generateCrossReferences, generateVerdict } from './verdict-engine';

// ─── Hook ────────────────────────────────────────────────────

export function useSanalMasa(tender: SavedTender) {
  const [viewMode, setViewMode] = useState<ViewMode>('ORBIT');
  const [focusedAgentId, setFocusedAgentId] = useState<string | null>(null);
  const [verdictData, setVerdictData] = useState<VerdictData | null>(null);
  const [snippetDrops, setSnippetDrops] = useState<SnippetDrop[]>([]);
  const [agentAnalyses, setAgentAnalyses] = useState<AgentAnalysis[]>(createAnalyzingState);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [verdictLoading, setVerdictLoading] = useState(false);
  const [teklifModalOpen, setTeklifModalOpen] = useState(false);

  // Track tender ID to avoid duplicate calls
  const analyzedTenderRef = useRef<number | null>(null);

  // ─── AI Analysis: Load from cache or trigger new analysis ──
  useEffect(() => {
    const tenderId = parseTenderId(tender);
    if (!tenderId) return;
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
                : createNoDataAnalysis(agent.id, 'Analiz yapilmamis');
            })
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
                : createNoDataAnalysis(agent.id, 'Analiz tamamlanamadi');
            })
          );
        } else {
          setAgentAnalyses(createNoDataState());
        }
      } catch (err) {
        setAgentAnalyses(createNoDataState());
        notifications.show({
          title: 'Analiz Hatasi',
          message:
            err instanceof Error ? err.message : 'Ajan analizleri yuklenirken bir hata olustu. Lutfen tekrar deneyin.',
          color: 'red',
          autoClose: 8000,
        });
      } finally {
        setIsAnalyzing(false);
      }
    })();
  }, [tender]);

  // ─── Re-analyze single agent ──────────────────────────────
  const reanalyzeAgent = useCallback(
    async (agentId: string) => {
      const tenderId = parseTenderId(tender);
      if (!tenderId) return;

      setAgentAnalyses((prev) =>
        prev.map((a) =>
          a.agentId === agentId
            ? { ...a, status: 'analyzing' as const, findings: [], riskScore: 0, summary: 'Yeniden analiz ediliyor...' }
            : a
        )
      );

      try {
        const agentSnippetTexts = snippetDrops.filter((s) => s.agentId === agentId).map((s) => s.text);

        const additionalContext = agentSnippetTexts.length > 0 ? { snippets: agentSnippetTexts } : undefined;

        const response = await aiAPI.analyzeSingleAgent(tenderId, agentId, true, additionalContext);
        if (response.success && response.data?.analysis) {
          const result = response.data.analysis;
          setAgentAnalyses((prev) =>
            prev.map((a) =>
              a.agentId === agentId ? mapBackendToAgentAnalysis(agentId as AgentPersona['id'], result) : a
            )
          );
        }
      } catch (err) {
        setAgentAnalyses((prev) =>
          prev.map((a) => (a.agentId === agentId ? { ...a, status: 'no-data' as const, summary: 'Analiz hatasi' } : a))
        );
        notifications.show({
          title: 'Ajan Analiz Hatasi',
          message: err instanceof Error ? err.message : `${agentId} ajani yeniden analiz edilirken hata olustu.`,
          color: 'red',
          autoClose: 6000,
        });
      }
    },
    [tender, snippetDrops]
  );

  // ─── Derived computations ─────────────────────────────────

  const agentHighlights = useMemo(
    () => generateAgentHighlights(tender?.analysis_summary ?? undefined, agentAnalyses),
    [tender?.analysis_summary, agentAnalyses]
  );

  const crossReferences = useMemo(
    () => generateCrossReferences(tender?.analysis_summary ?? null),
    [tender?.analysis_summary]
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

  const handleAssemble = useCallback(async () => {
    setViewMode('ASSEMBLE');
    // Rule-based fallback verdict immediately
    setVerdictData(generateVerdict(agentAnalyses, tender?.analysis_summary));

    // Background AI verdict
    const tenderId = parseTenderId(tender);
    if (!tenderId) return;

    const completedAnalyses: Record<
      string,
      {
        riskScore: number;
        summary: string;
        findings: AgentAnalysis['findings'];
        keyRisks?: string[];
        recommendations?: string[];
      }
    > = {};
    for (const a of agentAnalyses) {
      if (a.status !== 'no-data' && a.status !== 'analyzing') {
        completedAnalyses[a.agentId] = { riskScore: a.riskScore, summary: a.summary, findings: a.findings };
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
    } catch (err) {
      // Fallback rule-based verdict already set above
      notifications.show({
        title: 'AI Verdict Hatasi',
        message:
          err instanceof Error ? err.message : 'AI karar raporu olusturulamadi, kural tabanli sonuc gosteriliyor.',
        color: 'yellow',
        autoClose: 6000,
      });
    } finally {
      setVerdictLoading(false);
    }
  }, [agentAnalyses, tender]);

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

  const handleOpenTeklif = useCallback(() => setTeklifModalOpen(true), []);
  const handleCloseTeklif = useCallback(() => setTeklifModalOpen(false), []);

  const focusedAgent = focusedAgentId ? (AGENTS.find((a) => a.id === focusedAgentId) ?? null) : null;
  const focusedAnalysis = focusedAgentId ? (agentAnalyses.find((a) => a.agentId === focusedAgentId) ?? null) : null;

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
    teklifModalOpen,
    handleAgentClick,
    handleBackToOrbit,
    handleAssemble,
    handleReset,
    handleSnippetDrop,
    reanalyzeAgent,
    handleOpenTeklif,
    handleCloseTeklif,
  };
}
