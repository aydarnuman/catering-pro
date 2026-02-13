'use client';

import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Button,
  Container,
  Divider,
  Grid,
  Group,
  Image,
  Indicator,
  Loader,
  Menu,
  Paper,
  Popover,
  RingProgress,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
  useMantineColorScheme,
} from '@mantine/core';
import { Dropzone, IMAGE_MIME_TYPE, PDF_MIME_TYPE } from '@mantine/dropzone';
import { notifications } from '@mantine/notifications';
import {
  IconArchive,
  IconBrandWhatsapp,
  IconChecks,
  IconChevronDown,
  IconChevronUp,
  IconCloudUpload,
  IconFile,
  IconLogin,
  IconMessage,
  IconMessageCircle,
  IconMicrophone,
  IconMoodSmile,
  IconPaperclip,
  IconPhone,
  IconPhoto,
  IconPlayerStop,
  IconPlugConnected,
  IconPlugOff,
  IconQrcode,
  IconRefresh,
  IconSearch,
  IconSend,
  IconSettings,
  IconTrash,
  IconUpload,
  IconUser,
  IconUsers,
  IconVideo,
  IconX,
} from '@tabler/icons-react';
import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { authFetch } from '@/lib/api';
import { API_BASE_URL } from '@/lib/config';
import { CaptionModal } from './components/CaptionModal';
import { DocumentPreviewModal } from './components/DocumentPreviewModal';
import { MediaViewerModal } from './components/MediaViewerModal';
import { MessageContent } from './components/MessageContent';
import { useVoiceRecorder } from './hooks/useVoiceRecorder';
import type { ApiChat, ApiMessage, Chat, Message } from './types';
import { commonEmojis, fileToBase64, formatRecordingTime } from './utils';

export default function WhatsAppPage() {
  const { colorScheme } = useMantineColorScheme();
  const _isDark = colorScheme === 'dark';

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedChats, setArchivedChats] = useState<Chat[]>([]);
  const [mediaViewerOpen, setMediaViewerOpen] = useState(false);
  const [viewingMedia, setViewingMedia] = useState<Message | null>(null);
  const [downloadingMedia, setDownloadingMedia] = useState<Set<string>>(new Set());
  const [savingMedia, setSavingMedia] = useState<Set<string>>(new Set());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState<string>('');
  const [sendingMedia, setSendingMedia] = useState(false);

  // Caption modal state
  const [captionModalOpen, setCaptionModalOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<{
    file: File;
    type: 'image' | 'video' | 'document';
    preview?: string;
  } | null>(null);
  const [captionText, setCaptionText] = useState('');

  // Voice recording hook
  const { isRecording, recordingTime, audioBlob, startRecording, stopRecording, cancelRecording, clearAudio } =
    useVoiceRecorder();

  // Emoji picker state
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  // Drag & Drop state
  const [isDragging, setIsDragging] = useState(false);

  // File input refs for media sending
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesViewportRef = useRef<HTMLDivElement>(null);

  // fetchChats - useCallback ile tanımla (TDZ hatası için)
  const fetchChats = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/social/whatsapp/chats`);
      const data = await res.json();
      if (data.success && data.chats) {
        const allChats: Chat[] = data.chats.map((chat: ApiChat) => ({
          id: chat.id,
          name: chat.name || chat.id.split('@')[0],
          lastMessage: chat.lastMessage || '',
          timestamp: chat.timestamp
            ? new Date(chat.timestamp * 1000).toLocaleTimeString('tr-TR', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : '',
          unreadCount: chat.unreadCount || 0,
          isGroup: chat.isGroup || false,
          isArchived: chat.archived || false,
        }));
        // Arşivlenmiş ve normal sohbetleri ayır
        const archived = allChats.filter((c: Chat) => c.isArchived);
        const active = allChats.filter((c: Chat) => !c.isArchived);
        setChats(active);
        setArchivedChats(archived);
      }
    } catch (e) {
      console.error('Failed to fetch chats:', e);
    }
  }, []);

  // Stats
  const totalChats = chats.length;
  const unreadChats = chats.filter((c) => c.unreadCount > 0).length;
  const groupChats = chats.filter((c) => c.isGroup).length;

  // Sayfa yüklendiğinde durumu kontrol et
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) return;

    const checkStatus = async () => {
      try {
        const res = await authFetch(`${API_BASE_URL}/api/social/whatsapp/status`);
        const status = await res.json();
        if (status.connected) {
          setConnected(true);
          fetchChats();
        } else if (status.hasQR) {
          // QR hazırsa göster
          const qrRes = await authFetch(`${API_BASE_URL}/api/social/whatsapp/qr`);
          const qrData = await qrRes.json();
          if (qrData.success && qrData.qr) {
            setQrCode(qrData.qr);
          }
        }
      } catch (e) {
        console.error('WhatsApp status check failed:', e);
        setConnectionError('Sunucuya bağlanılamıyor. Backend servisleri çalışmıyor olabilir.');
      }
      setLoading(false);
    };
    checkStatus();
  }, [authLoading, isAuthenticated, fetchChats]);

  // QR gösterilirken bağlantı durumunu kontrol et
  useEffect(() => {
    if (!qrCode || connected) return;

    const interval = setInterval(async () => {
      try {
        const res = await authFetch(`${API_BASE_URL}/api/social/whatsapp/status`);
        const status = await res.json();
        if (status.connected) {
          setConnected(true);
          setQrCode(null);
          fetchChats();
          notifications.show({
            title: '🎉 Bağlantı Başarılı!',
            message: 'WhatsApp hesabınız bağlandı',
            color: 'green',
          });
        }
      } catch (_e) {}
    }, 2000);

    return () => clearInterval(interval);
  }, [qrCode, connected, fetchChats]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (messagesViewportRef.current) {
        messagesViewportRef.current.scrollTop = messagesViewportRef.current.scrollHeight;
      }
    }, 100);
  };

  const fetchMessages = async (chatId: string) => {
    setLoadingMessages(true);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/api/social/whatsapp/chats/${encodeURIComponent(chatId)}/messages?limit=30`
      );
      const data = await res.json();
      if (data.success && data.messages) {
        const formattedMessages: Message[] = data.messages
          .sort((a: ApiMessage, b: ApiMessage) => (a.timestamp || 0) - (b.timestamp || 0)) // Eskiden yeniye sırala
          .map((msg: ApiMessage) => ({
            id: msg.id,
            content: msg.body || msg.caption || '',
            timestamp: msg.timestamp
              ? new Date(msg.timestamp * 1000).toLocaleTimeString('tr-TR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '',
            fromMe: msg.fromMe,
            type: msg.type || 'text',
            hasMedia: msg.hasMedia || false,
            mediaUrl: msg.mediaUrl || null,
            mimetype: msg.mimetype || null,
            filename: msg.filename || null,
            filesize: msg.filesize || null,
            caption: msg.caption || null,
          }));
        setMessages(formattedMessages);
        scrollToBottom();
      }
    } catch (e) {
      console.error('Failed to fetch messages:', e);
    }
    setLoadingMessages(false);
  };

  const markAsRead = useCallback(async (chatId: string) => {
    try {
      await authFetch(`${API_BASE_URL}/api/social/whatsapp/chats/${encodeURIComponent(chatId)}/seen`, {
        method: 'POST',
      });
      // Chat listesini güncelle
      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, unreadCount: 0 } : c)));
    } catch (e) {
      console.error('Failed to mark as read:', e);
    }
  }, []);

  const handleSelectChat = (chat: Chat) => {
    setSelectedChat(chat);
    setMessages([]); // Önce temizle
    fetchMessages(chat.id);
    // Mesajları okundu olarak işaretle
    if (chat.unreadCount > 0) {
      markAsRead(chat.id);
    }
  };

  // Seçili sohbette yeni mesajları kontrol et (her 5 saniyede)
  useEffect(() => {
    if (!selectedChat || !connected) return;

    const pollMessages = async () => {
      try {
        const res = await authFetch(
          `${API_BASE_URL}/api/social/whatsapp/chats/${encodeURIComponent(selectedChat.id)}/messages?limit=30`
        );
        const data = await res.json();
        if (data.success && data.messages) {
          const apiMessages: Message[] = data.messages
            .map((msg: ApiMessage) => ({
              id: msg.id,
              content: msg.body || msg.caption || '',
              timestamp: msg.timestamp
                ? new Date(msg.timestamp * 1000).toLocaleTimeString('tr-TR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '',
              fromMe: msg.fromMe,
              type: msg.type || 'text',
              status: 'sent' as const,
              hasMedia: msg.hasMedia || false,
              mediaUrl: msg.mediaUrl || null,
              mimetype: msg.mimetype || null,
              filename: msg.filename || null,
              filesize: msg.filesize || null,
              caption: msg.caption || null,
            }))
            .reverse();

          // Local mesajları koru (sending/failed olanlar)
          setMessages((prev) => {
            const localMsgs = prev.filter((m) => m.id.startsWith('local-') && m.status !== 'sent');
            // Eğer API'den gelen mesaj sayısı değişmişse güncelle
            const _apiIds = new Set(apiMessages.map((m) => m.id));
            const prevApiMsgs = prev.filter((m) => !m.id.startsWith('local-'));

            // Sadece yeni mesaj varsa veya ilk yüklemeyse güncelle
            if (apiMessages.length !== prevApiMsgs.length || prevApiMsgs.length === 0) {
              return [...apiMessages, ...localMsgs];
            }
            return prev;
          });
        }
      } catch (_e) {
        // Sessizce hata yakala
      }
    };

    const interval = setInterval(pollMessages, 5000);
    return () => clearInterval(interval);
  }, [selectedChat?.id, connected, selectedChat]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await authFetch(`${API_BASE_URL}/api/social/whatsapp/connect`, { method: 'POST' });

      let attempts = 0;
      const maxAttempts = 20;

      const checkQR = async () => {
        const statusRes = await authFetch(`${API_BASE_URL}/api/social/whatsapp/status`);
        const status = await statusRes.json();

        if (status.hasQR) {
          const qrRes = await authFetch(`${API_BASE_URL}/api/social/whatsapp/qr`);
          const qrData = await qrRes.json();
          if (qrData.success && qrData.qr) {
            setQrCode(qrData.qr);
            setConnecting(false);
            return;
          }
        }

        if (status.connected) {
          setConnected(true);
          setConnecting(false);
          fetchChats();
          notifications.show({
            title: 'Bağlantı Başarılı!',
            message: 'WhatsApp hesabınız bağlandı',
            color: 'green',
          });
          return;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkQR, 1000);
        } else {
          setConnecting(false);
          notifications.show({
            title: 'Zaman Aşımı',
            message: 'QR kod oluşturulamadı, tekrar deneyin',
            color: 'red',
          });
        }
      };

      setTimeout(checkQR, 2000);
    } catch (_error) {
      setConnecting(false);
      notifications.show({
        title: 'Hata',
        message: 'WhatsApp servisine bağlanılamadı',
        color: 'red',
      });
    }
  };

  const handleRefreshQR = async () => {
    setConnecting(true);
    try {
      const qrRes = await authFetch(`${API_BASE_URL}/api/social/whatsapp/qr`);
      const qrData = await qrRes.json();
      if (qrData.success && qrData.qr) {
        setQrCode(qrData.qr);
      } else {
        await authFetch(`${API_BASE_URL}/api/social/whatsapp/connect`, { method: 'POST' });
        setTimeout(async () => {
          const retryRes = await authFetch(`${API_BASE_URL}/api/social/whatsapp/qr`);
          const retryData = await retryRes.json();
          if (retryData.success && retryData.qr) {
            setQrCode(retryData.qr);
          }
        }, 3000);
      }
    } catch (_error) {
      notifications.show({ title: 'Hata', message: 'QR kod yenilenemedi', color: 'red' });
    }
    setConnecting(false);
  };

  const handleDisconnect = async () => {
    try {
      await authFetch(`${API_BASE_URL}/api/social/whatsapp/disconnect`, { method: 'POST' });
    } catch (_e) {}
    setConnected(false);
    setQrCode(null);
    setChats([]);
    setSelectedChat(null);
    notifications.show({
      title: 'Bağlantı Kesildi',
      message: 'WhatsApp bağlantısı sonlandırıldı',
      color: 'orange',
    });
  };

  // Mesaj gönderme - basit ve çalışır
  const [sending, setSending] = useState(false);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedChat || sending) return;

    const msgContent = messageInput.trim();
    const chatId = selectedChat.id;

    // Input'u hemen temizle
    setMessageInput('');
    setSending(true);

    // Mesajı hemen ekle (görsel feedback)
    const newMsg: Message = {
      id: `local-${Date.now()}`,
      content: msgContent,
      timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      fromMe: true,
      type: 'text',
      status: 'sending',
    };
    setMessages((prev) => [...prev, newMsg]);
    scrollToBottom();

    try {
      const res = await authFetch(`${API_BASE_URL}/api/social/whatsapp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message: msgContent }),
      });
      const data = await res.json();

      if (data.success) {
        // Gönderildi - status güncelle
        setMessages((prev) => prev.map((m) => (m.id === newMsg.id ? { ...m, status: 'sent' } : m)));
      } else {
        // Hata - status güncelle
        setMessages((prev) => prev.map((m) => (m.id === newMsg.id ? { ...m, status: 'failed' } : m)));
        notifications.show({
          title: 'Hata',
          message: data.error || 'Mesaj gönderilemedi',
          color: 'red',
        });
      }
    } catch (_error: unknown) {
      // Network hatası
      setMessages((prev) => prev.map((m) => (m.id === newMsg.id ? { ...m, status: 'failed' } : m)));
      notifications.show({
        title: 'Bağlantı Hatası',
        message: 'Sunucuya ulaşılamadı',
        color: 'red',
      });
    } finally {
      setSending(false);
    }
  };

  // Handle photo/video/document selection - Opens caption modal for images/videos
  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'document') => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat) return;

    // Reset input so same file can be selected again
    e.target.value = '';

    // Validate file size (max 16MB for WhatsApp)
    const maxSize = 16 * 1024 * 1024;
    if (file.size > maxSize) {
      notifications.show({
        title: 'Dosya Çok Büyük',
        message: 'Maksimum dosya boyutu 16MB olmalıdır',
        color: 'red',
      });
      return;
    }

    // For images and videos, show caption modal with preview
    if (type === 'image' || type === 'video') {
      const preview = URL.createObjectURL(file);
      setPendingFile({ file, type, preview });
      setCaptionText('');
      setCaptionModalOpen(true);
    } else {
      // For documents, send directly without caption modal
      await sendMediaFile(file, type, '');
    }
  };

  // Handle drag & drop files
  const handleDropFiles = async (files: File[]) => {
    if (!selectedChat || files.length === 0) return;

    const file = files[0];
    const maxSize = 16 * 1024 * 1024;

    if (file.size > maxSize) {
      notifications.show({
        title: 'Dosya Çok Büyük',
        message: 'Maksimum dosya boyutu 16MB olmalıdır',
        color: 'red',
      });
      return;
    }

    // Determine file type
    let type: 'image' | 'video' | 'document' = 'document';
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type.startsWith('video/')) type = 'video';

    // For images and videos, show caption modal
    if (type === 'image' || type === 'video') {
      const preview = URL.createObjectURL(file);
      setPendingFile({ file, type, preview });
      setCaptionText('');
      setCaptionModalOpen(true);
    } else {
      await sendMediaFile(file, type, '');
    }

    setIsDragging(false);
  };

  // Send media file with caption
  const sendMediaFile = async (file: File, type: 'image' | 'video' | 'document', caption: string) => {
    if (!selectedChat) return;

    const chatId = selectedChat.id;
    setSendingMedia(true);

    const tempId = `local-media-${Date.now()}`;
    const timestamp = new Date().toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const previewContent =
      type === 'image'
        ? '🖼️ Fotoğraf gönderiliyor...'
        : type === 'video'
          ? '🎬 Video gönderiliyor...'
          : `📎 ${file.name}`;

    const newMsg: Message = {
      id: tempId,
      content: previewContent,
      timestamp,
      fromMe: true,
      type: type === 'image' ? 'image' : type === 'video' ? 'video' : 'document',
      status: 'sending',
      filename: file.name,
      filesize: file.size,
      mimetype: file.type,
      caption: caption,
    };

    setMessages((prev) => [...prev, newMsg]);
    scrollToBottom();

    try {
      const base64Data = await fileToBase64(file);

      const res = await authFetch(`${API_BASE_URL}/api/social/whatsapp/send-media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          type,
          data: base64Data,
          filename: file.name,
          caption: caption,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  status: 'sent',
                  content: caption || (type === 'image' ? '' : `📎 ${file.name}`),
                  mediaUrl: base64Data,
                }
              : m
          )
        );

        notifications.show({
          title: '✅ Gönderildi',
          message: `${type === 'image' ? 'Fotoğraf' : type === 'video' ? 'Video' : 'Döküman'} başarıyla gönderildi`,
          color: 'green',
        });
      } else {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m)));
        notifications.show({
          title: 'Gönderilemedi',
          message: data.error || 'Medya gönderilemedi',
          color: 'red',
        });
      }
    } catch (_error: unknown) {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m)));
      notifications.show({
        title: 'Bağlantı Hatası',
        message: 'Sunucuya ulaşılamadı',
        color: 'red',
      });
    } finally {
      setSendingMedia(false);
    }
  };

  // Handle caption modal submit
  const handleSendWithCaption = async () => {
    if (!pendingFile) return;

    setCaptionModalOpen(false);
    await sendMediaFile(pendingFile.file, pendingFile.type, captionText);

    // Clean up preview URL
    if (pendingFile.preview) {
      URL.revokeObjectURL(pendingFile.preview);
    }
    setPendingFile(null);
    setCaptionText('');
  };

  // Cancel caption modal
  const handleCancelCaption = () => {
    if (pendingFile?.preview) {
      URL.revokeObjectURL(pendingFile.preview);
    }
    setPendingFile(null);
    setCaptionText('');
    setCaptionModalOpen(false);
  };

  const sendVoiceMessage = async () => {
    if (!audioBlob || !selectedChat) return;

    setSendingMedia(true);
    const chatId = selectedChat.id;
    const tempId = `local-voice-${Date.now()}`;
    const timestamp = new Date().toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const newMsg: Message = {
      id: tempId,
      content: `🎤 Sesli mesaj (${formatRecordingTime(recordingTime)})`,
      timestamp,
      fromMe: true,
      type: 'ptt',
      status: 'sending',
    };

    setMessages((prev) => [...prev, newMsg]);
    scrollToBottom();

    try {
      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(audioBlob);
      });
      const base64Data = await base64Promise;

      const res = await authFetch(`${API_BASE_URL}/api/social/whatsapp/send-media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          type: 'audio',
          data: base64Data,
          filename: `voice-${Date.now()}.webm`,
          caption: '',
        }),
      });

      const data = await res.json();

      if (data.success) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: 'sent', mediaUrl: base64Data } : m)));
        notifications.show({
          title: '✅ Gönderildi',
          message: 'Sesli mesaj gönderildi',
          color: 'green',
        });
      } else {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m)));
      }
    } catch (_error) {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m)));
    } finally {
      clearAudio();
      setSendingMedia(false);
    }
  };

  // Insert emoji into message input
  const insertEmoji = (emoji: string) => {
    setMessageInput((prev) => prev + emoji);
    setEmojiPickerOpen(false);
  };

  // Başarısız mesajı tekrar gönder
  const handleRetryMessage = async (msg: Message) => {
    if (!selectedChat || msg.status !== 'failed') return;

    const chatId = selectedChat.id;
    const msgId = msg.id;

    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, status: 'sending' } : m)));

    try {
      const res = await authFetch(`${API_BASE_URL}/api/social/whatsapp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message: msg.content }),
      });
      const data = await res.json();

      if (data.success) {
        setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, status: 'sent' } : m)));
      } else {
        setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, status: 'failed' } : m)));
      }
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, status: 'failed' } : m)));
    }
  };

  // Medya indirme fonksiyonu
  const downloadMedia = async (messageId: string) => {
    if (downloadingMedia.has(messageId)) return;

    setDownloadingMedia((prev) => new Set(prev).add(messageId));

    try {
      const res = await authFetch(`${API_BASE_URL}/api/social/whatsapp/media/${encodeURIComponent(messageId)}`);
      const data = await res.json();

      if (data.success && data.data) {
        // Update message with media URL
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, mediaUrl: data.data, hasMedia: true } : m))
        );
        return true;
      } else {
        // Eski mesaj uyarısı (410 Gone)
        if (res.status === 410) {
          notifications.show({
            title: '⚠️ Eski Mesaj',
            message:
              'Bu mesajın medyası artık WhatsApp sunucularında mevcut değil. Yeni mesajlar için medyayı "Kaydet" ile saklayabilirsiniz.',
            color: 'yellow',
            autoClose: 6000,
          });
        } else {
          notifications.show({
            title: 'Medya Yüklenemedi',
            message: data.error || 'Medya indirilemedi. Lütfen tekrar deneyin.',
            color: 'red',
          });
        }
        return false;
      }
    } catch (e) {
      console.error('Failed to download media:', e);
      notifications.show({
        title: 'Bağlantı Hatası',
        message: 'WhatsApp servisine bağlanılamadı. Servisin çalıştığından emin olun.',
        color: 'red',
      });
      return false;
    } finally {
      setDownloadingMedia((prev) => {
        const newSet = new Set(prev);
        newSet.delete(messageId);
        return newSet;
      });
    }
  };

  // Medyayı sunucuya kalıcı kaydetme fonksiyonu
  const saveMediaToServer = async (messageId: string) => {
    if (savingMedia.has(messageId)) return;

    setSavingMedia((prev) => new Set(prev).add(messageId));

    try {
      const res = await authFetch(`${API_BASE_URL}/api/social/whatsapp/media/${encodeURIComponent(messageId)}/save`, {
        method: 'POST',
      });
      const data = await res.json();

      if (data.success) {
        notifications.show({
          title: '✅ Kaydedildi',
          message: `${data.filename} sunucuya kaydedildi`,
          color: 'green',
        });
      } else {
        notifications.show({
          title: 'Hata',
          message: data.error || 'Kaydetme başarısız',
          color: 'red',
        });
      }
    } catch (e) {
      console.error('Failed to save media:', e);
      notifications.show({
        title: 'Hata',
        message: 'Sunucuya kaydetme başarısız',
        color: 'red',
      });
    } finally {
      setSavingMedia((prev) => {
        const newSet = new Set(prev);
        newSet.delete(messageId);
        return newSet;
      });
    }
  };

  // Medya görüntüleyici aç
  const openMediaViewer = (msg: Message) => {
    if (msg.mediaUrl) {
      setViewingMedia(msg);
      setMediaViewerOpen(true);
    } else if (msg.hasMedia) {
      // Önce indir
      downloadMedia(msg.id);
    }
  };

  const filteredChats = chats.filter((chat) => chat.name.toLowerCase().includes(searchQuery.toLowerCase()));

  // Grupları ve bireysel sohbetleri ayır
  const individualChats = filteredChats.filter((chat) => !chat.isGroup);
  const groupChatsList = filteredChats.filter((chat) => chat.isGroup);

  // Loading
  if (loading) {
    return (
      <Box
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0a0a0f 0%, #111827 50%, #0f172a 100%)',
          paddingTop: 140,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Stack align="center" gap="xl">
          <Box style={{ position: 'relative' }}>
            <RingProgress
              size={120}
              thickness={4}
              sections={[{ value: 100, color: '#25D366' }]}
              label={
                <ThemeIcon size={80} radius="xl" variant="gradient" gradient={{ from: '#25D366', to: '#128C7E' }}>
                  <IconBrandWhatsapp size={45} />
                </ThemeIcon>
              }
            />
          </Box>
          <Text c="gray.5" size="lg">
            Bağlantı kontrol ediliyor...
          </Text>
        </Stack>
      </Box>
    );
  }

  // QR Screen
  if (!connected) {
    return (
      <Box
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0a0a0f 0%, #111827 50%, #0f172a 100%)',
          paddingTop: 120,
          paddingBottom: 40,
        }}
      >
        <Container size="lg">
          <Grid gutter="xl">
            {/* Left - Info */}
            <Grid.Col span={{ base: 12, md: 5 }}>
              <Stack gap="xl" pt="xl">
                <Group>
                  <ThemeIcon size={64} radius="xl" variant="gradient" gradient={{ from: '#25D366', to: '#128C7E' }}>
                    <IconBrandWhatsapp size={36} />
                  </ThemeIcon>
                  <Box>
                    <Title order={2} c="white">
                      WhatsApp Web
                    </Title>
                    <Text c="gray.5">İş iletişiminizi yönetin</Text>
                  </Box>
                </Group>

                <Divider color="dark.5" />

                <Stack gap="md">
                  <Paper
                    p="md"
                    radius="lg"
                    style={{
                      background: 'rgba(37, 211, 102, 0.1)',
                      border: '1px solid rgba(37, 211, 102, 0.2)',
                    }}
                  >
                    <Group>
                      <ThemeIcon size={44} radius="md" color="green" variant="light">
                        <IconMessageCircle size={24} />
                      </ThemeIcon>
                      <Box>
                        <Text fw={600} c="white">
                          Mesajlaşma
                        </Text>
                        <Text size="sm" c="gray.5">
                          Müşterilerinizle anlık iletişim
                        </Text>
                      </Box>
                    </Group>
                  </Paper>

                  <Paper
                    p="md"
                    radius="lg"
                    style={{
                      background: 'rgba(59, 130, 246, 0.1)',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                    }}
                  >
                    <Group>
                      <ThemeIcon size={44} radius="md" color="blue" variant="light">
                        <IconUsers size={24} />
                      </ThemeIcon>
                      <Box>
                        <Text fw={600} c="white">
                          Grup Yönetimi
                        </Text>
                        <Text size="sm" c="gray.5">
                          Ekip ve müşteri grupları
                        </Text>
                      </Box>
                    </Group>
                  </Paper>

                  <Paper
                    p="md"
                    radius="lg"
                    style={{
                      background: 'rgba(168, 85, 247, 0.1)',
                      border: '1px solid rgba(168, 85, 247, 0.2)',
                    }}
                  >
                    <Group>
                      <ThemeIcon size={44} radius="md" color="violet" variant="light">
                        <IconPhoto size={24} />
                      </ThemeIcon>
                      <Box>
                        <Text fw={600} c="white">
                          Medya Paylaşımı
                        </Text>
                        <Text size="sm" c="gray.5">
                          Dosya ve görsel gönderimi
                        </Text>
                      </Box>
                    </Group>
                  </Paper>
                </Stack>
              </Stack>
            </Grid.Col>

            {/* Right - QR */}
            <Grid.Col span={{ base: 12, md: 7 }}>
              <Paper
                p="xl"
                radius="xl"
                style={{
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--surface-border)',
                  backdropFilter: 'blur(20px)',
                }}
              >
                <Stack align="center" gap="xl">
                  <Box ta="center">
                    <Title order={3} c="white" mb="xs">
                      Bağlantı Kur
                    </Title>
                    <Text c="gray.5">Telefonunuzdan QR kodu tarayın</Text>
                  </Box>

                  {qrCode ? (
                    <Box
                      p="lg"
                      style={{
                        background: 'white',
                        borderRadius: 20,
                        boxShadow: '0 20px 60px rgba(37, 211, 102, 0.3)',
                      }}
                    >
                      <Image src={qrCode} alt="QR" style={{ width: 260, height: 260, borderRadius: 12 }} />
                    </Box>
                  ) : (
                    <Box
                      p="xl"
                      style={{
                        width: 300,
                        height: 300,
                        background: 'linear-gradient(145deg, rgba(37,211,102,0.1) 0%, rgba(18,140,126,0.1) 100%)',
                        borderRadius: 20,
                        border: '2px dashed rgba(37,211,102,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Stack align="center" gap="md">
                        <IconQrcode size={80} color="#25D366" style={{ opacity: 0.5 }} />
                        <Text c="gray.5">QR kod oluşturmak için tıklayın</Text>
                      </Stack>
                    </Box>
                  )}

                  {qrCode ? (
                    <Stack gap="md" w="100%">
                      <Paper p="md" radius="lg" style={{ background: 'var(--surface-elevated-more)' }}>
                        <Stack gap="xs">
                          <Group gap="xs">
                            <Text c="green" fw={600}>
                              1.
                            </Text>
                            <Text c="gray.4" size="sm">
                              WhatsApp&apos;ı açın
                            </Text>
                          </Group>
                          <Group gap="xs">
                            <Text c="green" fw={600}>
                              2.
                            </Text>
                            <Text c="gray.4" size="sm">
                              Ayarlar → Bağlı Cihazlar → Cihaz Bağla
                            </Text>
                          </Group>
                          <Group gap="xs">
                            <Text c="green" fw={600}>
                              3.
                            </Text>
                            <Text c="gray.4" size="sm">
                              QR kodu telefonunuzla tarayın
                            </Text>
                          </Group>
                        </Stack>
                      </Paper>
                      <Group grow>
                        <Button
                          variant="light"
                          color="gray"
                          size="lg"
                          radius="xl"
                          leftSection={<IconRefresh size={20} />}
                          onClick={handleRefreshQR}
                          loading={connecting}
                        >
                          Yenile
                        </Button>
                      </Group>
                    </Stack>
                  ) : connectionError ? (
                    <Stack gap="md" w="100%" maw={320} align="center">
                      {/* Bağlantı hatası gösterimi */}
                      <ThemeIcon size={80} radius="xl" color="red" variant="light">
                        <IconPlugOff size={40} />
                      </ThemeIcon>
                      <Stack gap="xs" ta="center">
                        <Text c="red.4" fw={600} size="lg">
                          Bağlantı Hatası
                        </Text>
                        <Text c="gray.4" size="sm">
                          {connectionError}
                        </Text>
                      </Stack>
                      <Button
                        size="lg"
                        radius="xl"
                        variant="light"
                        color="red"
                        leftSection={<IconRefresh size={20} />}
                        onClick={() => {
                          setConnectionError(null);
                          setLoading(true);
                          window.location.reload();
                        }}
                        fullWidth
                      >
                        Tekrar Dene
                      </Button>
                      <Text c="gray.6" size="xs" ta="center">
                        Backend servisleri çalıştığından emin olun (port 3001 ve 3002)
                      </Text>
                    </Stack>
                  ) : (
                    <Stack gap="md" w="100%" maw={320}>
                      {/* Mevcut session ile giriş yap */}
                      <Button
                        size="lg"
                        radius="xl"
                        variant="gradient"
                        gradient={{ from: '#25D366', to: '#128C7E' }}
                        leftSection={<IconLogin size={20} />}
                        onClick={handleConnect}
                        loading={connecting}
                        fullWidth
                      >
                        Giriş Yap
                      </Button>

                      {/* Yeni QR kod oluştur */}
                      <Button
                        size="lg"
                        radius="xl"
                        variant="light"
                        color="green"
                        leftSection={<IconQrcode size={20} />}
                        onClick={handleRefreshQR}
                        loading={connecting}
                        fullWidth
                      >
                        Yeni QR Kod Oluştur
                      </Button>

                      <Text size="xs" c="gray.6" ta="center">
                        Daha önce bağlandıysanız &quot;Giriş Yap&quot; ile otomatik bağlanın.
                        <br />
                        İlk kez bağlanıyorsanız &quot;Yeni QR Kod Oluştur&quot; seçin.
                      </Text>
                    </Stack>
                  )}
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>
        </Container>
      </Box>
    );
  }

  // Connected - Chat Interface
  return (
    <Box
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0a0f 0%, #111827 50%, #0f172a 100%)',
        paddingTop: 100,
        paddingBottom: 16,
      }}
    >
      <Container size="xl">
        {/* Stats Header */}
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mb="md">
          <Paper
            p="md"
            radius="lg"
            style={{
              background: 'linear-gradient(145deg, rgba(37,211,102,0.15) 0%, rgba(37,211,102,0.05) 100%)',
              border: '1px solid rgba(37,211,102,0.2)',
            }}
          >
            <Group justify="space-between">
              <Box>
                <Text size="2rem" fw={800} c="white">
                  {totalChats}
                </Text>
                <Text size="xs" c="gray.5">
                  Toplam Sohbet
                </Text>
              </Box>
              <ThemeIcon size={44} radius="md" color="green" variant="light">
                <IconMessageCircle size={24} />
              </ThemeIcon>
            </Group>
          </Paper>

          <Paper
            p="md"
            radius="lg"
            style={{
              background: 'linear-gradient(145deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.05) 100%)',
              border: '1px solid rgba(239,68,68,0.2)',
            }}
          >
            <Group justify="space-between">
              <Box>
                <Text size="2rem" fw={800} c="white">
                  {unreadChats}
                </Text>
                <Text size="xs" c="gray.5">
                  Okunmamış
                </Text>
              </Box>
              <ThemeIcon size={44} radius="md" color="red" variant="light">
                <IconMessage size={24} />
              </ThemeIcon>
            </Group>
          </Paper>

          <Paper
            p="md"
            radius="lg"
            style={{
              background: 'linear-gradient(145deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.05) 100%)',
              border: '1px solid rgba(59,130,246,0.2)',
            }}
          >
            <Group justify="space-between">
              <Box>
                <Text size="2rem" fw={800} c="white">
                  {groupChats}
                </Text>
                <Text size="xs" c="gray.5">
                  Grup
                </Text>
              </Box>
              <ThemeIcon size={44} radius="md" color="blue" variant="light">
                <IconUsers size={24} />
              </ThemeIcon>
            </Group>
          </Paper>

          <Paper
            p="md"
            radius="lg"
            style={{
              background: 'linear-gradient(145deg, rgba(168,85,247,0.15) 0%, rgba(168,85,247,0.05) 100%)',
              border: '1px solid rgba(168,85,247,0.2)',
            }}
          >
            <Group justify="space-between">
              <Box>
                <Badge color="green" size="lg" leftSection={<IconPlugConnected size={12} />}>
                  Bağlı
                </Badge>
                <Text size="xs" c="gray.5" mt={4}>
                  Durum
                </Text>
              </Box>
              <ActionIcon size={44} radius="md" color="red" variant="light" onClick={handleDisconnect}>
                <IconPlugOff size={22} />
              </ActionIcon>
            </Group>
          </Paper>
        </SimpleGrid>

        {/* Chat Interface */}
        <Paper
          radius="xl"
          style={{
            background: 'var(--surface-elevated)',
            border: '1px solid var(--surface-border)',
            overflow: 'hidden',
            height: 'calc(100vh - 250px)',
            minHeight: 400,
          }}
        >
          <Grid gutter={0} h="100%" styles={{ inner: { height: '100%' } }}>
            {/* Chat List */}
            <Grid.Col
              span={{ base: 12, md: 4 }}
              h="100%"
              style={{
                borderRight: '1px solid var(--surface-border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Search Header */}
              <Box p="md" style={{ borderBottom: '1px solid var(--surface-border-subtle)' }}>
                <Group justify="space-between" mb="sm">
                  <Group gap="xs">
                    <IconBrandWhatsapp size={24} color="#25D366" />
                    <Text fw={700} c="white">
                      Sohbetler
                    </Text>
                  </Group>
                  <ActionIcon variant="subtle" color="gray" onClick={fetchChats}>
                    <IconRefresh size={18} />
                  </ActionIcon>
                </Group>
                <TextInput
                  placeholder="Sohbet ara..."
                  leftSection={<IconSearch size={16} />}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  styles={{
                    input: {
                      background: 'var(--surface-elevated)',
                      border: '1px solid var(--surface-border)',
                      color: 'white',
                      '&::placeholder': { color: 'rgba(255,255,255,0.4)' },
                    },
                  }}
                  radius="lg"
                />
              </Box>

              {/* Chat List */}
              <ScrollArea style={{ flex: 1, minHeight: 0 }}>
                {/* Arşiv Bölümü */}
                {archivedChats.length > 0 && (
                  <Box
                    p="md"
                    onClick={() => setShowArchived(!showArchived)}
                    style={{
                      cursor: 'pointer',
                      background: 'var(--surface-elevated-more)',
                      borderBottom: '1px solid var(--surface-border-subtle)',
                    }}
                  >
                    <Group justify="space-between">
                      <Group gap="sm">
                        <ThemeIcon size={36} radius="md" color="gray" variant="light">
                          <IconArchive size={18} />
                        </ThemeIcon>
                        <Box>
                          <Text fw={500} c="gray.4">
                            Arşivlenmiş
                          </Text>
                          <Text size="xs" c="gray.6">
                            {archivedChats.length} sohbet
                          </Text>
                        </Box>
                      </Group>
                      {showArchived ? (
                        <IconChevronUp size={18} color="gray" />
                      ) : (
                        <IconChevronDown size={18} color="gray" />
                      )}
                    </Group>
                  </Box>
                )}

                {/* Arşivlenmiş Sohbetler */}
                {showArchived &&
                  archivedChats.map((chat) => (
                    <Box
                      key={chat.id}
                      p="md"
                      onClick={() => handleSelectChat(chat)}
                      style={{
                        cursor: 'pointer',
                        background:
                          selectedChat?.id === chat.id
                            ? 'linear-gradient(90deg, rgba(107,114,128,0.15) 0%, transparent 100%)'
                            : 'var(--surface-elevated-more)',
                        borderBottom: '1px solid var(--surface-border-subtle)',
                        borderLeft: selectedChat?.id === chat.id ? '3px solid #6B7280' : '3px solid transparent',
                      }}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <Group wrap="nowrap" style={{ flex: 1, overflow: 'hidden' }}>
                          <Avatar color="gray" radius="xl" size={44}>
                            {chat.name[0]?.toUpperCase()}
                          </Avatar>
                          <Box style={{ flex: 1, overflow: 'hidden' }}>
                            <Text fw={500} c="gray.4" truncate>
                              {chat.name}
                            </Text>
                            <Text size="sm" c="gray.6" truncate>
                              {chat.lastMessage || 'Arşivlenmiş'}
                            </Text>
                          </Box>
                        </Group>
                      </Group>
                    </Box>
                  ))}

                {filteredChats.length === 0 ? (
                  <Box p="xl" ta="center">
                    <IconMessage size={48} color="gray" style={{ opacity: 0.3 }} />
                    <Text c="gray.6" mt="md">
                      Sohbet bulunamadı
                    </Text>
                  </Box>
                ) : (
                  <>
                    {/* Bireysel Sohbetler */}
                    {individualChats.length > 0 && (
                      <>
                        <Box px="sm" py="xs" style={{ background: 'rgba(37,211,102,0.1)' }}>
                          <Group gap="xs">
                            <IconUser size={14} color="#25D366" />
                            <Text size="xs" fw={600} c="green">
                              Sohbetler ({individualChats.length})
                            </Text>
                          </Group>
                        </Box>
                        {individualChats.map((chat) => (
                          <Box
                            key={chat.id}
                            px="sm"
                            py="xs"
                            onClick={() => handleSelectChat(chat)}
                            style={{
                              cursor: 'pointer',
                              background:
                                selectedChat?.id === chat.id
                                  ? 'linear-gradient(90deg, rgba(37,211,102,0.15) 0%, transparent 100%)'
                                  : 'transparent',
                              borderBottom: '1px solid var(--surface-border-subtle)',
                              borderLeft: selectedChat?.id === chat.id ? '3px solid #25D366' : '3px solid transparent',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            <Group justify="space-between" wrap="nowrap" gap="xs">
                              <Group wrap="nowrap" style={{ flex: 1, overflow: 'hidden' }} gap="sm">
                                <Indicator color="green" size={8} offset={3} disabled={chat.unreadCount === 0}>
                                  <Avatar
                                    color="green"
                                    radius="xl"
                                    size={40}
                                    style={{
                                      background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                                    }}
                                  >
                                    {chat.name[0]?.toUpperCase()}
                                  </Avatar>
                                </Indicator>
                                <Box style={{ flex: 1, overflow: 'hidden' }}>
                                  <Group justify="space-between" wrap="nowrap">
                                    <Text size="sm" fw={500} c="white" truncate>
                                      {chat.name}
                                    </Text>
                                    <Text size="xs" c="gray.6">
                                      {chat.timestamp}
                                    </Text>
                                  </Group>
                                  <Text size="xs" c="gray.5" truncate>
                                    {chat.lastMessage || 'Mesaj yok'}
                                  </Text>
                                </Box>
                              </Group>
                              {chat.unreadCount > 0 && (
                                <Badge size="xs" circle color="green" style={{ minWidth: 18 }}>
                                  {chat.unreadCount}
                                </Badge>
                              )}
                            </Group>
                          </Box>
                        ))}
                      </>
                    )}

                    {/* Gruplar */}
                    {groupChatsList.length > 0 && (
                      <>
                        <Box
                          px="sm"
                          py="xs"
                          style={{
                            background: 'rgba(59,130,246,0.1)',
                            marginTop: individualChats.length > 0 ? 8 : 0,
                          }}
                        >
                          <Group gap="xs">
                            <IconUsers size={14} color="#3B82F6" />
                            <Text size="xs" fw={600} c="blue">
                              Gruplar ({groupChatsList.length})
                            </Text>
                          </Group>
                        </Box>
                        {groupChatsList.map((chat) => (
                          <Box
                            key={chat.id}
                            px="sm"
                            py="xs"
                            onClick={() => handleSelectChat(chat)}
                            style={{
                              cursor: 'pointer',
                              background:
                                selectedChat?.id === chat.id
                                  ? 'linear-gradient(90deg, rgba(59,130,246,0.15) 0%, transparent 100%)'
                                  : 'transparent',
                              borderBottom: '1px solid var(--surface-border-subtle)',
                              borderLeft: selectedChat?.id === chat.id ? '3px solid #3B82F6' : '3px solid transparent',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            <Group justify="space-between" wrap="nowrap" gap="xs">
                              <Group wrap="nowrap" style={{ flex: 1, overflow: 'hidden' }} gap="sm">
                                <Indicator color="blue" size={8} offset={3} disabled={chat.unreadCount === 0}>
                                  <Avatar
                                    color="blue"
                                    radius="xl"
                                    size={40}
                                    style={{
                                      background: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)',
                                    }}
                                  >
                                    <IconUsers size={18} />
                                  </Avatar>
                                </Indicator>
                                <Box style={{ flex: 1, overflow: 'hidden' }}>
                                  <Group justify="space-between" wrap="nowrap">
                                    <Text size="sm" fw={500} c="white" truncate>
                                      {chat.name}
                                    </Text>
                                    <Text size="xs" c="gray.6">
                                      {chat.timestamp}
                                    </Text>
                                  </Group>
                                  <Text size="xs" c="gray.5" truncate>
                                    {chat.lastMessage || 'Mesaj yok'}
                                  </Text>
                                </Box>
                              </Group>
                              {chat.unreadCount > 0 && (
                                <Badge size="xs" circle color="blue" style={{ minWidth: 18 }}>
                                  {chat.unreadCount}
                                </Badge>
                              )}
                            </Group>
                          </Box>
                        ))}
                      </>
                    )}
                  </>
                )}
              </ScrollArea>
            </Grid.Col>

            {/* Messages */}
            <Grid.Col
              span={{ base: 12, md: 8 }}
              h="100%"
              style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            >
              {selectedChat ? (
                <Box
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    overflow: 'hidden',
                  }}
                >
                  {/* Chat Header */}
                  <Box
                    p="md"
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      background: 'rgba(0,0,0,0.2)',
                      flexShrink: 0,
                    }}
                  >
                    <Group justify="space-between">
                      <Group>
                        <Avatar
                          color="green"
                          radius="xl"
                          size={44}
                          style={{
                            background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                          }}
                        >
                          {selectedChat.name[0]?.toUpperCase()}
                        </Avatar>
                        <Box>
                          <Text fw={600} c="white">
                            {selectedChat.name}
                          </Text>
                          <Group gap={4}>
                            <Box
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: '#25D366',
                              }}
                            />
                            <Text size="xs" c="green">
                              Çevrimiçi
                            </Text>
                          </Group>
                        </Box>
                      </Group>
                      <Group gap="xs">
                        <Tooltip label="Mesajları Yenile">
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            size="lg"
                            onClick={() => selectedChat && fetchMessages(selectedChat.id)}
                            loading={loadingMessages}
                          >
                            <IconRefresh size={20} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Sesli Arama">
                          <ActionIcon variant="subtle" color="gray" size="lg">
                            <IconPhone size={20} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Görüntülü Arama">
                          <ActionIcon variant="subtle" color="gray" size="lg">
                            <IconVideo size={20} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Ayarlar">
                          <ActionIcon variant="subtle" color="gray" size="lg">
                            <IconSettings size={20} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Group>
                  </Box>

                  {/* Messages with Drag & Drop */}
                  <Dropzone.FullScreen
                    active={isDragging}
                    onDrop={handleDropFiles}
                    onDragEnter={() => setIsDragging(true)}
                    onDragLeave={() => setIsDragging(false)}
                    accept={[
                      ...IMAGE_MIME_TYPE,
                      ...PDF_MIME_TYPE,
                      'video/*',
                      'application/msword',
                      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                      'application/vnd.ms-excel',
                      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    ]}
                  >
                    <Group justify="center" gap="xl" mih={220} style={{ pointerEvents: 'none' }}>
                      <Dropzone.Accept>
                        <IconCloudUpload size={80} stroke={1.5} color="#25D366" />
                      </Dropzone.Accept>
                      <Dropzone.Reject>
                        <IconX size={80} stroke={1.5} color="#EF4444" />
                      </Dropzone.Reject>
                      <Dropzone.Idle>
                        <IconUpload size={80} stroke={1.5} color="#6B7280" />
                      </Dropzone.Idle>

                      <Stack gap="xs" ta="center">
                        <Text size="xl" c="white" fw={600}>
                          Dosyayı buraya bırakın
                        </Text>
                        <Text size="sm" c="gray.5">
                          Fotoğraf, video veya döküman gönderebilirsiniz
                        </Text>
                      </Stack>
                    </Group>
                  </Dropzone.FullScreen>

                  <ScrollArea style={{ flex: 1, minHeight: 0 }} viewportRef={messagesViewportRef} p="md">
                    {loadingMessages ? (
                      <Stack align="center" justify="center" h="100%">
                        <Loader color="green" />
                      </Stack>
                    ) : messages.length === 0 ? (
                      <Stack align="center" justify="center" h="100%">
                        <IconMessage size={64} color="gray" style={{ opacity: 0.2 }} />
                        <Text c="gray.6">Henüz mesaj yok</Text>
                      </Stack>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {messages.map((msg) => {
                          const Wrapper = msg.status === 'failed' ? 'button' : 'div';
                          const wrapperProps =
                            msg.status === 'failed'
                              ? { type: 'button' as const, onClick: () => handleRetryMessage(msg) }
                              : {};
                          return (
                            <Wrapper
                              key={msg.id}
                              style={{
                                textAlign: msg.fromMe ? 'right' : 'left',
                                cursor: msg.status === 'failed' ? 'pointer' : 'default',
                                border: 'none',
                                background: 'none',
                                padding: 0,
                                margin: 0,
                                font: 'inherit',
                                width: '100%',
                              }}
                              {...wrapperProps}
                            >
                              <div
                                style={{
                                  display: 'inline-block',
                                  maxWidth: '75%',
                                  padding: msg.type === 'sticker' ? '4px' : '8px 12px',
                                  background:
                                    msg.type === 'sticker'
                                      ? 'transparent'
                                      : msg.status === 'failed'
                                        ? '#7f1d1d'
                                        : msg.fromMe
                                          ? '#005C4B'
                                          : 'rgba(255,255,255,0.08)',
                                  borderRadius: 10,
                                  borderBottomRightRadius: msg.fromMe ? 3 : 10,
                                  borderBottomLeftRadius: msg.fromMe ? 10 : 3,
                                  textAlign: 'left',
                                  opacity: msg.status === 'sending' ? 0.7 : 1,
                                }}
                              >
                                <MessageContent
                                  msg={msg}
                                  messages={messages}
                                  downloadingMedia={downloadingMedia}
                                  savingMedia={savingMedia}
                                  onDownloadMedia={downloadMedia}
                                  onSaveMedia={saveMediaToServer}
                                  onOpenMediaViewer={openMediaViewer}
                                  onSetPreviewUrl={setPreviewUrl}
                                  onSetPreviewFilename={setPreviewFilename}
                                />
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    alignItems: 'center',
                                    gap: 4,
                                    marginTop: 4,
                                    opacity: 0.6,
                                  }}
                                >
                                  <span style={{ fontSize: 10, color: msg.fromMe ? 'white' : '#999' }}>
                                    {msg.timestamp}
                                  </span>
                                  {msg.fromMe &&
                                    (msg.status === 'sending' ? (
                                      <Loader size={10} color="white" />
                                    ) : msg.status === 'failed' ? (
                                      <IconX size={12} color="#ef4444" />
                                    ) : (
                                      <IconChecks size={12} color="white" />
                                    ))}
                                </div>
                                {msg.status === 'failed' && (
                                  <div
                                    style={{
                                      textAlign: 'center',
                                      marginTop: 4,
                                      fontSize: 11,
                                      color: '#fca5a5',
                                    }}
                                  >
                                    ⟳ Tekrar dene
                                  </div>
                                )}
                              </div>
                            </Wrapper>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </ScrollArea>

                  {/* Message Input */}
                  <Box
                    p="md"
                    style={{
                      borderTop: '1px solid rgba(255,255,255,0.06)',
                      background: 'rgba(0,0,0,0.2)',
                      flexShrink: 0,
                    }}
                  >
                    {/* Voice Recording UI */}
                    {isRecording || audioBlob ? (
                      <Group gap="sm" justify="space-between">
                        <Group gap="sm">
                          <ActionIcon size={44} radius="xl" variant="light" color="red" onClick={cancelRecording}>
                            <IconTrash size={22} />
                          </ActionIcon>

                          {isRecording ? (
                            <Group gap="xs">
                              <Box
                                style={{
                                  width: 12,
                                  height: 12,
                                  borderRadius: '50%',
                                  background: '#EF4444',
                                  animation: 'pulse 1s infinite',
                                }}
                              />
                              <Text c="white" fw={500} size="lg">
                                {formatRecordingTime(recordingTime)}
                              </Text>
                              <Text c="gray.5" size="sm">
                                Kayıt yapılıyor...
                              </Text>
                            </Group>
                          ) : (
                            <Group gap="xs">
                              <IconMicrophone size={20} color="#25D366" />
                              <Text c="white" size="sm">
                                Sesli mesaj hazır ({formatRecordingTime(recordingTime)})
                              </Text>
                            </Group>
                          )}
                        </Group>

                        {isRecording ? (
                          <ActionIcon
                            size={44}
                            radius="xl"
                            variant="gradient"
                            gradient={{ from: '#EF4444', to: '#DC2626' }}
                            onClick={stopRecording}
                          >
                            <IconPlayerStop size={22} />
                          </ActionIcon>
                        ) : (
                          <ActionIcon
                            size={44}
                            radius="xl"
                            variant="gradient"
                            gradient={{ from: '#25D366', to: '#128C7E' }}
                            onClick={sendVoiceMessage}
                            loading={sendingMedia}
                          >
                            <IconSend size={22} />
                          </ActionIcon>
                        )}
                      </Group>
                    ) : (
                      <Group gap="sm">
                        {/* Emoji Picker */}
                        <Popover
                          opened={emojiPickerOpen}
                          onChange={setEmojiPickerOpen}
                          position="top-start"
                          width={320}
                          shadow="xl"
                        >
                          <Popover.Target>
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              size="lg"
                              onClick={() => setEmojiPickerOpen((o) => !o)}
                            >
                              <IconMoodSmile size={22} />
                            </ActionIcon>
                          </Popover.Target>
                          <Popover.Dropdown
                            style={{
                              background: 'linear-gradient(145deg, #1a1f2e 0%, #0f1419 100%)',
                              border: '1px solid rgba(255,255,255,0.1)',
                            }}
                          >
                            <Text size="xs" c="gray.5" mb="xs">
                              Sık Kullanılan Emojiler
                            </Text>
                            <SimpleGrid cols={8} spacing={4}>
                              {commonEmojis.map((emoji) => (
                                <ActionIcon
                                  key={emoji}
                                  variant="subtle"
                                  color="gray"
                                  size="lg"
                                  onClick={() => insertEmoji(emoji)}
                                  style={{ fontSize: 20 }}
                                >
                                  {emoji}
                                </ActionIcon>
                              ))}
                            </SimpleGrid>
                          </Popover.Dropdown>
                        </Popover>

                        {/* Hidden file inputs */}
                        <input
                          type="file"
                          ref={photoInputRef}
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => handleFileSelect(e, 'image')}
                        />
                        <input
                          type="file"
                          ref={videoInputRef}
                          accept="video/*"
                          style={{ display: 'none' }}
                          onChange={(e) => handleFileSelect(e, 'video')}
                        />
                        <input
                          type="file"
                          ref={documentInputRef}
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
                          style={{ display: 'none' }}
                          onChange={(e) => handleFileSelect(e, 'document')}
                        />

                        {/* File Attachment Menu */}
                        <Menu shadow="md" width={200}>
                          <Menu.Target>
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              size="lg"
                              loading={sendingMedia}
                              disabled={sendingMedia}
                            >
                              <IconPaperclip size={22} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Label>Dosya Gönder</Menu.Label>
                            <Menu.Item
                              leftSection={<IconPhoto size={16} color="#25D366" />}
                              onClick={() => photoInputRef.current?.click()}
                              disabled={sendingMedia}
                            >
                              Fotoğraf
                            </Menu.Item>
                            <Menu.Item
                              leftSection={<IconVideo size={16} color="#3B82F6" />}
                              onClick={() => videoInputRef.current?.click()}
                              disabled={sendingMedia}
                            >
                              Video
                            </Menu.Item>
                            <Menu.Item
                              leftSection={<IconFile size={16} color="#EF4444" />}
                              onClick={() => documentInputRef.current?.click()}
                              disabled={sendingMedia}
                            >
                              Döküman
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>

                        {/* Message Input */}
                        <Textarea
                          placeholder="Mesajınızı yazın..."
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          style={{ flex: 1 }}
                          autosize
                          minRows={1}
                          maxRows={4}
                          radius="xl"
                          styles={{
                            input: {
                              background: 'var(--surface-elevated)',
                              border: '1px solid var(--surface-border)',
                              color: 'white',
                              '&::placeholder': { color: 'rgba(255,255,255,0.4)' },
                            },
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                        />

                        {/* Send or Record Button */}
                        {messageInput.trim() ? (
                          <ActionIcon
                            size={44}
                            radius="xl"
                            variant="gradient"
                            gradient={{ from: '#25D366', to: '#128C7E' }}
                            onClick={handleSendMessage}
                            loading={sending}
                            disabled={sending}
                          >
                            <IconSend size={22} />
                          </ActionIcon>
                        ) : (
                          <Tooltip label="Sesli Mesaj Kaydet" position="top">
                            <ActionIcon size={44} radius="xl" variant="light" color="green" onClick={startRecording}>
                              <IconMicrophone size={22} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Group>
                    )}
                  </Box>
                </Box>
              ) : (
                <Box
                  style={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 300,
                  }}
                >
                  <Stack align="center" gap="lg">
                    <Box
                      style={{
                        width: 120,
                        height: 120,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(37,211,102,0.2) 0%, rgba(18,140,126,0.2) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid rgba(37,211,102,0.3)',
                      }}
                    >
                      <IconBrandWhatsapp size={56} color="#25D366" />
                    </Box>
                    <Stack align="center" gap="xs">
                      <Text size="xl" fw={600} c="white">
                        WhatsApp Web
                      </Text>
                      <Text size="sm" c="gray.5" ta="center" maw={300} lh={1.6}>
                        Sohbet listesinden bir kişi seçerek mesajlaşmaya başlayın
                      </Text>
                    </Stack>
                  </Stack>
                </Box>
              )}
            </Grid.Col>
          </Grid>
        </Paper>
      </Container>

      {/* Media Viewer Modal */}
      <MediaViewerModal
        opened={mediaViewerOpen}
        onClose={() => {
          setMediaViewerOpen(false);
          setViewingMedia(null);
        }}
        viewingMedia={viewingMedia}
      />

      {/* Caption Modal - Fotoğraf/Video gönderirken açıklama ekleme */}
      <CaptionModal
        opened={captionModalOpen}
        pendingFile={pendingFile}
        captionText={captionText}
        sendingMedia={sendingMedia}
        onCaptionChange={setCaptionText}
        onSend={handleSendWithCaption}
        onCancel={handleCancelCaption}
      />

      {/* Döküman Önizleme Modal - DocViewer ile tüm formatları destekler */}
      <DocumentPreviewModal
        previewUrl={previewUrl}
        previewFilename={previewFilename}
        onClose={() => {
          setPreviewUrl(null);
          setPreviewFilename('');
        }}
      />
    </Box>
  );
}
