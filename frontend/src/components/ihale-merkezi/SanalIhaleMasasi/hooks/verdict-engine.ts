/**
 * Verdict Engine — Pure functions for generating verdicts, checklists, and cross-references.
 * No React dependencies, fully testable.
 */

import type { AnalysisData } from '../../types';
import { AGENTS } from '../constants';
import type { AgentAnalysis, AgentPersona, ChecklistItem, CrossReference, VerdictData } from '../types';

// ─── Agent Weights for Verdict Scoring ───────────────────────

export const AGENT_WEIGHTS: Record<AgentPersona['id'], number> = {
  mevzuat: 0.3,
  maliyet: 0.3,
  teknik: 0.25,
  rekabet: 0.15,
};

// ─── Verdict Generation ──────────────────────────────────────

export function generateVerdict(analyses: AgentAnalysis[], data?: AnalysisData | null): VerdictData {
  const validScores = analyses.filter((a) => a.status !== 'no-data' && a.status !== 'analyzing');

  let overallScore = 0;
  if (validScores.length > 0) {
    let totalWeight = 0;
    let weightedSum = 0;
    for (const a of validScores) {
      const score = Number.isFinite(a.riskScore) ? a.riskScore : 0;
      const w = AGENT_WEIGHTS[a.agentId] ?? 0.25;
      weightedSum += score * w;
      totalWeight += w;
    }
    const raw = totalWeight > 0 ? weightedSum / totalWeight : 0;
    overallScore = Number.isFinite(raw) ? Math.round(raw) : 0;
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

// ─── Checklist Generation ────────────────────────────────────

export function generateChecklist(data: AnalysisData, analyses: AgentAnalysis[]): ChecklistItem[] {
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

  const maliVar = !!(
    data.mali_kriterler?.cari_oran ||
    data.mali_kriterler?.ozkaynak_orani ||
    data.mali_kriterler?.is_deneyimi
  );
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
    status: data.sure || data.teslim_suresi ? 'pass' : 'unknown',
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
    detail:
      criticalAgents.length > 0
        ? `${criticalAgents.map((a) => AGENTS.find((ag) => ag.id === a.agentId)?.name).join(', ')} kritik`
        : 'Tum ajanlar kabul edilebilir',
    severity: 'critical',
  });

  return items;
}

// ─── Cross-Reference Generation ─────────────────────────────

export function generateCrossReferences(data: AnalysisData | null | undefined): CrossReference[] {
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
