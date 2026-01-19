import { useState, useCallback, useRef, useEffect } from 'react';
import { notifications } from '@mantine/notifications';
import { API_BASE_URL } from '@/lib/config';
import { SavedTender, DilekceMessage, DilekceConversation, FirmaBilgisi, AnalysisData } from '../types';

export interface UseDilekceReturn {
  // State
  activePanel: 'ai' | 'dilekce';
  setActivePanel: (panel: 'ai' | 'dilekce') => void;
  dilekceType: string | null;
  dilekceContent: string;
  setDilekceContent: (content: string) => void;
  dilekceMessages: DilekceMessage[];
  dilekceInput: string;
  setDilekceInput: (input: string) => void;
  dilekceLoading: boolean;
  dilekceSessionId: string | null;
  dilekceConversations: DilekceConversation[];
  showDilekceChat: boolean;
  isDilekceEditing: boolean;
  setIsDilekceEditing: (val: boolean) => void;
  showChatHistory: boolean;
  setShowChatHistory: (val: boolean) => void;
  dilekceSaving: boolean;
  dilekceEndRef: React.RefObject<HTMLDivElement>;

  // Actions
  handleDilekceTypeChange: (type: string) => Promise<void>;
  openDilekceConversation: (sessionId: string) => Promise<void>;
  startNewDilekceConversation: () => void;
  backToDilekceList: () => void;
  deleteDilekceConversation: (sessionId: string) => Promise<void>;
  sendDilekceMessage: () => Promise<void>;
  saveDilekce: () => Promise<void>;
  downloadDilekce: () => void;
  resetDilekce: () => void;
}

export function useDilekce(
  tender: SavedTender | null,
  selectedFirma: FirmaBilgisi | undefined,
  analysisData: AnalysisData
): UseDilekceReturn {
  // Panel state
  const [activePanel, setActivePanel] = useState<'ai' | 'dilekce'>('ai');
  
  // Dilekçe state
  const [dilekceType, setDilekceType] = useState<string | null>(null);
  const [dilekceContent, setDilekceContent] = useState('');
  const [dilekceMessages, setDilekceMessages] = useState<DilekceMessage[]>([]);
  const [dilekceInput, setDilekceInput] = useState('');
  const [dilekceLoading, setDilekceLoading] = useState(false);
  const [dilekceSessionId, setDilekceSessionId] = useState<string | null>(null);
  const [dilekceConversations, setDilekceConversations] = useState<DilekceConversation[]>([]);
  const [showDilekceChat, setShowDilekceChat] = useState(false);
  const [isDilekceEditing, setIsDilekceEditing] = useState(false);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [dilekceSaving, setDilekceSaving] = useState(false);
  
  const dilekceEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (dilekceMessages.length > 0) {
      dilekceEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [dilekceMessages]);

  // Reset function
  const resetDilekce = useCallback(() => {
    setDilekceType(null);
    setDilekceContent('');
    setDilekceMessages([]);
    setDilekceInput('');
    setDilekceSessionId(null);
    setDilekceConversations([]);
    setShowDilekceChat(false);
    setIsDilekceEditing(false);
    setShowChatHistory(false);
    setActivePanel('ai');
  }, []);

  // Load conversations list for a type
  const loadDilekceConversationsList = useCallback(async (type: string) => {
    if (!tender) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/ai/conversations/list?prefix=ihale_${tender.tender_id || tender.id}_dilekce_${type}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.conversations) {
          setDilekceConversations(result.conversations);
        } else {
          setDilekceConversations([]);
        }
      } else {
        setDilekceConversations([]);
      }
    } catch (error) {
      console.error('Konuşma listesi yüklenemedi:', error);
      setDilekceConversations([]);
    }
  }, [tender]);

  // Handle type change
  const handleDilekceTypeChange = useCallback(async (type: string) => {
    if (!tender) return;

    setActivePanel('dilekce');
    setDilekceType(type);
    setDilekceContent('');
    setDilekceMessages([]);
    setShowDilekceChat(false);
    setDilekceSessionId(null);

    await loadDilekceConversationsList(type);
  }, [tender, loadDilekceConversationsList]);

  // Open existing conversation
  const openDilekceConversation = useCallback(async (sessionId: string) => {
    setDilekceSessionId(sessionId);
    setShowDilekceChat(true);
    setShowChatHistory(false);
    setIsDilekceEditing(false);

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/conversations/${sessionId}?userId=default`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.success && data.messages) {
        const formattedMessages = data.messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
        }));
        setDilekceMessages(formattedMessages);

        // Set last AI message as dilekce content
        const lastAiMessage = [...data.messages].reverse().find((m: any) => m.role === 'assistant');
        if (lastAiMessage) {
          setDilekceContent(lastAiMessage.content);
        }
      }
    } catch (error) {
      console.error('Konuşma yüklenemedi:', error);
    }
  }, []);

  // Start new conversation
  const startNewDilekceConversation = useCallback(() => {
    if (!tender || !dilekceType) return;

    const newSessionId = `ihale_${tender.tender_id || tender.id}_dilekce_${dilekceType}_${Date.now()}`;
    setDilekceSessionId(newSessionId);
    setDilekceMessages([]);
    setDilekceContent('');
    setShowDilekceChat(true);
  }, [tender, dilekceType]);

  // Back to list
  const backToDilekceList = useCallback(() => {
    setShowDilekceChat(false);
  }, []);

  // Delete conversation
  const deleteDilekceConversation = useCallback(async (sessionId: string) => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    if (!window.confirm('Bu konuşmayı silmek istediğinize emin misiniz?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/conversations/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        notifications.show({
          title: 'Silindi',
          message: 'Konuşma başarıyla silindi',
          color: 'green',
        });
        if (dilekceType) {
          loadDilekceConversationsList(dilekceType);
        }
      } else {
        notifications.show({
          title: 'Hata',
          message: 'Konuşma silinemedi',
          color: 'red',
        });
      }
    } catch (error) {
      console.error('Konuşma silme hatası:', error);
      notifications.show({
        title: 'Hata',
        message: 'Konuşma silinirken bir hata oluştu',
        color: 'red',
      });
    }

    setDilekceMessages([]);
    if (dilekceType) {
      loadDilekceConversationsList(dilekceType);
    }
  }, [dilekceType, loadDilekceConversationsList]);

  // Send message
  const sendDilekceMessage = useCallback(async () => {
    if (!dilekceInput.trim() || !dilekceSessionId || !tender) return;

    const userMessage = dilekceInput.trim();
    setDilekceInput('');
    setDilekceLoading(true);

    // Add user message
    setDilekceMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      const token = localStorage.getItem('auth_token');
      
      // Build context
      const context = {
        ihale: {
          baslik: tender.ihale_basligi,
          kurum: tender.kurum,
          tarih: tender.tarih,
          bedel: tender.bedel,
        },
        firma: selectedFirma ? {
          unvan: selectedFirma.unvan,
          vergi_no: selectedFirma.vergi_no,
          vergi_dairesi: selectedFirma.vergi_dairesi,
          adres: selectedFirma.adres,
          yetkili: selectedFirma.yetkili_adi,
        } : null,
        teknik_sartlar: analysisData.teknik_sartlar?.slice(0, 10),
        birim_fiyatlar: analysisData.birim_fiyatlar?.slice(0, 10),
      };

      const response = await fetch(`${API_BASE_URL}/api/ai/dilekce-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: userMessage,
          sessionId: dilekceSessionId,
          dilekceType,
          context,
        }),
      });

      const data = await response.json();

      if (data.success && data.response) {
        setDilekceMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        setDilekceContent(data.response);
      } else {
        throw new Error(data.error || 'AI yanıt vermedi');
      }
    } catch (error) {
      console.error('Dilekçe AI hatası:', error);
      notifications.show({
        title: 'Hata',
        message: 'AI yanıt veremedi, lütfen tekrar deneyin',
        color: 'red',
      });
    } finally {
      setDilekceLoading(false);
    }
  }, [dilekceInput, dilekceSessionId, tender, dilekceType, selectedFirma, analysisData]);

  // Save dilekce
  const saveDilekce = useCallback(async () => {
    if (!dilekceContent.trim() || !tender) return;

    setDilekceSaving(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/tender-dilekce`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tender_tracking_id: tender.id,
          dilekce_type: dilekceType,
          content: dilekceContent,
        }),
      });

      const data = await response.json();
      if (data.success) {
        notifications.show({
          title: 'Kaydedildi',
          message: 'Dilekçe başarıyla kaydedildi',
          color: 'green',
        });
      }
    } catch (error) {
      console.error('Dilekçe kaydetme hatası:', error);
      notifications.show({
        title: 'Hata',
        message: 'Dilekçe kaydedilemedi',
        color: 'red',
      });
    } finally {
      setDilekceSaving(false);
    }
  }, [dilekceContent, tender, dilekceType]);

  // Download dilekce
  const downloadDilekce = useCallback(() => {
    if (!dilekceContent) return;

    const blob = new Blob([dilekceContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dilekce_${dilekceType}_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [dilekceContent, dilekceType]);

  return {
    activePanel,
    setActivePanel,
    dilekceType,
    dilekceContent,
    setDilekceContent,
    dilekceMessages,
    dilekceInput,
    setDilekceInput,
    dilekceLoading,
    dilekceSessionId,
    dilekceConversations,
    showDilekceChat,
    isDilekceEditing,
    setIsDilekceEditing,
    showChatHistory,
    setShowChatHistory,
    dilekceSaving,
    dilekceEndRef,
    handleDilekceTypeChange,
    openDilekceConversation,
    startNewDilekceConversation,
    backToDilekceList,
    deleteDilekceConversation,
    sendDilekceMessage,
    saveDilekce,
    downloadDilekce,
    resetDilekce,
  };
}
