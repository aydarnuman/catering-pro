'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getApiUrl } from '@/lib/config';

// ─── Types ─────────────────────────────────────────────────────

export type AnnotationType = 'highlight' | 'note' | 'correction';

export interface DocumentAnnotation {
  id: number;
  document_id: number;
  tender_id: number;
  annotation_type: AnnotationType;
  page_number: number | null;
  text_content: string | null;
  color: string;
  target_card_id: number | null;
  target_field_path: string | null;
  position_data: {
    startOffset?: number;
    endOffset?: number;
    rects?: Array<{ x: number; y: number; width: number; height: number }>;
  } | null;
  created_by: number | null;
  created_at: string;
  card_title?: string;
  document_name?: string;
}

export interface CreateAnnotationInput {
  document_id: number;
  tender_id: number;
  annotation_type?: AnnotationType;
  page_number?: number;
  text_content?: string;
  color?: string;
  target_card_id?: number;
  target_field_path?: string;
  position_data?: Record<string, unknown>;
}

// ─── Hook ──────────────────────────────────────────────────────

export function useDocumentAnnotations(documentId: number | null, tenderId?: number | null) {
  const queryClient = useQueryClient();
  const docQueryKey = ['document-annotations', documentId];
  const tenderQueryKey = ['document-annotations-tender', tenderId];

  // Tek doküman annotasyonları
  const docQuery = useQuery<DocumentAnnotation[]>({
    queryKey: docQueryKey,
    queryFn: async () => {
      if (!documentId) throw new Error('documentId gerekli');
      const res = await api.get(getApiUrl(`/api/document-annotations/${documentId}`));
      return res.data?.data || [];
    },
    enabled: !!documentId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // İhale bazında tüm annotasyonlar (opsiyonel)
  const tenderQuery = useQuery<DocumentAnnotation[]>({
    queryKey: tenderQueryKey,
    queryFn: async () => {
      if (!tenderId) throw new Error('tenderId gerekli');
      const res = await api.get(getApiUrl(`/api/document-annotations/tender/${tenderId}`));
      return res.data?.data || [];
    },
    enabled: !!tenderId && !documentId, // Sadece tenderId verilmişse ve documentId yoksa
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Create annotation
  const createMutation = useMutation({
    mutationFn: async (input: CreateAnnotationInput) => {
      const res = await api.post(getApiUrl('/api/document-annotations'), input);
      return res.data?.data as DocumentAnnotation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: docQueryKey });
      if (tenderId) queryClient.invalidateQueries({ queryKey: tenderQueryKey });
    },
  });

  // Delete annotation
  const deleteMutation = useMutation({
    mutationFn: async (annotationId: number) => {
      await api.delete(getApiUrl(`/api/document-annotations/${annotationId}`));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: docQueryKey });
      if (tenderId) queryClient.invalidateQueries({ queryKey: tenderQueryKey });
    },
  });

  return {
    annotations: docQuery.data || tenderQuery.data || [],
    isLoading: docQuery.isLoading || tenderQuery.isLoading,
    createAnnotation: createMutation.mutateAsync,
    deleteAnnotation: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    refetch: documentId ? docQuery.refetch : tenderQuery.refetch,
  };
}
