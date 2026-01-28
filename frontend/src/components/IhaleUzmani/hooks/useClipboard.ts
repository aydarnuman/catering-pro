import { notifications } from '@mantine/notifications';
import { useCallback, useEffect, useState } from 'react';
import {
  type ClipboardItem,
  type ClipboardItemType,
  type ClipboardPriority,
  type ClipboardTag,
  clipboardTypeLabels,
} from '../types';

const STORAGE_KEY = 'ihaleUzmani_clipboard';

export function useClipboard(tenderId?: string) {
  const [items, setItems] = useState<ClipboardItem[]>([]);
  const [modalOpened, setModalOpened] = useState(false);
  const [search, setSearch] = useState('');
  const [showAddNote, setShowAddNote] = useState(false);

  // LocalStorage'dan yükle
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}_${tenderId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setItems(
          parsed.map((item: any) => ({
            ...item,
            createdAt: new Date(item.createdAt),
          }))
        );
      }
    } catch (error) {
      console.error('Clipboard load error:', error);
    }
  }, [tenderId]);

  // LocalStorage'a kaydet
  useEffect(() => {
    if (tenderId && items.length >= 0) {
      localStorage.setItem(`${STORAGE_KEY}_${tenderId}`, JSON.stringify(items));
    }
  }, [items, tenderId]);

  // Panoya ekle
  const addItem = useCallback(
    (
      type: ClipboardItemType,
      content: string,
      source: string,
      metadata?: ClipboardItem['metadata'],
      priority?: ClipboardPriority,
      tags?: ClipboardTag[],
      color?: string
    ) => {
      // Duplicate check
      const exists = items.some((item) => item.content === content);
      if (exists) {
        notifications.show({
          title: 'Zaten ekli',
          message: 'Bu öğe zaten panoda mevcut',
          color: 'yellow',
          autoClose: 2000,
        });
        return false;
      }

      const newItem: ClipboardItem = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        content,
        source,
        isPinned: false,
        createdAt: new Date(),
        metadata,
        priority,
        tags,
        color,
      };

      setItems((prev) => [newItem, ...prev]);
      notifications.show({
        title: 'Panoya eklendi',
        message: source,
        color: 'green',
        autoClose: 1500,
      });
      return true;
    },
    [items]
  );

  // Manuel not ekle
  const addNote = useCallback(
    (content: string, priority?: ClipboardPriority, tags?: ClipboardTag[], color?: string) => {
      if (!content.trim()) {
        notifications.show({
          title: 'Hata',
          message: 'Not içeriği boş olamaz',
          color: 'red',
        });
        return false;
      }

      const newItem: ClipboardItem = {
        id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'not',
        content: content.trim(),
        source: 'Manuel Not',
        isPinned: false,
        createdAt: new Date(),
        priority,
        tags,
        color,
      };

      setItems((prev) => [newItem, ...prev]);
      setShowAddNote(false);
      notifications.show({
        title: 'Not eklendi',
        message: 'Manuel not panoya kaydedildi',
        color: 'pink',
        autoClose: 1500,
      });
      return true;
    },
    []
  );

  // Öğe güncelle (priority, tags, color)
  const updateItem = useCallback(
    (
      id: string,
      updates: Partial<Pick<ClipboardItem, 'priority' | 'tags' | 'color' | 'content'>>
    ) => {
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
    },
    []
  );

  // Panodan sil
  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Pin toggle
  const togglePin = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isPinned: !item.isPinned } : item))
    );
  }, []);

  // Tümünü kopyala
  const copyAll = useCallback(() => {
    const sortedItems = [...items].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0;
    });

    const text = sortedItems
      .map((item) => {
        const { icon, label } = clipboardTypeLabels[item.type];
        return `${item.isPinned ? '📌 ' : ''}[${icon} ${label}] ${item.content}\n   Kaynak: ${item.source}`;
      })
      .join('\n\n');

    navigator.clipboard.writeText(text);
    notifications.show({
      title: 'Kopyalandı',
      message: `${items.length} öğe panoya kopyalandı`,
      color: 'green',
    });
  }, [items]);

  // Tümünü temizle
  const clearAll = useCallback(() => {
    if (window.confirm('Tüm pano içeriğini silmek istediğinize emin misiniz?')) {
      setItems([]);
      notifications.show({
        title: 'Temizlendi',
        message: 'Çalışma panosu temizlendi',
        color: 'blue',
      });
    }
  }, []);

  // Kategoriye göre grupla
  const getByCategory = useCallback(() => {
    const pinned = items.filter((item) => item.isPinned);
    const not = items.filter((item) => !item.isPinned && item.type === 'not');
    const teknik = items.filter((item) => !item.isPinned && item.type === 'teknik');
    const fiyat = items.filter((item) => !item.isPinned && item.type === 'fiyat');
    const ai = items.filter((item) => !item.isPinned && item.type === 'ai');
    const hesaplama = items.filter((item) => !item.isPinned && item.type === 'hesaplama');
    const genel = items.filter((item) => !item.isPinned && item.type === 'genel');

    return { pinned, not, teknik, fiyat, ai, hesaplama, genel };
  }, [items]);

  // Filtrelenmiş öğeler
  const getFiltered = useCallback(() => {
    if (!search) return items;
    return items.filter(
      (item) =>
        item.content.toLowerCase().includes(search.toLowerCase()) ||
        item.source.toLowerCase().includes(search.toLowerCase())
    );
  }, [items, search]);

  // Tek öğeyi kopyala
  const copyItem = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
    notifications.show({
      message: 'Kopyalandı',
      color: 'green',
      autoClose: 1500,
    });
  }, []);

  // Export - Text formatında dışa aktar
  const exportAsText = useCallback(() => {
    const sortedItems = [...items].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      if (a.type === 'not' && b.type !== 'not') return -1;
      if (a.type !== 'not' && b.type === 'not') return 1;
      return 0;
    });

    const lines: string[] = [
      '═══════════════════════════════════════════',
      '           ÇALIŞMA PANOSU RAPORU           ',
      '═══════════════════════════════════════════',
      `Tarih: ${new Date().toLocaleString('tr-TR')}`,
      `Toplam Öğe: ${items.length}`,
      '───────────────────────────────────────────',
      '',
    ];

    sortedItems.forEach((item, idx) => {
      const { icon, label } = clipboardTypeLabels[item.type];
      const priorityStr = item.priority
        ? ` [${item.priority === 'high' ? '⚠️ YÜKSEK' : item.priority === 'medium' ? '⚡ ORTA' : '✓ DÜŞÜK'}]`
        : '';
      const tagsStr = item.tags?.length ? ` #${item.tags.join(' #')}` : '';

      lines.push(
        `${idx + 1}. ${item.isPinned ? '📌 ' : ''}${icon} ${label}${priorityStr}${tagsStr}`
      );
      lines.push(`   ${item.content}`);
      lines.push(`   Kaynak: ${item.source} | ${new Date(item.createdAt).toLocaleString('tr-TR')}`);
      lines.push('');
    });

    lines.push('═══════════════════════════════════════════');

    const text = lines.join('\n');
    navigator.clipboard.writeText(text);

    notifications.show({
      title: 'Dışa aktarıldı',
      message: 'Rapor panoya kopyalandı',
      color: 'blue',
    });

    return text;
  }, [items]);

  // Export - Dosya olarak indir
  const downloadAsFile = useCallback(() => {
    const text = exportAsText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calisma-panosu-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    notifications.show({
      title: 'İndirildi',
      message: 'Rapor dosyası indirildi',
      color: 'green',
    });
  }, [exportAsText]);

  // Önceliğe göre filtrele
  const getByPriority = useCallback(
    (priority: ClipboardPriority) => {
      return items.filter((item) => item.priority === priority);
    },
    [items]
  );

  // Etikete göre filtrele
  const getByTag = useCallback(
    (tag: ClipboardTag) => {
      return items.filter((item) => item.tags?.includes(tag));
    },
    [items]
  );

  return {
    items,
    modalOpened,
    setModalOpened,
    search,
    setSearch,
    showAddNote,
    setShowAddNote,
    addItem,
    addNote,
    updateItem,
    removeItem,
    togglePin,
    copyAll,
    clearAll,
    copyItem,
    exportAsText,
    downloadAsFile,
    getByCategory,
    getFiltered,
    getByPriority,
    getByTag,
    count: items.length,
  };
}

export type UseClipboardReturn = ReturnType<typeof useClipboard>;
