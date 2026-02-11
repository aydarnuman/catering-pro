import { useCallback, useMemo, useState } from 'react';
import type { AnalysisData, SavedTender } from '../../types';
import { AGENTS } from '../constants';
import type { AgentAnalysis, AgentFinding, AgentHighlight, AgentPersona, ChecklistItem, CrossReference, SnippetDrop, VerdictData, ViewMode } from '../types';

// ─── Agent Weights for Verdict Scoring ───────────────────────

const AGENT_WEIGHTS: Record<AgentPersona['id'], number> = {
  mevzuat: 0.30,
  maliyet: 0.30,
  teknik: 0.25,
  rekabet: 0.15,
};

// ─── Data Mapping: AnalysisData → AgentAnalysis[] ───────────

function extractMevzuatFindings(data: AnalysisData): AgentFinding[] {
  const findings: AgentFinding[] = [];

  if (data.ihale_usulu) findings.push({ label: 'Ihale Usulu', value: data.ihale_usulu });
  if (data.ihale_turu) findings.push({ label: 'Ihale Turu', value: data.ihale_turu });
  if (data.teklif_turu) findings.push({ label: 'Teklif Turu', value: data.teklif_turu });

  if (data.operasyonel_kurallar) {
    if (data.operasyonel_kurallar.alt_yuklenici) {
      findings.push({ label: 'Alt Yuklenici', value: data.operasyonel_kurallar.alt_yuklenici });
    }
    if (data.operasyonel_kurallar.muayene_kabul) {
      findings.push({ label: 'Muayene & Kabul', value: data.operasyonel_kurallar.muayene_kabul });
    }
    if (data.operasyonel_kurallar.denetim) {
      findings.push({ label: 'Denetim', value: data.operasyonel_kurallar.denetim });
    }
  }

  if (data.gerekli_belgeler?.length) {
    const zorunlu = data.gerekli_belgeler.filter((b) => b.zorunlu).length;
    findings.push({
      label: 'Gerekli Belgeler',
      value: `${data.gerekli_belgeler.length} belge (${zorunlu} zorunlu)`,
      severity: zorunlu > 5 ? 'warning' : 'info',
    });
  } else {
    findings.push({
      label: 'Gerekli Belgeler',
      value: 'Belge listesi tanimlanmamis — sartname kontrolu gerekli',
      severity: 'warning',
    });
  }

  if (data.ceza_kosullari?.length) {
    findings.push({
      label: 'Ceza Kosullari',
      value: `${data.ceza_kosullari.length} madde tespit edildi`,
      severity: data.ceza_kosullari.length > 3 ? 'critical' : 'warning',
    });
  }

  if (data.is_artisi) {
    if (data.is_artisi.oran) findings.push({ label: 'Is Artisi Orani', value: data.is_artisi.oran });
  } else {
    findings.push({
      label: 'Is Artisi',
      value: 'Is artisi maddesi bulunamadi — risk',
      severity: 'warning',
    });
  }

  if (data.fiyat_farki?.formul) {
    findings.push({ label: 'Fiyat Farki', value: data.fiyat_farki.formul });
  }

  return findings;
}

function extractMaliyetFindings(data: AnalysisData): AgentFinding[] {
  const findings: AgentFinding[] = [];

  if (data.tahmini_bedel) {
    findings.push({ label: 'Tahmini Bedel', value: data.tahmini_bedel });
  } else {
    findings.push({
      label: 'Tahmini Bedel',
      value: 'Bedel bilgisi yok — maliyet hesabi yapilamaz',
      severity: 'critical',
    });
  }

  if (data.iscilik_orani) {
    findings.push({ label: 'Iscilik Orani', value: data.iscilik_orani });
  }

  if (data.birim_fiyatlar?.length) {
    findings.push({ label: 'Birim Fiyat Kalemleri', value: `${data.birim_fiyatlar.length} kalem` });
  }

  if (data.mali_kriterler) {
    const mk = data.mali_kriterler;
    if (mk.cari_oran) findings.push({ label: 'Cari Oran', value: mk.cari_oran });
    if (mk.ozkaynak_orani) findings.push({ label: 'Ozkaynak Orani', value: mk.ozkaynak_orani });
    if (mk.is_deneyimi) findings.push({ label: 'Is Deneyimi', value: mk.is_deneyimi });
    if (mk.ciro_orani) findings.push({ label: 'Ciro Orani', value: mk.ciro_orani });
    if (!mk.cari_oran && !mk.ozkaynak_orani && !mk.is_deneyimi) {
      findings.push({
        label: 'Mali Kriterler',
        value: 'Yeterlilik kriterleri eksik — yeterlilik riski',
        severity: 'warning',
      });
    }
  } else {
    findings.push({
      label: 'Mali Kriterler',
      value: 'Mali yeterlilik kriterleri tanimlanmamis',
      severity: 'warning',
    });
  }

  if (data.teminat_oranlari) {
    const t = data.teminat_oranlari;
    if (t.gecici) findings.push({ label: 'Gecici Teminat', value: t.gecici });
    if (t.kesin) findings.push({ label: 'Kesin Teminat', value: t.kesin });
  }

  if (data.odeme_kosullari) {
    const ok = data.odeme_kosullari;
    if (ok.odeme_suresi) findings.push({ label: 'Odeme Suresi', value: ok.odeme_suresi });
    if (ok.avans) findings.push({ label: 'Avans', value: ok.avans });
  }

  return findings;
}

function extractTeknikFindings(data: AnalysisData): AgentFinding[] {
  const findings: AgentFinding[] = [];

  if (data.teknik_sartlar?.length) {
    const zorunlu = data.teknik_sartlar.filter((s) => {
      if (typeof s === 'string') return s.toLowerCase().includes('zorunlu');
      return s.text?.toLowerCase().includes('zorunlu');
    }).length;
    findings.push({
      label: 'Teknik Sartlar',
      value: `${data.teknik_sartlar.length} madde${zorunlu ? ` (${zorunlu} zorunlu)` : ''}`,
      severity: zorunlu > 10 ? 'warning' : 'info',
    });
  }

  if (data.personel_detaylari?.length) {
    const total = data.personel_detaylari.reduce((sum, p) => sum + p.adet, 0);
    findings.push({ label: 'Personel Ihtiyaci', value: `${total} kisi, ${data.personel_detaylari.length} pozisyon` });
  } else if (data.kisi_sayisi) {
    findings.push({ label: 'Kisi Sayisi', value: data.kisi_sayisi });
  } else {
    findings.push({
      label: 'Personel',
      value: 'Personel detaylari belirtilmemis — planlama riski',
      severity: 'warning',
    });
  }

  if (data.ogun_bilgileri?.length) {
    findings.push({ label: 'Ogun Bilgileri', value: `${data.ogun_bilgileri.length} ogun tipi` });
  }

  if (data.ekipman_listesi) findings.push({ label: 'Ekipman', value: data.ekipman_listesi });
  if (data.kalite_standartlari) findings.push({ label: 'Kalite Standartlari', value: data.kalite_standartlari });

  if (data.servis_saatleri) {
    const ss = data.servis_saatleri;
    const saatler = [ss.kahvalti, ss.ogle, ss.aksam].filter(Boolean).join(', ');
    if (saatler) findings.push({ label: 'Servis Saatleri', value: saatler });
  }

  if (data.sure || data.teslim_suresi) {
    findings.push({ label: 'Sure', value: (data.sure || data.teslim_suresi)! });
  } else {
    findings.push({
      label: 'Sure',
      value: 'Sozlesme suresi belirtilmemis',
      severity: 'warning',
    });
  }

  return findings;
}

function extractRekaretFindings(data: AnalysisData): AgentFinding[] {
  const findings: AgentFinding[] = [];

  if (data.sinir_deger_katsayisi) {
    findings.push({ label: 'Sinir Deger Katsayisi', value: data.sinir_deger_katsayisi });
  }

  if (data.benzer_is_tanimi) {
    findings.push({ label: 'Benzer Is Tanimi', value: data.benzer_is_tanimi });
  } else {
    findings.push({
      label: 'Benzer Is',
      value: 'Benzer is tanimi bulunamadi — yeterlilik riski',
      severity: 'critical',
    });
  }

  if (data.eksik_bilgiler?.length) {
    findings.push({
      label: 'Eksik Bilgiler',
      value: data.eksik_bilgiler.join(', '),
      severity: 'critical',
    });
  }

  if (data.onemli_notlar?.length) {
    const uyarilar = data.onemli_notlar.filter((n) => {
      if (typeof n === 'string') return false;
      return n.tur === 'uyari';
    }).length;
    findings.push({
      label: 'Onemli Notlar',
      value: `${data.onemli_notlar.length} not${uyarilar ? ` (${uyarilar} uyari)` : ''}`,
      severity: uyarilar > 2 ? 'warning' : 'info',
    });
  }

  if (data.notlar?.length) {
    findings.push({ label: 'AI Notlari', value: `${data.notlar.length} analiz notu` });
  }

  if (data.kapasite_gereksinimi) {
    findings.push({ label: 'Kapasite Gereksinimi', value: data.kapasite_gereksinimi });
  }

  return findings;
}

function computeAgentRisk(findings: AgentFinding[]): number {
  let score = 70;
  for (const f of findings) {
    if (f.severity === 'critical') score -= 15;
    else if (f.severity === 'warning') score -= 8;
    else score += 2;
  }
  if (findings.length === 0) score = 50;
  return Math.max(0, Math.min(100, score));
}

function mapAnalysisToAgents(tender: SavedTender): AgentAnalysis[] {
  const data = tender.analysis_summary;

  if (!data) {
    return AGENTS.map((agent) => ({
      agentId: agent.id,
      status: 'no-data' as const,
      findings: [],
      riskScore: 0,
      summary: 'Analiz verisi bulunamadi',
    }));
  }

  const extractors: Record<string, (d: AnalysisData) => AgentFinding[]> = {
    mevzuat: extractMevzuatFindings,
    maliyet: extractMaliyetFindings,
    teknik: extractTeknikFindings,
    rekabet: extractRekaretFindings,
  };

  return AGENTS.map((agent) => {
    const findings = extractors[agent.id]?.(data) || [];
    const riskScore = computeAgentRisk(findings);

    let status: AgentAnalysis['status'] = 'complete';
    if (findings.length === 0) status = 'no-data';
    else if (riskScore < 40) status = 'critical';
    else if (riskScore < 60) status = 'warning';

    let summary = '';
    if (findings.length === 0) {
      summary = 'Yeterli veri bulunamadi';
    } else {
      const topFinding = findings[0];
      summary = `${topFinding.label}: ${topFinding.value}`;
    }

    return { agentId: agent.id, status, findings, riskScore, summary };
  });
}

function generateVerdict(analyses: AgentAnalysis[], data?: AnalysisData | null): VerdictData {
  const validScores = analyses.filter((a) => a.status !== 'no-data');

  // Weighted scoring
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

// ─── Checklist Generation ──────────────────────────────────────

function generateChecklist(data: AnalysisData, analyses: AgentAnalysis[]): ChecklistItem[] {
  const items: ChecklistItem[] = [];

  // 1. Tahmini bedel
  items.push({
    id: 'bedel',
    label: 'Tahmini bedel bilgisi mevcut',
    status: data.tahmini_bedel ? 'pass' : 'fail',
    detail: data.tahmini_bedel || 'Bedel bilgisi eksik',
    severity: 'critical',
  });

  // 2. Gerekli belgeler
  const belgeSayisi = data.gerekli_belgeler?.length ?? 0;
  items.push({
    id: 'belgeler',
    label: 'Gerekli belgeler tanimli',
    status: belgeSayisi > 0 ? 'pass' : 'fail',
    detail: belgeSayisi > 0 ? `${belgeSayisi} belge` : 'Belge listesi yok',
    severity: 'critical',
  });

  // 3. Personel detaylari
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

  // 4. Mali kriterler
  const maliVar = !!(data.mali_kriterler?.cari_oran || data.mali_kriterler?.ozkaynak_orani || data.mali_kriterler?.is_deneyimi);
  items.push({
    id: 'mali_kriter',
    label: 'Mali yeterlilik kriterleri mevcut',
    status: maliVar ? 'pass' : 'fail',
    detail: maliVar ? 'Kriterler tanimli' : 'Mali kriterler eksik',
    severity: 'critical',
  });

  // 5. Benzer is tanimi
  items.push({
    id: 'benzer_is',
    label: 'Benzer is tanimi mevcut',
    status: data.benzer_is_tanimi ? 'pass' : 'fail',
    detail: data.benzer_is_tanimi || 'Benzer is tanimi bulunamadi',
    severity: 'critical',
  });

  // 6. Sure / teslim suresi
  items.push({
    id: 'sure',
    label: 'Sozlesme suresi belirli',
    status: (data.sure || data.teslim_suresi) ? 'pass' : 'unknown',
    detail: data.sure || data.teslim_suresi || 'Sure bilgisi yok',
    severity: 'warning',
  });

  // 7. Ceza kosullari
  const cezaSayisi = data.ceza_kosullari?.length ?? 0;
  items.push({
    id: 'ceza',
    label: 'Ceza kosullari makul duzeyde',
    status: cezaSayisi === 0 ? 'unknown' : cezaSayisi <= 3 ? 'pass' : 'fail',
    detail: cezaSayisi > 0 ? `${cezaSayisi} ceza maddesi` : 'Ceza kosullari belirsiz',
    severity: cezaSayisi > 3 ? 'warning' : 'info',
  });

  // 8. Fiyat farki
  items.push({
    id: 'fiyat_farki',
    label: 'Fiyat farki formulu tanimli',
    status: data.fiyat_farki?.formul ? 'pass' : 'unknown',
    detail: data.fiyat_farki?.formul || 'Fiyat farki bilgisi yok',
    severity: 'info',
  });

  // 9. Is artisi
  items.push({
    id: 'is_artisi',
    label: 'Is artisi maddesi mevcut',
    status: data.is_artisi?.oran ? 'pass' : 'fail',
    detail: data.is_artisi?.oran || 'Is artisi maddesi bulunamadi',
    severity: 'warning',
  });

  // 10. Agent risk skorlari kritik degil
  const criticalAgents = analyses.filter((a) => a.riskScore < 40);
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

// ─── Agent Highlight Generation ────────────────────────────────

function generateAgentHighlights(data: AnalysisData | undefined, analyses: AgentAnalysis[]): AgentHighlight[] {
  if (!data?.tam_metin) return [];
  const tamMetin = data.tam_metin.toLowerCase();
  const highlights: AgentHighlight[] = [];

  for (const analysis of analyses) {
    const agent = AGENTS.find((a) => a.id === analysis.agentId);
    if (!agent) continue;

    for (const finding of analysis.findings) {
      if (!finding.severity || finding.severity === 'info') continue;

      // Try to find the finding label text in the full document
      const searchTerms = extractSearchTerms(finding);
      for (const term of searchTerms) {
        if (term.length < 4) continue;
        const lowerTerm = term.toLowerCase();
        if (tamMetin.includes(lowerTerm)) {
          // Find the actual cased text in original
          const idx = data.tam_metin!.toLowerCase().indexOf(lowerTerm);
          if (idx !== -1) {
            highlights.push({
              agentId: agent.id,
              text: data.tam_metin!.substring(idx, idx + term.length),
              color: agent.color,
              finding: finding.label,
            });
          }
          break; // One highlight per finding
        }
      }
    }
  }

  return highlights;
}

// ─── Cross-Reference Generation ───────────────────────────────

function generateCrossReferences(data: AnalysisData | null | undefined): CrossReference[] {
  if (!data) return [];
  const refs: CrossReference[] = [];

  // RULE 1: Ceza koşulları → Maliyet riski
  if (data.ceza_kosullari?.length && data.ceza_kosullari.length > 2) {
    refs.push({
      fromAgentId: 'mevzuat',
      toAgentId: 'maliyet',
      fromFinding: 'Ceza Kosullari',
      impact: `${data.ceza_kosullari.length} ceza maddesi maliyet riskini artiriyor`,
      severity: data.ceza_kosullari.length > 4 ? 'critical' : 'warning',
    });
  }

  // RULE 2: Personel detayları → Maliyet hesabı
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

  // RULE 3: Benzer iş tanımı yok → Rekabet riski
  if (!data.benzer_is_tanimi) {
    refs.push({
      fromAgentId: 'rekabet',
      toAgentId: 'mevzuat',
      fromFinding: 'Benzer Is',
      impact: 'Benzer is tanimi olmadan yeterlilik degerlendirmesi yapilamaz',
      severity: 'critical',
    });
  }

  // RULE 4: Mali kriterler eksik → Rekabet stratejisi
  if (!data.mali_kriterler?.cari_oran && !data.mali_kriterler?.is_deneyimi) {
    refs.push({
      fromAgentId: 'maliyet',
      toAgentId: 'rekabet',
      fromFinding: 'Mali Kriterler',
      impact: 'Mali yeterlilik kriterleri belirsiz — teklif stratejisi riskli',
      severity: 'warning',
    });
  }

  // RULE 5: Fiyat farkı formülü → Maliyet
  if (data.fiyat_farki?.formul) {
    refs.push({
      fromAgentId: 'mevzuat',
      toAgentId: 'maliyet',
      fromFinding: 'Fiyat Farki',
      impact: `Fiyat farki formulu maliyet projeksiyonunu etkiler: ${data.fiyat_farki.formul}`,
      severity: 'info',
    });
  }

  // RULE 6: Teknik şart sayısı fazla → Maliyet
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

/** Extract meaningful search terms from a finding for highlighting */
function extractSearchTerms(finding: AgentFinding): string[] {
  const terms: string[] = [];

  // Use label and value to find relevant text
  if (finding.value && finding.value.length > 4 && finding.value.length < 100) {
    terms.push(finding.value);
  }

  // Extract quoted text from value
  const quoted = finding.value?.match(/"([^"]+)"/g);
  if (quoted) {
    for (const q of quoted) terms.push(q.replace(/"/g, ''));
  }

  // Use label as last resort
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

  const agentAnalyses = useMemo(() => mapAnalysisToAgents(tender), [tender]);

  const agentHighlights = useMemo(
    () => generateAgentHighlights(tender?.analysis_summary ?? undefined, agentAnalyses),
    [tender?.analysis_summary, agentAnalyses]
  );

  const crossReferences = useMemo(
    () => generateCrossReferences(tender?.analysis_summary ?? null),
    [tender?.analysis_summary]
  );

  const handleAgentClick = useCallback((agentId: string) => {
    setFocusedAgentId(agentId);
    setViewMode('FOCUS');
  }, []);

  const handleBackToOrbit = useCallback(() => {
    setFocusedAgentId(null);
    setViewMode('ORBIT');
  }, []);

  const handleAssemble = useCallback(() => {
    setViewMode('ASSEMBLE');
    setVerdictData(generateVerdict(agentAnalyses, tender?.analysis_summary));
  }, [agentAnalyses, tender?.analysis_summary]);

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
    agentAnalyses,
    agentHighlights,
    crossReferences,
    snippetDrops,
    handleAgentClick,
    handleBackToOrbit,
    handleAssemble,
    handleReset,
    handleSnippetDrop,
  };
}
