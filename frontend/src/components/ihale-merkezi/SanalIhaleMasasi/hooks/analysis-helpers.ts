/**
 * Analysis Helpers — Pure mapping/factory functions for agent analyses.
 * No React dependencies, fully testable.
 */

import type { AgentAnalysisResult } from '@/lib/api/services/ai';
import type { AnalysisData, SavedTender } from '../../types';
import { AGENTS } from '../constants';
import type { AgentAnalysis, AgentFinding, AgentHighlight, AgentPersona } from '../types';

// ─── Backend → Frontend Mapper ──────────────────────────────

export function mapBackendToAgentAnalysis(agentId: AgentPersona['id'], result: AgentAnalysisResult): AgentAnalysis {
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
    summary:
      result.summary ||
      (result.findings[0] ? `${result.findings[0].label}: ${result.findings[0].value}` : 'Analiz tamamlandi'),
  };
}

// ─── State Factories ────────────────────────────────────────

export function createAnalyzingState(): AgentAnalysis[] {
  return AGENTS.map((agent) => ({
    agentId: agent.id,
    status: 'analyzing' as const,
    findings: [],
    riskScore: 0,
    summary: 'AI analiz ediliyor...',
  }));
}

export function createNoDataState(): AgentAnalysis[] {
  return AGENTS.map((agent) => ({
    agentId: agent.id,
    status: 'no-data' as const,
    findings: [],
    riskScore: 0,
    summary: 'Analiz verisi bulunamadi',
  }));
}

export function createNoDataAnalysis(agentId: AgentPersona['id'], summary: string): AgentAnalysis {
  return { agentId, status: 'no-data', findings: [], riskScore: 0, summary };
}

// ─── ID Parser ──────────────────────────────────────────────

export function parseTenderId(tender: SavedTender): number | null {
  const rawId = tender?.tender_id ?? tender?.id;
  const id = typeof rawId === 'string' ? Number.parseInt(rawId, 10) : rawId;
  return id && !Number.isNaN(id) ? id : null;
}

// ─── Highlight Generation ───────────────────────────────────

export function generateAgentHighlights(data: AnalysisData | undefined, analyses: AgentAnalysis[]): AgentHighlight[] {
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
          const idx = tamMetin.indexOf(lowerTerm);
          if (idx !== -1) {
            highlights.push({
              agentId: agent.id,
              text: (data.tam_metin ?? '').substring(idx, idx + term.length),
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

// ─── Search Term Extraction ─────────────────────────────────

export function extractSearchTerms(finding: AgentFinding): string[] {
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
