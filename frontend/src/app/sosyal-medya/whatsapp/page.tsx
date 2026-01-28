'use client';

import DocViewer, { DocViewerRenderers } from '@cyntler/react-doc-viewer';
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
  Indicator,
  Loader,
  Menu,
  Modal,
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
  IconDeviceFloppy,
  IconDownload,
  IconEye,
  IconFile,
  IconFileTypeDoc,
  IconFileTypePdf,
  IconFileTypeXls,
  IconFileTypeZip,
  IconLogin,
  IconMessage,
  IconMessageCircle,
  IconMicrophone,
  IconMoodSmile,
  IconPaperclip,
  IconPhone,
  IconPhoto,
  IconPlayerPlay,
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
import mammoth from 'mammoth';
import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { authFetch } from '@/lib/api';
import { API_BASE_URL } from '@/lib/config';

interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  isGroup: boolean;
  isArchived?: boolean;
}

interface Message {
  id: string;
  content: string;
  timestamp: string;
  fromMe: boolean;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'ptt';
  status?: 'sending' | 'sent' | 'failed';
  // Media properties
  hasMedia?: boolean;
  mediaUrl?: string;
  mimetype?: string;
  filename?: string;
  filesize?: number;
  caption?: string;
  isDownloading?: boolean;
}

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
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState<string>('');
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sendingMedia, setSendingMedia] = useState(false);

  // Caption modal state
  const [captionModalOpen, setCaptionModalOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<{
    file: File;
    type: 'image' | 'video' | 'document';
    preview?: string;
  } | null>(null);
  const [captionText, setCaptionText] = useState('');

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Emoji picker state
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  // Drag & Drop state
  const [isDragging, setIsDragging] = useState(false);

  // File input refs for media sending
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  // Common emojis for quick access
  const commonEmojis = [
    '😀',
    '😂',
    '🥰',
    '😍',
    '🤩',
    '😎',
    '🤔',
    '😅',
    '👍',
    '👎',
    '👏',
    '🙏',
    '💪',
    '🤝',
    '✌️',
    '👋',
    '❤️',
    '💕',
    '💯',
    '🔥',
    '⭐',
    '✨',
    '🎉',
    '🎊',
    '✅',
    '❌',
    '⚠️',
    '📌',
    '📎',
    '📝',
    '📅',
    '⏰',
    '🍽️',
    '🍴',
    '🥗',
    '🍲',
    '🍛',
    '🥘',
    '🍜',
    '🍝',
  ];

  // Base64 data URL'i Blob URL'e çevir (DocViewer için gerekli)
  const convertToBlob = useCallback(async (dataUrl: string, _filename: string) => {
    try {
      // Base64 data URL'i parse et
      const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
      if (!matches) {
        console.log('Not a base64 data URL, using directly');
        return dataUrl;
      }

      const mimeType = matches[1];
      const base64Data = matches[2];

      // Base64'ü binary'e çevir
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      // Blob oluştur
      const blob = new Blob([byteArray], { type: mimeType });

      // Blob URL oluştur
      const blobUrl = URL.createObjectURL(blob);
      console.log('Created blob URL:', blobUrl);
      return blobUrl;
    } catch (error) {
      console.error('Blob conversion error:', error);
      return dataUrl;
    }
  }, []);

  // Preview açıldığında blob URL oluştur ve DOCX için HTML'e çevir
  useEffect(() => {
    const processPreview = async () => {
      if (!previewUrl) return;

      setPreviewLoading(true);
      setDocxHtml(null);

      try {
        // DOCX dosyası için Mammoth.js ile HTML'e çevir
        if (previewFilename.match(/\.docx?$/i)) {
          console.log('Processing DOCX with Mammoth.js...');

          // Base64'ü ArrayBuffer'a çevir
          const matches = previewUrl.match(/^data:(.+);base64,(.+)$/);
          if (matches) {
            const base64Data = matches[2];
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const arrayBuffer = bytes.buffer;

            // Mammoth.js ile HTML'e çevir
            const result = await mammoth.convertToHtml({ arrayBuffer });
            console.log('Mammoth conversion successful');
            setDocxHtml(result.value);
          }
        } else {
          // Diğer dosyalar için blob URL oluştur
          if (!previewUrl.startsWith('blob:')) {
            const blobUrl = await convertToBlob(previewUrl, previewFilename);
            setPreviewBlobUrl(blobUrl);
          } else {
            setPreviewBlobUrl(previewUrl);
          }
        }
      } catch (error) {
        console.error('Preview processing error:', error);
      } finally {
        setPreviewLoading(false);
      }
    };

    processPreview();

    // Cleanup - modal kapandığında blob URL'i temizle
    return () => {
      if (previewBlobUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [previewUrl, previewFilename, convertToBlob, previewBlobUrl]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesViewportRef = useRef<HTMLDivElement>(null);

  // fetchChats - useCallback ile tanımla (TDZ hatası için)
  const fetchChats = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/social/whatsapp/chats`);
      const data = await res.json();
      if (data.success && data.chats) {
        const allChats: Chat[] = data.chats.map((chat: any) => ({
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
        const archived = allChats.filter((c: any) => c.isArchived);
        const active = allChats.filter((c: any) => !c.isArchived);
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
          .sort((a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0)) // Eskiden yeniye sırala
          .map((msg: any) => ({
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
      await authFetch(
        `${API_BASE_URL}/api/social/whatsapp/chats/${encodeURIComponent(chatId)}/seen`,
        {
          method: 'POST',
        }
      );
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
            .map((msg: any) => ({
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
        setMessages((prev) =>
          prev.map((m) => (m.id === newMsg.id ? { ...m, status: 'failed' } : m))
        );
        notifications.show({
          title: 'Hata',
          message: data.error || 'Mesaj gönderilemedi',
          color: 'red',
        });
      }
    } catch (_error: any) {
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

  // File to Base64 converter
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // Handle photo/video/document selection - Opens caption modal for images/videos
  const handleFileSelect = async (
    e: ChangeEvent<HTMLInputElement>,
    type: 'image' | 'video' | 'document'
  ) => {
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
  const sendMediaFile = async (
    file: File,
    type: 'image' | 'video' | 'document',
    caption: string
  ) => {
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
    } catch (_error: any) {
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

  // ============ VOICE RECORDING ============
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Mikrofon erişimi hatası:', error);
      notifications.show({
        title: 'Mikrofon Hatası',
        message: 'Mikrofon erişimi sağlanamadı. Lütfen tarayıcı izinlerini kontrol edin.',
        color: 'red',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    setIsRecording(false);
    setAudioBlob(null);
    setRecordingTime(0);

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
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
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: 'sent', mediaUrl: base64Data } : m))
        );
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
      setAudioBlob(null);
      setRecordingTime(0);
      setSendingMedia(false);
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
      const res = await authFetch(
        `${API_BASE_URL}/api/social/whatsapp/media/${encodeURIComponent(messageId)}`
      );
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
      const res = await authFetch(
        `${API_BASE_URL}/api/social/whatsapp/media/${encodeURIComponent(messageId)}/save`,
        {
          method: 'POST',
        }
      );
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

  // Döküman önizleme fonksiyonu
  const _previewDocument = async (msg: Message) => {
    // Önce medyayı indir
    if (!msg.mediaUrl) {
      await downloadMedia(msg.id);
      // State güncellenene kadar bekle
      return;
    }

    // PDF için iframe, resim için img
    setPreviewUrl(msg.mediaUrl);
    setPreviewFilename(msg.filename || 'Döküman');
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

  // Dosya ikonu döndür
  const _getFileIcon = (mimetype?: string, filename?: string) => {
    if (!mimetype && !filename) return <IconFile size={32} />;

    const ext = filename?.split('.').pop()?.toLowerCase();

    if (mimetype?.includes('pdf') || ext === 'pdf') {
      return <IconFileTypePdf size={32} color="#ef4444" />;
    }
    if (mimetype?.includes('word') || ext === 'doc' || ext === 'docx') {
      return <IconFileTypeDoc size={32} color="#3b82f6" />;
    }
    if (
      mimetype?.includes('excel') ||
      mimetype?.includes('spreadsheet') ||
      ext === 'xls' ||
      ext === 'xlsx'
    ) {
      return <IconFileTypeXls size={32} color="#22c55e" />;
    }
    if (mimetype?.includes('zip') || mimetype?.includes('rar') || mimetype?.includes('archive')) {
      return <IconFileTypeZip size={32} color="#f59e0b" />;
    }

    return <IconFile size={32} />;
  };

  // Dosya boyutunu formatla
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Mesaj içeriğini render et
  const renderMessageContent = (msg: Message) => {
    const isDownloading = downloadingMedia.has(msg.id);

    // Image mesajı
    if (msg.type === 'image' || (msg.hasMedia && msg.mimetype?.startsWith('image/'))) {
      // Tek tıkla indir ve aç
      const handleImageClick = async () => {
        if (isDownloading) return;

        if (msg.mediaUrl) {
          openMediaViewer(msg);
          return;
        }

        // Medya yoksa indir ve aç
        const success = await downloadMedia(msg.id);
        if (success) {
          setTimeout(() => {
            const updatedMsg = messages.find((m) => m.id === msg.id);
            if (updatedMsg?.mediaUrl) {
              openMediaViewer(updatedMsg);
            }
          }, 100);
        }
      };

      return (
        <Box>
          {msg.mediaUrl ? (
            <Box
              style={{ cursor: 'pointer', borderRadius: 8, overflow: 'hidden' }}
              onClick={() => openMediaViewer(msg)}
            >
              <img
                src={msg.mediaUrl}
                alt="Image"
                style={{
                  maxWidth: 'min(280px, 85vw)',
                  maxHeight: 300,
                  borderRadius: 8,
                  display: 'block',
                }}
              />
            </Box>
          ) : (
            <Box
              p="xl"
              style={{
                background:
                  'linear-gradient(135deg, rgba(37,211,102,0.15) 0%, rgba(0,0,0,0.2) 100%)',
                borderRadius: 12,
                cursor: 'pointer',
                minWidth: 200,
                border: '1px solid rgba(37,211,102,0.2)',
                transition: 'transform 0.1s, box-shadow 0.1s',
              }}
              onClick={handleImageClick}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(37,211,102,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <Stack align="center" gap="xs">
                {isDownloading ? (
                  <Loader size="md" color="green" />
                ) : (
                  <ThemeIcon size={60} radius="xl" variant="light" color="green">
                    <IconPhoto size={32} />
                  </ThemeIcon>
                )}
                <Text size="sm" c="white" fw={500}>
                  {isDownloading ? 'Yükleniyor...' : '🖼️ Fotoğraf'}
                </Text>
                <Text size="xs" c="gray.5">
                  Görüntülemek için tıkla
                </Text>
              </Stack>
            </Box>
          )}
          {msg.caption && (
            <Text size="sm" mt={6} style={{ wordBreak: 'break-word' }}>
              {msg.caption}
            </Text>
          )}
        </Box>
      );
    }

    // Video mesajı
    if (msg.type === 'video' || (msg.hasMedia && msg.mimetype?.startsWith('video/'))) {
      return (
        <Box>
          {msg.mediaUrl ? (
            <Box style={{ borderRadius: 8, overflow: 'hidden' }}>
              <video
                src={msg.mediaUrl}
                controls
                style={{
                  maxWidth: 'min(280px, 85vw)',
                  maxHeight: 300,
                  borderRadius: 8,
                  display: 'block',
                }}
              />
            </Box>
          ) : (
            <Box
              p="xl"
              style={{
                background: 'rgba(0,0,0,0.2)',
                borderRadius: 8,
                cursor: 'pointer',
                minWidth: 200,
              }}
              onClick={() => downloadMedia(msg.id)}
            >
              <Stack align="center" gap="xs">
                {isDownloading ? (
                  <Loader size="sm" color="white" />
                ) : (
                  <Box style={{ position: 'relative' }}>
                    <IconVideo size={48} style={{ opacity: 0.5 }} />
                    <IconPlayerPlay
                      size={20}
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                      }}
                    />
                  </Box>
                )}
                <Text size="xs" c="gray.5">
                  {isDownloading ? 'İndiriliyor...' : 'Videoyu izlemek için tıkla'}
                </Text>
              </Stack>
            </Box>
          )}
          {msg.caption && (
            <Text size="sm" mt={6} style={{ wordBreak: 'break-word' }}>
              {msg.caption}
            </Text>
          )}
        </Box>
      );
    }

    // Ses mesajı (ptt = push to talk)
    if (
      msg.type === 'audio' ||
      msg.type === 'ptt' ||
      (msg.hasMedia && msg.mimetype?.startsWith('audio/'))
    ) {
      return (
        <Box>
          {msg.mediaUrl ? (
            <audio src={msg.mediaUrl} controls style={{ maxWidth: 'min(250px, 85vw)' }} />
          ) : (
            <Box
              p="md"
              style={{
                background: 'rgba(0,0,0,0.2)',
                borderRadius: 8,
                cursor: 'pointer',
                minWidth: 180,
              }}
              onClick={() => downloadMedia(msg.id)}
            >
              <Group gap="sm">
                {isDownloading ? (
                  <Loader size="sm" color="white" />
                ) : (
                  <IconMicrophone size={24} style={{ opacity: 0.5 }} />
                )}
                <Text size="xs" c="gray.5">
                  {isDownloading ? 'İndiriliyor...' : '🎤 Sesli mesaj'}
                </Text>
              </Group>
            </Box>
          )}
        </Box>
      );
    }

    // Döküman mesajı
    if (
      msg.type === 'document' ||
      (msg.hasMedia &&
        !msg.mimetype?.startsWith('image/') &&
        !msg.mimetype?.startsWith('video/') &&
        !msg.mimetype?.startsWith('audio/'))
    ) {
      const isSaving = savingMedia.has(msg.id);
      const isPdf = msg.mimetype?.includes('pdf') || msg.filename?.toLowerCase().endsWith('.pdf');
      const isImage = msg.mimetype?.startsWith('image/');
      const canPreview = isPdf || isImage;
      const isExcel = msg.filename?.match(/\.(xlsx?|csv)$/i);
      const isWord = msg.filename?.match(/\.(docx?|rtf)$/i);

      // Dosya türüne göre renk ve ikon
      const getDocStyle = () => {
        if (isPdf)
          return {
            color: '#e74c3c',
            bg: 'rgba(231, 76, 60, 0.1)',
            icon: <IconFileTypePdf size={32} color="#e74c3c" />,
          };
        if (isExcel)
          return {
            color: '#27ae60',
            bg: 'rgba(39, 174, 96, 0.1)',
            icon: <IconFileTypeXls size={32} color="#27ae60" />,
          };
        if (isWord)
          return {
            color: '#3498db',
            bg: 'rgba(52, 152, 219, 0.1)',
            icon: <IconFileTypeDoc size={32} color="#3498db" />,
          };
        return {
          color: '#95a5a6',
          bg: 'rgba(149, 165, 166, 0.1)',
          icon: <IconFile size={32} color="#95a5a6" />,
        };
      };
      const docStyle = getDocStyle();

      // Tek tıkla aç fonksiyonu
      const handleDocumentClick = async () => {
        if (isDownloading) return;

        // Medya zaten yüklüyse
        if (msg.mediaUrl) {
          if (canPreview) {
            // PDF/resim önizlenebilir
            setPreviewUrl(msg.mediaUrl);
            setPreviewFilename(msg.filename || 'Döküman');
          } else {
            // Word/Excel için dosya bilgi modalı aç (önizleme URL'si dosya adı ile)
            setPreviewUrl(msg.mediaUrl);
            setPreviewFilename(msg.filename || 'Döküman');
          }
          return;
        }

        // Medya yoksa önce indir, sonra aç/göster
        const success = await downloadMedia(msg.id);
        if (success) {
          setTimeout(() => {
            const updatedMsg = messages.find((m) => m.id === msg.id);
            if (updatedMsg?.mediaUrl) {
              setPreviewUrl(updatedMsg.mediaUrl);
              setPreviewFilename(updatedMsg.filename || 'Döküman');
            }
          }, 100);
        }
      };

      return (
        <Paper
          p="md"
          radius="lg"
          style={{
            background: `linear-gradient(135deg, ${docStyle.bg} 0%, rgba(0,0,0,0.2) 100%)`,
            border: `1px solid ${docStyle.color}30`,
            minWidth: 280,
            maxWidth: 320,
            cursor: 'pointer',
            transition: 'transform 0.1s, box-shadow 0.1s',
          }}
          onClick={handleDocumentClick}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.02)';
            e.currentTarget.style.boxShadow = `0 4px 20px ${docStyle.color}40`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {/* Üst kısım - İkon ve dosya bilgisi */}
          <Group gap="md" wrap="nowrap" mb="sm">
            <ThemeIcon
              size={50}
              radius="md"
              variant="light"
              style={{ background: docStyle.bg, border: `1px solid ${docStyle.color}40` }}
            >
              {isDownloading ? <Loader size="sm" color={docStyle.color} /> : docStyle.icon}
            </ThemeIcon>
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Text size="sm" fw={600} truncate style={{ color: 'white' }}>
                {msg.filename || 'Dosya'}
              </Text>
              <Group gap={6}>
                {msg.filesize && (
                  <Badge size="xs" variant="light" color="gray">
                    {formatFileSize(msg.filesize)}
                  </Badge>
                )}
                {isPdf && (
                  <Badge size="xs" color="red" variant="light">
                    PDF
                  </Badge>
                )}
                {isExcel && (
                  <Badge size="xs" color="green" variant="light">
                    Excel
                  </Badge>
                )}
                {isWord && (
                  <Badge size="xs" color="blue" variant="light">
                    Word
                  </Badge>
                )}
              </Group>
            </Box>
          </Group>

          {/* Alt kısım - Aksiyon butonları */}
          <Group gap={6} justify="flex-end">
            {/* İndir butonu */}
            {msg.mediaUrl && (
              <Tooltip label="Bilgisayara İndir" position="top">
                <ActionIcon
                  variant="light"
                  color="teal"
                  size="md"
                  radius="md"
                  onClick={(e) => {
                    e.stopPropagation();
                    const link = document.createElement('a');
                    link.href = msg.mediaUrl!;
                    link.download = msg.filename || 'document';
                    link.click();
                  }}
                >
                  <IconDownload size={16} />
                </ActionIcon>
              </Tooltip>
            )}

            {/* Önizle butonu - sadece PDF/resim için ve medya yüklüyse */}
            {canPreview && msg.mediaUrl && (
              <Tooltip label="Önizle" position="top">
                <ActionIcon
                  variant="light"
                  color="violet"
                  size="md"
                  radius="md"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewUrl(msg.mediaUrl!);
                    setPreviewFilename(msg.filename || 'Döküman');
                  }}
                >
                  <IconEye size={16} />
                </ActionIcon>
              </Tooltip>
            )}

            {/* Sunucuya Kaydet */}
            <Tooltip label="Sunucuya Kaydet" position="top">
              <ActionIcon
                variant="light"
                color="orange"
                size="md"
                radius="md"
                loading={isSaving}
                onClick={(e) => {
                  e.stopPropagation();
                  saveMediaToServer(msg.id);
                }}
              >
                <IconDeviceFloppy size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>

          {msg.caption && (
            <Text size="sm" mt="sm" style={{ wordBreak: 'break-word', opacity: 0.9 }}>
              {msg.caption}
            </Text>
          )}
        </Paper>
      );
    }

    // Sticker mesajı
    if (msg.type === 'sticker') {
      return (
        <Box>
          {msg.mediaUrl ? (
            <img
              src={msg.mediaUrl}
              alt="Sticker"
              style={{ width: 128, height: 128, objectFit: 'contain' }}
            />
          ) : (
            <Box
              p="md"
              style={{
                width: 128,
                height: 128,
                background: 'rgba(0,0,0,0.2)',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              onClick={() => downloadMedia(msg.id)}
            >
              {isDownloading ? <Loader size="sm" color="white" /> : <Text size="xl">🎨</Text>}
            </Box>
          )}
        </Box>
      );
    }

    // Text mesajı (default)
    return (
      <span
        style={{
          fontSize: 14,
          color: msg.fromMe ? 'white' : '#e0e0e0',
          wordBreak: 'break-word',
          lineHeight: 1.4,
          whiteSpace: 'pre-wrap',
        }}
      >
        {msg.content || (msg.hasMedia ? '📎 Medya' : '')}
      </span>
    );
  };

  const filteredChats = chats.filter((chat) =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
                <ThemeIcon
                  size={80}
                  radius="xl"
                  variant="gradient"
                  gradient={{ from: '#25D366', to: '#128C7E' }}
                >
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
                  <ThemeIcon
                    size={64}
                    radius="xl"
                    variant="gradient"
                    gradient={{ from: '#25D366', to: '#128C7E' }}
                  >
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
                  background:
                    'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                  border: '1px solid rgba(255,255,255,0.08)',
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
                      <img
                        src={qrCode}
                        alt="QR"
                        style={{ width: 260, height: 260, borderRadius: 12 }}
                      />
                    </Box>
                  ) : (
                    <Box
                      p="xl"
                      style={{
                        width: 300,
                        height: 300,
                        background:
                          'linear-gradient(145deg, rgba(37,211,102,0.1) 0%, rgba(18,140,126,0.1) 100%)',
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
                      <Paper p="md" radius="lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
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
              background:
                'linear-gradient(145deg, rgba(37,211,102,0.15) 0%, rgba(37,211,102,0.05) 100%)',
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
              background:
                'linear-gradient(145deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.05) 100%)',
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
              background:
                'linear-gradient(145deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.05) 100%)',
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
              background:
                'linear-gradient(145deg, rgba(168,85,247,0.15) 0%, rgba(168,85,247,0.05) 100%)',
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
              <ActionIcon
                size={44}
                radius="md"
                color="red"
                variant="light"
                onClick={handleDisconnect}
              >
                <IconPlugOff size={22} />
              </ActionIcon>
            </Group>
          </Paper>
        </SimpleGrid>

        {/* Chat Interface */}
        <Paper
          radius="xl"
          style={{
            background:
              'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
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
                borderRight: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Search Header */}
              <Box p="md" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
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
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
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
                      background: 'rgba(255,255,255,0.02)',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
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
                            : 'rgba(255,255,255,0.01)',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        borderLeft:
                          selectedChat?.id === chat.id
                            ? '3px solid #6B7280'
                            : '3px solid transparent',
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
                              borderBottom: '1px solid rgba(255,255,255,0.04)',
                              borderLeft:
                                selectedChat?.id === chat.id
                                  ? '3px solid #25D366'
                                  : '3px solid transparent',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            <Group justify="space-between" wrap="nowrap" gap="xs">
                              <Group wrap="nowrap" style={{ flex: 1, overflow: 'hidden' }} gap="sm">
                                <Indicator
                                  color="green"
                                  size={8}
                                  offset={3}
                                  disabled={chat.unreadCount === 0}
                                >
                                  <Avatar
                                    color="green"
                                    radius="xl"
                                    size={40}
                                    style={{
                                      background:
                                        'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
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
                              borderBottom: '1px solid rgba(255,255,255,0.04)',
                              borderLeft:
                                selectedChat?.id === chat.id
                                  ? '3px solid #3B82F6'
                                  : '3px solid transparent',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            <Group justify="space-between" wrap="nowrap" gap="xs">
                              <Group wrap="nowrap" style={{ flex: 1, overflow: 'hidden' }} gap="sm">
                                <Indicator
                                  color="blue"
                                  size={8}
                                  offset={3}
                                  disabled={chat.unreadCount === 0}
                                >
                                  <Avatar
                                    color="blue"
                                    radius="xl"
                                    size={40}
                                    style={{
                                      background:
                                        'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)',
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

                  <ScrollArea
                    style={{ flex: 1, minHeight: 0 }}
                    viewportRef={messagesViewportRef}
                    p="md"
                  >
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
                        {messages.map((msg) => (
                          <div
                            key={msg.id}
                            style={{
                              textAlign: msg.fromMe ? 'right' : 'left',
                              cursor: msg.status === 'failed' ? 'pointer' : 'default',
                            }}
                            onClick={() => msg.status === 'failed' && handleRetryMessage(msg)}
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
                              {renderMessageContent(msg)}
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
                                <span
                                  style={{ fontSize: 10, color: msg.fromMe ? 'white' : '#999' }}
                                >
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
                          </div>
                        ))}
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
                          <ActionIcon
                            size={44}
                            radius="xl"
                            variant="light"
                            color="red"
                            onClick={cancelRecording}
                          >
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
                              {commonEmojis.map((emoji, i) => (
                                <ActionIcon
                                  key={i}
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
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid rgba(255,255,255,0.1)',
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
                            <ActionIcon
                              size={44}
                              radius="xl"
                              variant="light"
                              color="green"
                              onClick={startRecording}
                            >
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
                        background:
                          'linear-gradient(135deg, rgba(37,211,102,0.2) 0%, rgba(18,140,126,0.2) 100%)',
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
      <Modal
        opened={mediaViewerOpen}
        onClose={() => {
          setMediaViewerOpen(false);
          setViewingMedia(null);
        }}
        size="xl"
        centered
        withCloseButton
        title={
          <Group gap="sm">
            {viewingMedia?.type === 'image' && <IconPhoto size={20} />}
            {viewingMedia?.type === 'video' && <IconVideo size={20} />}
            <Text>Medya Görüntüleyici</Text>
          </Group>
        }
        styles={{
          content: {
            background: 'rgba(0,0,0,0.95)',
          },
          header: {
            background: 'rgba(0,0,0,0.95)',
          },
          title: {
            color: 'white',
          },
        }}
      >
        <Stack align="center" gap="md">
          {viewingMedia?.mediaUrl && (
            <>
              {viewingMedia.type === 'image' || viewingMedia.mimetype?.startsWith('image/') ? (
                <img
                  src={viewingMedia.mediaUrl}
                  alt="Full size"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '70vh',
                    objectFit: 'contain',
                    borderRadius: 8,
                  }}
                />
              ) : viewingMedia.type === 'video' || viewingMedia.mimetype?.startsWith('video/') ? (
                <video
                  src={viewingMedia.mediaUrl}
                  controls
                  autoPlay
                  style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 8 }}
                />
              ) : null}

              {viewingMedia.caption && (
                <Text c="white" ta="center" style={{ maxWidth: 500 }}>
                  {viewingMedia.caption}
                </Text>
              )}

              <Button
                variant="light"
                color="green"
                leftSection={<IconDownload size={18} />}
                onClick={() => {
                  if (viewingMedia.mediaUrl) {
                    const link = document.createElement('a');
                    link.href = viewingMedia.mediaUrl;
                    link.download = viewingMedia.filename || `media-${Date.now()}`;
                    link.click();
                  }
                }}
              >
                İndir
              </Button>
            </>
          )}
        </Stack>
      </Modal>

      {/* Caption Modal - Fotoğraf/Video gönderirken açıklama ekleme */}
      <Modal
        opened={captionModalOpen}
        onClose={handleCancelCaption}
        size="lg"
        centered
        title={
          <Group gap="sm">
            {pendingFile?.type === 'image' && <IconPhoto size={20} color="#25D366" />}
            {pendingFile?.type === 'video' && <IconVideo size={20} color="#3B82F6" />}
            <Text fw={600}>
              {pendingFile?.type === 'image' ? 'Fotoğraf Gönder' : 'Video Gönder'}
            </Text>
          </Group>
        }
        styles={{
          content: {
            background: 'linear-gradient(145deg, #1a1f2e 0%, #0f1419 100%)',
          },
          header: {
            background: 'transparent',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          },
          title: {
            color: 'white',
          },
        }}
      >
        <Stack gap="md">
          {/* Preview */}
          {pendingFile?.preview && (
            <Box
              style={{
                borderRadius: 12,
                overflow: 'hidden',
                background: 'rgba(0,0,0,0.3)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                maxHeight: 400,
              }}
            >
              {pendingFile.type === 'image' ? (
                <img
                  src={pendingFile.preview}
                  alt="Preview"
                  style={{
                    maxWidth: '100%',
                    maxHeight: 400,
                    objectFit: 'contain',
                  }}
                />
              ) : (
                <video
                  src={pendingFile.preview}
                  controls
                  style={{
                    maxWidth: '100%',
                    maxHeight: 400,
                  }}
                />
              )}
            </Box>
          )}

          {/* File info */}
          <Group gap="xs">
            <Badge size="sm" variant="light" color="gray">
              {pendingFile?.file.name}
            </Badge>
            <Badge size="sm" variant="light" color="blue">
              {pendingFile?.file.size
                ? `${(pendingFile.file.size / 1024 / 1024).toFixed(2)} MB`
                : ''}
            </Badge>
          </Group>

          {/* Caption input */}
          <Textarea
            placeholder="Açıklama ekleyin (isteğe bağlı)..."
            value={captionText}
            onChange={(e) => setCaptionText(e.target.value)}
            minRows={2}
            maxRows={4}
            radius="md"
            styles={{
              input: {
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'white',
              },
            }}
          />

          {/* Actions */}
          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" color="gray" onClick={handleCancelCaption}>
              İptal
            </Button>
            <Button
              variant="gradient"
              gradient={{ from: '#25D366', to: '#128C7E' }}
              leftSection={<IconSend size={18} />}
              onClick={handleSendWithCaption}
              loading={sendingMedia}
            >
              Gönder
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Döküman Önizleme Modal - DocViewer ile tüm formatları destekler */}
      <Modal
        opened={!!previewUrl}
        onClose={() => {
          // Blob URL'i temizle
          if (previewBlobUrl?.startsWith('blob:')) {
            URL.revokeObjectURL(previewBlobUrl);
          }
          setPreviewUrl(null);
          setPreviewBlobUrl(null);
          setPreviewFilename('');
          setDocxHtml(null);
          setPreviewLoading(false);
        }}
        size="xl"
        fullScreen
        withCloseButton
        title={
          <Group gap="sm">
            {previewFilename.match(/\.pdf$/i) ? (
              <IconFileTypePdf size={20} color="#e74c3c" />
            ) : previewFilename.match(/\.docx?$/i) ? (
              <IconFileTypeDoc size={20} color="#3498db" />
            ) : previewFilename.match(/\.xlsx?$/i) ? (
              <IconFileTypeXls size={20} color="#27ae60" />
            ) : previewFilename.match(/\.(jpe?g|png|gif|webp)$/i) ? (
              <IconPhoto size={20} color="#9b59b6" />
            ) : (
              <IconFile size={20} />
            )}
            <Text>{previewFilename}</Text>
            <Badge size="sm" variant="light" color="gray">
              {previewFilename.split('.').pop()?.toUpperCase()}
            </Badge>
          </Group>
        }
        styles={{
          content: {
            background: '#1a1a2e',
          },
          header: {
            background: '#1a1a2e',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          },
          title: {
            color: 'white',
          },
          body: {
            height: 'calc(100vh - 60px)',
            padding: 0,
          },
        }}
      >
        <Box style={{ height: '100%', width: '100%', position: 'relative' }}>
          {/* Yükleniyor */}
          {previewLoading && (
            <Box
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
              }}
            >
              <Stack align="center" gap="md">
                <Loader size="xl" color="green" />
                <Text c="gray.4">Dosya işleniyor...</Text>
              </Stack>
            </Box>
          )}

          {/* DOCX için Mammoth.js HTML çıktısı */}
          {!previewLoading && docxHtml && (
            <>
              <ScrollArea style={{ height: '100%', padding: 20 }}>
                <Paper
                  p="xl"
                  radius="md"
                  style={{
                    background: 'white',
                    maxWidth: 900,
                    margin: '0 auto',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                  }}
                >
                  <div
                    dangerouslySetInnerHTML={{ __html: docxHtml }}
                    style={{
                      color: '#333',
                      fontSize: 14,
                      lineHeight: 1.6,
                    }}
                  />
                </Paper>
              </ScrollArea>

              {/* İndirme butonu */}
              <Box style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 1000 }}>
                <Tooltip label="Dosyayı İndir">
                  <ActionIcon
                    size="xl"
                    radius="xl"
                    variant="gradient"
                    gradient={{ from: 'blue', to: 'cyan' }}
                    onClick={() => {
                      if (previewUrl) {
                        const link = document.createElement('a');
                        link.href = previewUrl;
                        link.download = previewFilename || 'document.docx';
                        link.click();
                      }
                    }}
                  >
                    <IconDownload size={24} />
                  </ActionIcon>
                </Tooltip>
              </Box>
            </>
          )}

          {/* Resim dosyaları */}
          {!previewLoading &&
            !docxHtml &&
            previewBlobUrl &&
            (previewFilename.match(/\.(jpe?g|png|gif|webp|bmp)$/i) ||
              previewUrl?.startsWith('data:image/')) && (
              <>
                <Box
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                    background: '#0d0d1a',
                  }}
                >
                  <img
                    src={previewBlobUrl}
                    alt={previewFilename}
                    style={{
                      maxWidth: '95%',
                      maxHeight: '95%',
                      objectFit: 'contain',
                      borderRadius: 8,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    }}
                  />
                </Box>
                <Box style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 1000 }}>
                  <Tooltip label="Dosyayı İndir">
                    <ActionIcon
                      size="xl"
                      radius="xl"
                      variant="gradient"
                      gradient={{ from: 'teal', to: 'green' }}
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = previewBlobUrl;
                        link.download = previewFilename || 'image';
                        link.click();
                      }}
                    >
                      <IconDownload size={24} />
                    </ActionIcon>
                  </Tooltip>
                </Box>
              </>
            )}

          {/* PDF için native iframe (daha güvenilir) */}
          {!previewLoading && !docxHtml && previewBlobUrl && previewFilename.match(/\.pdf$/i) && (
            <>
              <iframe
                src={previewBlobUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  background: 'white',
                }}
                title={previewFilename}
              />
              <Box style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 1000 }}>
                <Tooltip label="Dosyayı İndir">
                  <ActionIcon
                    size="xl"
                    radius="xl"
                    variant="gradient"
                    gradient={{ from: 'red', to: 'orange' }}
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = previewBlobUrl;
                      link.download = previewFilename || 'document.pdf';
                      link.click();
                    }}
                  >
                    <IconDownload size={24} />
                  </ActionIcon>
                </Tooltip>
              </Box>
            </>
          )}

          {/* Diğer dosyalar için DocViewer (Excel vb.) */}
          {!previewLoading &&
            !docxHtml &&
            previewBlobUrl &&
            !previewFilename.match(/\.(jpe?g|png|gif|webp|bmp|pdf)$/i) &&
            !previewUrl?.startsWith('data:image/') && (
              <>
                <DocViewer
                  documents={[
                    {
                      uri: previewBlobUrl,
                      fileName: previewFilename,
                    },
                  ]}
                  pluginRenderers={DocViewerRenderers}
                  config={{
                    header: {
                      disableHeader: true,
                      disableFileName: true,
                    },
                  }}
                  style={{
                    width: '100%',
                    height: '100%',
                    background: '#1a1a2e',
                  }}
                  theme={{
                    primary: '#25D366',
                    secondary: '#1a1a2e',
                    tertiary: '#2d2d44',
                    textPrimary: '#ffffff',
                    textSecondary: '#a0a0a0',
                    textTertiary: '#666666',
                    disableThemeScrollbar: false,
                  }}
                />
                <Box style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 1000 }}>
                  <Tooltip label="Dosyayı İndir">
                    <ActionIcon
                      size="xl"
                      radius="xl"
                      variant="gradient"
                      gradient={{ from: 'teal', to: 'green' }}
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = previewBlobUrl;
                        link.download = previewFilename || 'document';
                        link.click();
                      }}
                    >
                      <IconDownload size={24} />
                    </ActionIcon>
                  </Tooltip>
                </Box>
              </>
            )}
        </Box>
      </Modal>
    </Box>
  );
}
