'use client';

import { notifications } from '@mantine/notifications';
import { useCallback, useEffect, useState } from 'react';
import { getApiUrl } from '@/lib/config';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface AnalysisCorrection {
  id: number;
  tender_id: number;
  document_id: number | null;
  field_path: string;
  old_value: unknown;
  new_value: unknown;
  correction_type: 'edit' | 'delete' | 'add' | 'confirm';
  corrected_by: string;
  used_in_training: boolean;
  blob_synced: boolean;
  created_at: string;
  updated_at: string;
  document_name?: string;
}

export interface CorrectionInput {
  field_path: string;
  old_value: unknown;
  new_value: unknown;
  correction_type?: 'edit' | 'delete' | 'add';
}

export interface CorrectionStats {
  total_corrections: number;
  pending_training: number;
  pending_sync: number;
  affected_tenders: number;
  affected_documents: number;
  last_correction_at: string | null;
}

// ═══════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════

export function useAnalysisCorrections(tenderId: number | null, documentId?: number | null) {
  const [corrections, setCorrections] = useState<AnalysisCorrection[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Düzeltmeleri yükle
  const fetchCorrections = useCallback(async () => {
    if (!tenderId) return;
    setLoading(true);
    try {
      const res = await fetch(getApiUrl(`/analysis-corrections/${tenderId}`), {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success) {
        setCorrections(json.data);
      }
    } catch (error) {
      console.error('Düzeltmeler yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  }, [tenderId]);

  useEffect(() => {
    fetchCorrections();
  }, [fetchCorrections]);

  // Tek düzeltme kaydet
  const saveCorrection = useCallback(
    async (input: CorrectionInput): Promise<boolean> => {
      if (!tenderId) return false;
      setSaving(true);
      try {
        const res = await fetch(getApiUrl('/analysis-corrections'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            tender_id: tenderId,
            document_id: documentId || null,
            ...input,
          }),
        });
        const json = await res.json();
        if (json.success) {
          // Optimistic update
          setCorrections((prev) => [json.data, ...prev]);
          notifications.show({
            title: 'Düzeltme Kaydedildi',
            message: `${input.field_path} alanı güncellendi`,
            color: 'green',
          });
          return true;
        } else {
          notifications.show({
            title: 'Hata',
            message: json.error || 'Düzeltme kaydedilemedi',
            color: 'red',
          });
          return false;
        }
      } catch {
        notifications.show({
          title: 'Hata',
          message: 'Bağlantı hatası',
          color: 'red',
        });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [tenderId, documentId]
  );

  // Toplu düzeltme kaydet
  const saveBatchCorrections = useCallback(
    async (inputs: CorrectionInput[]): Promise<boolean> => {
      if (!tenderId || inputs.length === 0) return false;
      setSaving(true);
      try {
        const res = await fetch(getApiUrl('/analysis-corrections/batch'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            tender_id: tenderId,
            document_id: documentId || null,
            corrections: inputs,
          }),
        });
        const json = await res.json();
        if (json.success) {
          setCorrections((prev) => [...json.data, ...prev]);
          notifications.show({
            title: 'Düzeltmeler Kaydedildi',
            message: `${json.count} alan güncellendi`,
            color: 'green',
          });
          return true;
        }
        return false;
      } catch {
        notifications.show({
          title: 'Hata',
          message: 'Bağlantı hatası',
          color: 'red',
        });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [tenderId, documentId]
  );

  // Analizi onayla (tümü doğru)
  const confirmAnalysis = useCallback(async (): Promise<boolean> => {
    if (!tenderId) return false;
    setSaving(true);
    try {
      const res = await fetch(getApiUrl('/analysis-corrections/confirm'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tender_id: tenderId,
          document_id: documentId || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setCorrections((prev) => [json.data, ...prev]);
        notifications.show({
          title: 'Analiz Onaylandı',
          message: 'Tüm analiz sonuçları doğru olarak işaretlendi',
          color: 'green',
        });
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }, [tenderId, documentId]);

  // Düzeltmeyi geri al
  const undoCorrection = useCallback(async (correctionId: number): Promise<boolean> => {
    try {
      const res = await fetch(getApiUrl(`/analysis-corrections/${correctionId}`), {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success) {
        setCorrections((prev) => prev.filter((c) => c.id !== correctionId));
        notifications.show({
          title: 'Geri Alındı',
          message: 'Düzeltme geri alındı',
          color: 'blue',
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  // Belirli bir alan için düzeltme var mı?
  const getCorrectionForField = useCallback(
    (fieldPath: string): AnalysisCorrection | undefined => {
      return corrections.find((c) => c.field_path === fieldPath && c.correction_type !== 'confirm');
    },
    [corrections]
  );

  // Analiz onaylandı mı?
  const isConfirmed = corrections.some((c) => c.correction_type === 'confirm');

  // Düzeltme sayısı (confirm hariç)
  const correctionCount = corrections.filter((c) => c.correction_type !== 'confirm').length;

  return {
    corrections,
    loading,
    saving,
    correctionCount,
    isConfirmed,
    saveCorrection,
    saveBatchCorrections,
    confirmAnalysis,
    undoCorrection,
    getCorrectionForField,
    refetch: fetchCorrections,
  };
}
