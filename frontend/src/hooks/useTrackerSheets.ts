'use client';

/**
 * useTrackerSheets - Hook for tracker sheet persistence
 * Hybrid: localStorage for offline, syncs to server for persistence.
 * Server is the source of truth; localStorage is a fast cache.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TrackerSheet } from '@/components/notes/tools/tracker/types';
import { authFetch } from '@/lib/api';
import { API_BASE_URL } from '@/lib/config';

const LS_KEY = 'ws-tracker-sheets';
const QUERY_KEY = ['tracker-sheets'];
const DEBOUNCE_MS = 2000;

function getLocalSheets(): TrackerSheet[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as TrackerSheet[];
  } catch {
    /* ignore */
  }
  return [];
}

function setLocalSheets(sheets: TrackerSheet[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(sheets));
  } catch {
    /* ignore */
  }
}

export function useTrackerSheets() {
  const queryClient = useQueryClient();
  const [sheets, setSheetsState] = useState<TrackerSheet[]>(getLocalSheets);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch from server on mount
  const { data: serverData } = useQuery<{ sheets: TrackerSheet[]; updated_at: string | null }>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await authFetch(`${API_BASE_URL}/api/notes/tracker`);
      return res.json();
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // Merge server data on first load (server wins if it has data)
  useEffect(() => {
    if (serverData?.sheets && serverData.sheets.length > 0) {
      setSheetsState(serverData.sheets);
      setLocalSheets(serverData.sheets);
    }
  }, [serverData]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (sheetsToSave: TrackerSheet[]) => {
      const res = await authFetch(`${API_BASE_URL}/api/notes/tracker`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheets: sheetsToSave }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  // Debounced server save
  const debouncedSave = useCallback(
    (newSheets: TrackerSheet[]) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveMutation.mutate(newSheets);
      }, DEBOUNCE_MS);
    },
    [saveMutation]
  );

  // Update sheets (local + debounced server)
  const setSheets = useCallback(
    (updater: TrackerSheet[] | ((prev: TrackerSheet[]) => TrackerSheet[])) => {
      setSheetsState((prev) => {
        const newSheets = typeof updater === 'function' ? updater(prev) : updater;
        setLocalSheets(newSheets);
        debouncedSave(newSheets);
        return newSheets;
      });
    },
    [debouncedSave]
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return { sheets, setSheets, isSaving: saveMutation.isPending };
}
