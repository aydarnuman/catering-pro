'use client';

/**
 * ReminderPoller - Periyodik olarak vadesi gelen hatirlaticlari kontrol eder
 * ve toast notification gosterir. Providers.tsx'de render edilir.
 */

import { notifications } from '@mantine/notifications';
import { IconBell } from '@tabler/icons-react';
import { useCallback, useEffect, useRef } from 'react';
import { useNotesModal } from '@/context/NotesContext';
import { notesAPI } from '@/lib/api/services/notes';

const POLL_INTERVAL = 60_000; // 1 dakika

export function ReminderPoller() {
  const { openNotes } = useNotesModal();
  const shownRef = useRef<Set<string>>(new Set());

  const checkReminders = useCallback(async () => {
    try {
      const res = await notesAPI.getDueReminders();
      if (!res.success || !res.reminders) return;

      for (const reminder of res.reminders) {
        // Skip already shown
        if (shownRef.current.has(reminder.id)) continue;
        shownRef.current.add(reminder.id);

        // Show notification
        const contentPreview = (reminder.content || '').slice(0, 80);
        notifications.show({
          id: `reminder-${reminder.id}`,
          title: 'Hatirlatici',
          message: contentPreview || 'Bir notunuzun hatirlaticisi var',
          color: 'violet',
          icon: <IconBell size={18} />,
          autoClose: 15000,
          onClick: () => {
            openNotes();
          },
        });

        // Mark as sent
        try {
          await notesAPI.markReminderSent(reminder.id);
        } catch {
          // Silent - retry next poll
        }
      }
    } catch {
      // Silent - network errors expected during page transitions
    }
  }, [openNotes]);

  useEffect(() => {
    // Initial check after 5 seconds
    const initialTimeout = setTimeout(checkReminders, 5000);

    // Periodic check
    const interval = setInterval(checkReminders, POLL_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [checkReminders]);

  return null; // No UI - just a poller
}

export default ReminderPoller;
