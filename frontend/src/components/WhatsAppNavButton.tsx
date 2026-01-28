'use client';

import {
  ActionIcon,
  Avatar,
  Box,
  Button,
  CloseButton,
  Drawer,
  Group,
  Highlight,
  Indicator,
  Loader,
  Modal,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Tooltip,
  useMantineColorScheme,
} from '@mantine/core';
import { useDebouncedCallback, useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArchive,
  IconBrandWhatsapp,
  IconCheck,
  IconChecks,
  IconChevronDown,
  IconChevronUp,
  IconClock,
  IconMaximize,
  IconMessage,
  IconMicrophone,
  IconMinimize,
  IconMoodSmile,
  IconPaperclip,
  IconPhone,
  IconPlugConnected,
  IconPlugOff,
  IconQrcode,
  IconRefresh,
  IconSearch,
  IconSend,
  IconUsers,
  IconVideo,
  IconX,
} from '@tabler/icons-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type MessageStatus,
  useWhatsAppSocket,
  type WhatsAppMessage,
} from '@/hooks/useWhatsAppSocket';
import { getApiBaseUrlDynamic } from '@/lib/config';

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
  status?: 'pending' | 'sent' | 'delivered' | 'read' | 'error';
  sender?: {
    id: string;
    name: string;
    phone: string;
  } | null;
  // Media fields
  hasMedia?: boolean;
  mimetype?: string;
  filename?: string;
  caption?: string;
  mediaLoading?: boolean;
  mediaData?: string; // Base64 data URL
  mediaError?: string;
}

interface ChatResponse {
  id: string;
  name?: string;
  lastMessage?: string;
  timestamp?: number | string;
  unreadCount?: number;
  isGroup?: boolean;
  archived?: boolean;
}

interface MessageResponse {
  id: string;
  body?: string;
  timestamp?: number | string;
  fromMe: boolean;
  type?: string;
  hasMedia?: boolean;
  mimetype?: string;
  filename?: string;
  caption?: string;
  sender?: {
    id: string;
    name: string;
    phone: string;
  } | null;
}

// Generate consistent color for a user
function getUserColor(userId: string): string {
  const colors = [
    '#E91E63',
    '#9C27B0',
    '#673AB7',
    '#3F51B5',
    '#2196F3',
    '#03A9F4',
    '#00BCD4',
    '#009688',
    '#4CAF50',
    '#8BC34A',
    '#FF9800',
    '#FF5722',
    '#795548',
    '#607D8B',
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Request notification permission
async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

// Show browser notification
function showBrowserNotification(title: string, body: string, icon?: string) {
  if (Notification.permission !== 'granted') return;
  if (document.hasFocus()) return; // Don't show if tab is active

  const notification = new Notification(title, {
    body,
    icon: icon || '/whatsapp-icon.png',
    tag: 'whatsapp-message',
  } as NotificationOptions);

  // Play notification sound
  try {
    const audio = new Audio('/notification.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch {
    // Ignore audio errors
  }

  notification.onclick = () => {
    window.focus();
    notification.close();
  };
}

export function WhatsAppNavButton() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const [opened, { close, toggle }] = useDisclosure(false);
  const [expanded, setExpanded] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedChats, setArchivedChats] = useState<Chat[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const messagesViewportRef = useRef<HTMLDivElement>(null);

  // Media viewer state
  const [mediaViewerOpen, setMediaViewerOpen] = useState(false);
  const [mediaViewerData, setMediaViewerData] = useState<{
    url: string;
    type: string;
    filename?: string;
  } | null>(null);
  const [mediaLoading, setMediaLoading] = useState<string | null>(null); // messageId being loaded

  // WebSocket connection
  const {
    isSocketConnected,
    waStatus,
    qrCode,
    sendTypingStart,
    sendTypingStop,
    subscribeToPresence,
    getTypingUser,
  } = useWhatsAppSocket({
    onNewMessage: (msg: WhatsAppMessage) => {
      // Update chat list with new message
      setChats((prev) => {
        const chatIndex = prev.findIndex((c) => c.id === msg.chatId);
        if (chatIndex >= 0) {
          const updated = [...prev];
          updated[chatIndex] = {
            ...updated[chatIndex],
            lastMessage: msg.body,
            timestamp: new Date(msg.timestamp * 1000).toLocaleTimeString('tr-TR', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            unreadCount: selectedChat?.id === msg.chatId ? 0 : updated[chatIndex].unreadCount + 1,
          };
          // Move to top
          const [chat] = updated.splice(chatIndex, 1);
          return [chat, ...updated];
        }
        return prev;
      });

      // Add to messages if chat is open
      if (selectedChat?.id === msg.chatId) {
        setMessages((prev) => {
          // Check if message already exists
          if (prev.some((m) => m.id === msg.messageId)) return prev;
          return [
            ...prev,
            {
              id: msg.messageId,
              content: msg.body,
              timestamp: new Date(msg.timestamp * 1000).toLocaleTimeString('tr-TR', {
                hour: '2-digit',
                minute: '2-digit',
              }),
              fromMe: msg.fromMe,
              type: 'text' as const,
              status: 'sent' as const,
              sender: msg.sender,
              hasMedia: false,
            },
          ];
        });
        // Scroll after state update
        setTimeout(scrollToBottom, 100);
      }

      // Show browser notification for incoming messages
      if (!msg.fromMe && notificationsEnabled) {
        showBrowserNotification(
          msg.senderName,
          msg.body.substring(0, 100) + (msg.body.length > 100 ? '...' : '')
        );
      }
    },
    onMessageStatus: (status: MessageStatus) => {
      // Update message status in UI
      if (selectedChat?.id === status.chatId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === status.messageId ? { ...m, status: status.status as Message['status'] } : m
          )
        );
      }
    },
    onConnectionStatus: (status) => {
      if (status.connected) {
        setConnectionError(null);
        fetchChats();
      } else if (status.error) {
        setConnectionError(status.error);
      }
    },
  });

  const connected = waStatus.connected;
  const totalUnread = chats.reduce((sum, chat) => sum + chat.unreadCount, 0);

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission().then(setNotificationsEnabled);
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (messagesViewportRef.current) {
        messagesViewportRef.current.scrollTop = messagesViewportRef.current.scrollHeight;
      }
    }, 100);
  }, []);

  const fetchChats = useCallback(async () => {
    try {
      const apiBaseUrl = getApiBaseUrlDynamic();
      if (!apiBaseUrl) return;
      const res = await fetch(`${apiBaseUrl}/api/social/whatsapp/chats`);

      if (!res.ok) {
        if (res.status === 503) {
          setConnectionError(
            'WhatsApp servisi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.'
          );
          return;
        }
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      if (data.success && data.chats) {
        const allChats: Chat[] = data.chats.map((chat: ChatResponse) => {
          // Format timestamp safely
          let timestamp = '';
          if (chat.timestamp) {
            try {
              const ts =
                typeof chat.timestamp === 'number'
                  ? chat.timestamp
                  : parseInt(String(chat.timestamp), 10);
              if (!Number.isNaN(ts) && ts > 0) {
                // Today check
                const msgDate = new Date(ts * 1000);
                const today = new Date();
                const isToday = msgDate.toDateString() === today.toDateString();
                timestamp = isToday
                  ? msgDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
                  : msgDate.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
              }
            } catch {
              /* ignore */
            }
          }

          return {
            id: chat.id,
            name: chat.name || chat.id.split('@')[0],
            lastMessage: chat.lastMessage || '',
            timestamp,
            unreadCount: chat.unreadCount || 0,
            isGroup: chat.isGroup || false,
            isArchived: chat.archived || false,
          };
        });
        setChats(allChats.filter((c) => !c.isArchived));
        setArchivedChats(allChats.filter((c) => c.isArchived));
      }
    } catch (e) {
      console.error('Failed to fetch chats:', e);
    }
  }, []);

  const fetchMessages = useCallback(
    async (chatId: string) => {
      setLoadingMessages(true);
      try {
        const apiBaseUrl = getApiBaseUrlDynamic();
        if (!apiBaseUrl) return;
        const res = await fetch(
          `${apiBaseUrl}/api/social/whatsapp/chats/${encodeURIComponent(chatId)}/messages?limit=50`
        );

        if (!res.ok) {
          if (res.status === 503) {
            notifications.show({
              title: 'Servis Kullanılamıyor',
              message: 'WhatsApp servisi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.',
              color: 'orange',
            });
            setLoadingMessages(false);
            return;
          }
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        if (data.success && data.messages) {
          const formattedMessages: Message[] = data.messages.map((msg: MessageResponse) => {
            // Parse type from backend
            let type: Message['type'] = 'text';
            if (msg.type) {
              const typeLower = msg.type.toLowerCase();
              if (typeLower.includes('image')) type = 'image';
              else if (typeLower.includes('video')) type = 'video';
              else if (typeLower.includes('audio') || typeLower === 'ptt') type = 'audio';
              else if (typeLower.includes('document') || typeLower.includes('pdf'))
                type = 'document';
              else if (typeLower.includes('sticker')) type = 'sticker';
            }

            // Format timestamp safely
            let timestamp = '';
            if (msg.timestamp) {
              try {
                const ts =
                  typeof msg.timestamp === 'number'
                    ? msg.timestamp
                    : parseInt(String(msg.timestamp), 10);
                if (!Number.isNaN(ts) && ts > 0) {
                  timestamp = new Date(ts * 1000).toLocaleTimeString('tr-TR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                }
              } catch {
                /* ignore */
              }
            }

            // Get content - for media use caption or type indicator
            let content = msg.body || '';
            if (!content && msg.hasMedia) {
              if (type === 'image') content = '📷 Fotoğraf';
              else if (type === 'video') content = '🎬 Video';
              else if (type === 'audio') content = '🎵 Ses';
              else if (type === 'document') content = `📄 ${msg.filename || 'Belge'}`;
              else if (type === 'sticker') content = '🏷️ Sticker';
            }
            if (msg.caption) content = msg.caption;

            return {
              id: msg.id,
              content,
              timestamp,
              fromMe: msg.fromMe,
              type,
              status: 'sent' as const,
              sender: msg.sender || null,
              hasMedia: msg.hasMedia || false,
              mimetype: msg.mimetype,
              filename: msg.filename,
              caption: msg.caption,
            };
          });
          // Messages from backend are already oldest→newest, no need to reverse
          setMessages(formattedMessages);
          setTimeout(scrollToBottom, 100);
        }
      } catch (e) {
        console.error('Failed to fetch messages:', e);
      }
      setLoadingMessages(false);
    },
    [scrollToBottom]
  );

  // İlk yükleme
  useEffect(() => {
    const init = async () => {
      // Client-side kontrolü
      if (typeof window === 'undefined') {
        setLoading(false);
        return;
      }

      const apiBaseUrl = getApiBaseUrlDynamic();
      if (!apiBaseUrl) {
        console.warn('API base URL bulunamadı');
        setConnectionError('API yapılandırması eksik');
        setLoading(false);
        return;
      }

      try {
        // Timeout için AbortController kullan (AbortSignal.timeout() tüm tarayıcılarda desteklenmiyor)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 saniye timeout

        const res = await fetch(`${apiBaseUrl}/api/social/whatsapp/status`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          // HTTP status koduna göre özel mesajlar
          if (res.status === 503) {
            setConnectionError(
              'WhatsApp servisi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.'
            );
            setLoading(false);
            return;
          }
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const status = await res.json();
        if (status.connected) {
          fetchChats();
        }
      } catch (error) {
        // Timeout veya network hatası
        const err = error as Error & { name?: string; message?: string };
        if (err.name === 'AbortError' || err.name === 'TypeError') {
          console.error("WhatsApp status check failed: Backend'e bağlanılamıyor", err);
          setConnectionError('Backend servisi çalışmıyor olabilir');
        } else if (err.message?.includes('503')) {
          setConnectionError(
            'WhatsApp servisi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.'
          );
        } else {
          console.error('WhatsApp status check failed:', err);
          setConnectionError('Sunucuya bağlanılamıyor');
        }
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [fetchChats]);

  const handleConnect = async () => {
    setConnecting(true);
    setConnectionError(null);
    try {
      const apiBaseUrl = getApiBaseUrlDynamic();
      if (!apiBaseUrl) {
        setConnectionError('API yapılandırması eksik');
        setConnecting(false);
        return;
      }
      const res = await fetch(`${apiBaseUrl}/api/social/whatsapp/connect`, { method: 'POST' });

      if (!res.ok) {
        if (res.status === 503) {
          setConnectionError(
            'WhatsApp servisi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.'
          );
          notifications.show({
            title: '⚠️ Servis Kullanılamıyor',
            message: 'WhatsApp servisi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.',
            color: 'orange',
          });
          setConnecting(false);
          return;
        }
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      // WebSocket will handle the rest
      setTimeout(() => setConnecting(false), 3000);
    } catch (error) {
      setConnecting(false);
      const err = error as Error;
      if (err.message?.includes('503')) {
        setConnectionError(
          'WhatsApp servisi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.'
        );
        notifications.show({
          title: '⚠️ Servis Kullanılamıyor',
          message: 'WhatsApp servisi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.',
          color: 'orange',
        });
      } else {
        setConnectionError('WhatsApp servisine bağlanılamıyor');
        notifications.show({
          title: '❌ Bağlantı Hatası',
          message: 'WhatsApp servisi yanıt vermiyor',
          color: 'red',
        });
      }
    }
  };

  const handleDisconnect = async () => {
    try {
      const apiBaseUrl = getApiBaseUrlDynamic();
      if (!apiBaseUrl) return;
      await fetch(`${apiBaseUrl}/api/social/whatsapp/disconnect`, { method: 'POST' });
    } catch {
      // Ignore disconnect errors
    }
    setChats([]);
    setSelectedChat(null);
    notifications.show({
      title: 'Bağlantı Kesildi',
      message: 'WhatsApp bağlantısı sonlandırıldı',
      color: 'orange',
    });
  };

  const markAsRead = useCallback(async (chatId: string) => {
    try {
      const apiBaseUrl = getApiBaseUrlDynamic();
      if (!apiBaseUrl) return;
      await fetch(`${apiBaseUrl}/api/social/whatsapp/chats/${encodeURIComponent(chatId)}/seen`, {
        method: 'POST',
      });
      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, unreadCount: 0 } : c)));
    } catch {
      // Ignore mark as read errors
    }
  }, []);

  // Load and display media
  const handleMediaClick = useCallback(async (messageId: string, type: string) => {
    setMediaLoading(messageId);
    try {
      const apiBaseUrl = getApiBaseUrlDynamic();
      if (!apiBaseUrl) return;
      const res = await fetch(
        `${apiBaseUrl}/api/social/whatsapp/media/${encodeURIComponent(messageId)}`
      );
      const data = await res.json();

      if (data.success && data.data) {
        setMediaViewerData({
          url: data.data, // Base64 data URL
          type: type,
          filename: data.filename,
        });
        setMediaViewerOpen(true);
      } else {
        notifications.show({
          title: 'Medya Yüklenemedi',
          message: data.error || 'Bu medya artık mevcut değil',
          color: 'orange',
        });
      }
    } catch {
      notifications.show({
        title: 'Hata',
        message: 'Medya yüklenirken bir hata oluştu',
        color: 'red',
      });
    }
    setMediaLoading(null);
  }, []);

  const handleSelectChat = (chat: Chat) => {
    setSelectedChat(chat);
    setMessageSearch('');
    fetchMessages(chat.id);
    subscribeToPresence(chat.id);
    if (chat.unreadCount > 0) {
      markAsRead(chat.id);
    }
  };

  // Debounced typing indicator
  const debouncedTypingStop = useDebouncedCallback((chatId: string) => {
    sendTypingStop(chatId);
  }, 2000);

  const handleInputChange = (value: string) => {
    setMessageInput(value);
    if (selectedChat && value.length > 0) {
      sendTypingStart(selectedChat.id);
      debouncedTypingStop(selectedChat.id);
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedChat) return;

    const msgContent = messageInput.trim();
    const tempId = `temp-${Date.now()}`;
    const tempMsg: Message = {
      id: tempId,
      content: msgContent,
      timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      fromMe: true,
      type: 'text',
      status: 'pending',
    };

    setMessages((prev) => [...prev, tempMsg]);
    setMessageInput('');
    sendTypingStop(selectedChat.id);
    setTimeout(scrollToBottom, 50);

    try {
      const apiBaseUrl = getApiBaseUrlDynamic();
      if (!apiBaseUrl) return;
      const res = await fetch(`${apiBaseUrl}/api/social/whatsapp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: selectedChat.id, message: msgContent }),
      });

      if (!res.ok) {
        if (res.status === 503) {
          setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: 'error' } : m)));
          notifications.show({
            title: '⚠️ Servis Kullanılamıyor',
            message: 'WhatsApp servisi şu anda kullanılamıyor. Mesaj gönderilemedi.',
            color: 'orange',
          });
          return;
        }
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();

      if (data.success) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, id: data.messageId || tempId, status: 'sent' } : m
          )
        );
      } else {
        throw new Error(data.error || 'Mesaj gönderilemedi');
      }
    } catch (error) {
      const err = error as Error;
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: 'error' } : m)));
      if (err.message?.includes('503')) {
        notifications.show({
          title: '⚠️ Servis Kullanılamıyor',
          message: 'WhatsApp servisi şu anda kullanılamıyor. Mesaj gönderilemedi.',
          color: 'orange',
        });
      } else {
        notifications.show({
          title: 'Hata',
          message: err.message || 'Mesaj gönderilemedi',
          color: 'red',
        });
      }
    }
  };

  // Message status icon
  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'pending':
        return <IconClock size={10} color="#888" />;
      case 'sent':
        return <IconCheck size={10} color="#888" />;
      case 'delivered':
        return <IconChecks size={10} color="#888" />;
      case 'read':
        return <IconChecks size={10} color="#53BDEB" />;
      case 'error':
        return <IconX size={10} color="#EF4444" />;
      default:
        return <IconChecks size={10} color="#888" />;
    }
  };

  // Filter chats by search
  const filteredChats = chats.filter((chat) =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter messages by search
  const filteredMessages = messageSearch
    ? messages.filter((m) => m.content.toLowerCase().includes(messageSearch.toLowerCase()))
    : messages;

  const typingUser = selectedChat ? getTypingUser(selectedChat.id) : null;
  const drawerWidth = expanded ? 550 : 380;

  return (
    <>
      {/* Navbar Button */}
      <Tooltip
        label={connected ? `WhatsApp (${totalUnread} okunmamış)` : 'WhatsApp - Bağlı Değil'}
        withArrow
      >
        <Indicator
          inline
          label={totalUnread > 0 ? totalUnread : undefined}
          size={totalUnread > 0 ? 16 : 0}
          offset={2}
          color="red"
          processing={totalUnread > 0}
        >
          <ActionIcon
            variant={connected ? 'light' : 'subtle'}
            onClick={toggle}
            size="lg"
            radius="xl"
            color={connected ? 'green' : 'gray'}
            style={{
              background: connected
                ? isDark
                  ? 'rgba(37,211,102,0.15)'
                  : 'rgba(37,211,102,0.1)'
                : isDark
                  ? 'rgba(255,255,255,0.05)'
                  : 'rgba(0,0,0,0.03)',
              border: connected ? '1px solid rgba(37,211,102,0.3)' : 'none',
            }}
          >
            <IconBrandWhatsapp size={18} style={{ color: connected ? '#25D366' : undefined }} />
          </ActionIcon>
        </Indicator>
      </Tooltip>

      {/* Drawer */}
      <Drawer
        opened={opened}
        onClose={close}
        position="right"
        size={drawerWidth}
        withCloseButton={false}
        padding={0}
        styles={{
          body: { height: '100%', padding: 0 },
          content: {
            background: 'linear-gradient(180deg, #0f1419 0%, #1a1f2e 100%)',
            borderLeft: '1px solid rgba(255,255,255,0.08)',
          },
        }}
      >
        <Stack h="100%" gap={0}>
          {/* Header */}
          <Box
            p="md"
            style={{
              background:
                'linear-gradient(135deg, rgba(37,211,102,0.15) 0%, rgba(18,140,126,0.1) 100%)',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <Group justify="space-between">
              <Group gap="sm">
                <ThemeIcon
                  size={40}
                  radius="xl"
                  variant="gradient"
                  gradient={{ from: '#25D366', to: '#128C7E' }}
                >
                  <IconBrandWhatsapp size={22} />
                </ThemeIcon>
                <Box>
                  <Text fw={600} c="white" size="sm">
                    WhatsApp
                  </Text>
                  <Group gap={4}>
                    <Box
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: connected
                          ? '#25D366'
                          : isSocketConnected
                            ? '#FFA500'
                            : '#EF4444',
                      }}
                    />
                    <Text size="xs" c={connected ? 'green' : isSocketConnected ? 'orange' : 'red'}>
                      {connected ? 'Bağlı' : isSocketConnected ? waStatus.status : 'Bağlı Değil'}
                    </Text>
                  </Group>
                </Box>
              </Group>
              <Group gap="xs">
                {connected && (
                  <Tooltip label="Bağlantıyı Kes">
                    <ActionIcon variant="subtle" color="red" size="sm" onClick={handleDisconnect}>
                      <IconPlugOff size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}
                <Tooltip label={expanded ? 'Küçült' : 'Genişlet'}>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    onClick={() => setExpanded(!expanded)}
                  >
                    {expanded ? <IconMinimize size={16} /> : <IconMaximize size={16} />}
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Tam Sayfa">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    component={Link}
                    href="/sosyal-medya/whatsapp"
                    onClick={close}
                  >
                    <IconMaximize size={16} />
                  </ActionIcon>
                </Tooltip>
                <CloseButton onClick={close} c="gray" />
              </Group>
            </Group>
          </Box>

          {/* Content */}
          {loading ? (
            <Stack align="center" justify="center" style={{ flex: 1 }}>
              <Loader color="green" />
              <Text c="gray.5" size="sm">
                Yükleniyor...
              </Text>
            </Stack>
          ) : !connected ? (
            /* QR Screen */
            <Stack align="center" justify="center" p="xl" style={{ flex: 1 }} gap="xl">
              {qrCode ? (
                <>
                  <Box p="md" style={{ background: 'white', borderRadius: 16 }}>
                    <Image
                      src={qrCode}
                      alt="QR Code"
                      width={200}
                      height={200}
                      style={{ borderRadius: 8 }}
                      unoptimized
                    />
                  </Box>
                  <Stack gap="xs" ta="center">
                    <Text c="gray.4" size="sm">
                      1. WhatsApp&apos;ı açın
                    </Text>
                    <Text c="gray.4" size="sm">
                      2. Bağlı Cihazlar → Cihaz Bağla
                    </Text>
                    <Text c="gray.4" size="sm">
                      3. QR kodu tarayın
                    </Text>
                  </Stack>
                  <Button variant="light" color="gray" onClick={handleConnect} loading={connecting}>
                    QR&apos;ı Yenile
                  </Button>
                </>
              ) : connectionError ? (
                <>
                  <ThemeIcon size={80} radius="xl" variant="light" color="red">
                    <IconPlugOff size={40} />
                  </ThemeIcon>
                  <Stack gap="xs" ta="center">
                    <Text c="red.4" fw={600}>
                      Bağlantı Hatası
                    </Text>
                    <Text c="gray.4" size="sm" style={{ maxWidth: 280 }}>
                      {connectionError}
                    </Text>
                  </Stack>
                  <Button
                    variant="light"
                    color="red"
                    leftSection={<IconRefresh size={18} />}
                    onClick={handleConnect}
                  >
                    Tekrar Dene
                  </Button>
                </>
              ) : (
                <>
                  <ThemeIcon size={80} radius="xl" variant="light" color="green">
                    <IconQrcode size={40} />
                  </ThemeIcon>
                  <Text c="gray.4" ta="center">
                    WhatsApp hesabınızı bağlayın
                  </Text>
                  <Button
                    variant="gradient"
                    gradient={{ from: '#25D366', to: '#128C7E' }}
                    leftSection={<IconPlugConnected size={18} />}
                    onClick={handleConnect}
                    loading={connecting}
                    size="md"
                  >
                    Bağlan
                  </Button>
                </>
              )}
            </Stack>
          ) : selectedChat ? (
            /* Chat View */
            <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Chat Header */}
              <Box
                p="sm"
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(0,0,0,0.2)',
                  flexShrink: 0,
                }}
              >
                <Group justify="space-between">
                  <Group gap="sm">
                    <ActionIcon variant="subtle" color="gray" onClick={() => setSelectedChat(null)}>
                      <IconChevronDown size={18} style={{ transform: 'rotate(90deg)' }} />
                    </ActionIcon>
                    <Avatar
                      color="green"
                      radius="xl"
                      size={36}
                      style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}
                    >
                      {selectedChat.isGroup ? (
                        <IconUsers size={16} />
                      ) : (
                        selectedChat.name[0]?.toUpperCase()
                      )}
                    </Avatar>
                    <Box>
                      <Text
                        fw={500}
                        c="white"
                        size="sm"
                        truncate
                        style={{ maxWidth: expanded ? 280 : 160 }}
                      >
                        {selectedChat.name}
                      </Text>
                      <Text size="xs" c={typingUser ? 'green' : 'gray.5'}>
                        {typingUser ? `${typingUser.participantName} yazıyor...` : 'Çevrimiçi'}
                      </Text>
                    </Box>
                  </Group>
                  <Group gap={4}>
                    <ActionIcon variant="subtle" color="gray" size="sm">
                      <IconPhone size={16} />
                    </ActionIcon>
                    <ActionIcon variant="subtle" color="gray" size="sm">
                      <IconVideo size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="sm"
                      onClick={() => setMessageSearch(messageSearch ? '' : ' ')}
                    >
                      <IconSearch size={16} />
                    </ActionIcon>
                  </Group>
                </Group>

                {/* Message Search */}
                {messageSearch !== '' && (
                  <TextInput
                    placeholder="Mesajlarda ara..."
                    value={messageSearch}
                    onChange={(e) => setMessageSearch(e.target.value)}
                    size="xs"
                    mt="xs"
                    leftSection={<IconSearch size={12} />}
                    rightSection={
                      messageSearch && (
                        <ActionIcon size="xs" variant="subtle" onClick={() => setMessageSearch('')}>
                          <IconX size={12} />
                        </ActionIcon>
                      )
                    }
                    styles={{
                      input: {
                        background: 'rgba(255,255,255,0.05)',
                        border: 'none',
                        color: 'white',
                      },
                    }}
                  />
                )}
              </Box>

              {/* Messages */}
              <Box
                ref={messagesViewportRef}
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {loadingMessages ? (
                  <Stack align="center" justify="center" style={{ flex: 1 }}>
                    <Loader color="green" size="sm" />
                  </Stack>
                ) : filteredMessages.length === 0 ? (
                  <Stack align="center" justify="center" style={{ flex: 1 }}>
                    <IconMessage size={32} color="gray" style={{ opacity: 0.3 }} />
                    <Text c="gray.6" size="xs">
                      {messageSearch ? 'Mesaj bulunamadı' : 'Henüz mesaj yok'}
                    </Text>
                  </Stack>
                ) : (
                  <div
                    style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}
                  >
                    {filteredMessages.map((msg) => (
                      <div key={msg.id} style={{ textAlign: msg.fromMe ? 'right' : 'left' }}>
                        {/* Sender name for group messages */}
                        {selectedChat.isGroup && !msg.fromMe && msg.sender && (
                          <Text
                            size="xs"
                            fw={500}
                            mb={2}
                            style={{ color: getUserColor(msg.sender.id) }}
                          >
                            {msg.sender.name}
                          </Text>
                        )}
                        <div
                          style={{
                            display: 'inline-block',
                            maxWidth: '75%',
                            padding: msg.hasMedia && msg.type === 'image' ? '4px' : '6px 10px',
                            background:
                              msg.status === 'error'
                                ? 'rgba(239,68,68,0.3)'
                                : msg.fromMe
                                  ? '#005C4B'
                                  : 'rgba(255,255,255,0.08)',
                            borderRadius: 8,
                            borderBottomRightRadius: msg.fromMe ? 2 : 8,
                            borderBottomLeftRadius: msg.fromMe ? 8 : 2,
                            textAlign: 'left',
                            opacity: msg.status === 'pending' ? 0.7 : 1,
                          }}
                        >
                          {/* Media Content */}
                          {msg.hasMedia && (
                            <Box
                              mb={
                                msg.content &&
                                !['📷', '🎬', '🎵', '📄', '🏷️'].some((e) =>
                                  msg.content.startsWith(e)
                                )
                                  ? 4
                                  : 0
                              }
                            >
                              {msg.type === 'image' && (
                                <Box
                                  onClick={() => handleMediaClick(msg.id, 'image')}
                                  style={{
                                    width: 200,
                                    height: 150,
                                    background: 'rgba(0,0,0,0.2)',
                                    borderRadius: 6,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {mediaLoading === msg.id ? (
                                    <Loader color="green" size="sm" />
                                  ) : (
                                    <Stack align="center" gap={4}>
                                      <ThemeIcon variant="light" color="gray" size="lg" radius="xl">
                                        📷
                                      </ThemeIcon>
                                      <Text size="xs" c="dimmed">
                                        Fotoğraf
                                      </Text>
                                    </Stack>
                                  )}
                                </Box>
                              )}
                              {msg.type === 'video' && (
                                <Box
                                  onClick={() => handleMediaClick(msg.id, 'video')}
                                  style={{
                                    width: 200,
                                    height: 120,
                                    background: 'rgba(0,0,0,0.3)',
                                    borderRadius: 6,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {mediaLoading === msg.id ? (
                                    <Loader color="blue" size="sm" />
                                  ) : (
                                    <Stack align="center" gap={4}>
                                      <ThemeIcon variant="light" color="blue" size="lg" radius="xl">
                                        🎬
                                      </ThemeIcon>
                                      <Text size="xs" c="dimmed">
                                        Video
                                      </Text>
                                    </Stack>
                                  )}
                                </Box>
                              )}
                              {msg.type === 'audio' && (
                                <Group
                                  gap="xs"
                                  p="xs"
                                  style={{
                                    background: 'rgba(0,0,0,0.2)',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                  }}
                                  onClick={() => handleMediaClick(msg.id, 'audio')}
                                >
                                  {mediaLoading === msg.id ? (
                                    <Loader color="orange" size="xs" />
                                  ) : (
                                    <ThemeIcon variant="light" color="orange" size="sm" radius="xl">
                                      🎵
                                    </ThemeIcon>
                                  )}
                                  <Text size="xs" c="dimmed">
                                    {msg.mimetype?.includes('ogg') ? 'Sesli mesaj' : 'Ses dosyası'}
                                  </Text>
                                </Group>
                              )}
                              {msg.type === 'document' && (
                                <Group
                                  gap="xs"
                                  p="xs"
                                  style={{
                                    background: 'rgba(0,0,0,0.2)',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                  }}
                                  onClick={() => handleMediaClick(msg.id, 'document')}
                                >
                                  {mediaLoading === msg.id ? (
                                    <Loader color="red" size="xs" />
                                  ) : (
                                    <ThemeIcon variant="light" color="red" size="sm" radius="xl">
                                      📄
                                    </ThemeIcon>
                                  )}
                                  <Text
                                    size="xs"
                                    c="dimmed"
                                    style={{ maxWidth: 150 }}
                                    lineClamp={1}
                                  >
                                    {msg.filename || 'Belge'}
                                  </Text>
                                </Group>
                              )}
                              {msg.type === 'sticker' && (
                                <Box
                                  style={{
                                    width: 100,
                                    height: 100,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                  }}
                                  onClick={() => handleMediaClick(msg.id, 'sticker')}
                                >
                                  {mediaLoading === msg.id ? (
                                    <Loader color="gray" size="sm" />
                                  ) : (
                                    <Text size="xl">🏷️</Text>
                                  )}
                                </Box>
                              )}
                            </Box>
                          )}
                          {/* Text Content (if not just media placeholder) */}
                          {msg.content &&
                            !['📷 Fotoğraf', '🎬 Video', '🎵 Ses', '🏷️ Sticker'].includes(
                              msg.content
                            ) &&
                            !msg.content.startsWith('📄 ') &&
                            (messageSearch ? (
                              <Highlight
                                highlight={messageSearch}
                                style={{
                                  fontSize: 13,
                                  color: msg.fromMe ? 'white' : '#e0e0e0',
                                  wordBreak: 'break-word',
                                  lineHeight: 1.4,
                                }}
                              >
                                {msg.content}
                              </Highlight>
                            ) : (
                              <span
                                style={{
                                  fontSize: 13,
                                  color: msg.fromMe ? 'white' : '#e0e0e0',
                                  wordBreak: 'break-word',
                                  lineHeight: 1.4,
                                  whiteSpace: 'pre-wrap',
                                }}
                              >
                                {msg.content}
                              </span>
                            ))}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'flex-end',
                              alignItems: 'center',
                              gap: 3,
                              marginTop: 2,
                              opacity: 0.6,
                            }}
                          >
                            <span style={{ fontSize: 10, color: msg.fromMe ? 'white' : '#999' }}>
                              {msg.timestamp}
                            </span>
                            {msg.fromMe && getStatusIcon(msg.status)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Box>

              {/* Input */}
              <Box
                p="sm"
                style={{
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(0,0,0,0.2)',
                  flexShrink: 0,
                }}
              >
                <Group gap="xs">
                  <Tooltip label="Emoji (yakında)">
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="sm"
                      onClick={() =>
                        notifications.show({
                          title: 'Yakında',
                          message: 'Emoji seçici yakında eklenecek',
                          color: 'blue',
                        })
                      }
                    >
                      <IconMoodSmile size={18} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Dosya Gönder (yakında)">
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="sm"
                      onClick={() =>
                        notifications.show({
                          title: 'Yakında',
                          message: 'Fotoğraf ve dosya gönderme özelliği yakında eklenecek',
                          color: 'blue',
                        })
                      }
                    >
                      <IconPaperclip size={18} />
                    </ActionIcon>
                  </Tooltip>
                  <Textarea
                    placeholder="Mesaj yazın..."
                    value={messageInput}
                    onChange={(e) => handleInputChange(e.target.value)}
                    style={{ flex: 1 }}
                    autosize
                    minRows={1}
                    maxRows={3}
                    radius="xl"
                    size="xs"
                    styles={{
                      input: {
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'white',
                        fontSize: 13,
                      },
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  {messageInput.trim() ? (
                    <ActionIcon
                      size={32}
                      radius="xl"
                      variant="gradient"
                      gradient={{ from: '#25D366', to: '#128C7E' }}
                      onClick={handleSendMessage}
                    >
                      <IconSend size={16} />
                    </ActionIcon>
                  ) : (
                    <ActionIcon size={32} radius="xl" variant="light" color="green">
                      <IconMicrophone size={16} />
                    </ActionIcon>
                  )}
                </Group>
              </Box>
            </Box>
          ) : (
            /* Chat List */
            <Stack style={{ flex: 1 }} gap={0}>
              {/* Search */}
              <Box p="sm" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <TextInput
                  placeholder="Sohbet ara..."
                  leftSection={<IconSearch size={14} />}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  size="xs"
                  radius="lg"
                  styles={{
                    input: {
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'white',
                    },
                  }}
                />
              </Box>

              {/* Chats */}
              <ScrollArea style={{ flex: 1 }}>
                {archivedChats.length > 0 && (
                  <Box
                    px="sm"
                    py="xs"
                    onClick={() => setShowArchived(!showArchived)}
                    style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }}
                  >
                    <Group justify="space-between">
                      <Group gap="xs">
                        <IconArchive size={16} color="gray" />
                        <Text size="xs" c="gray.5">
                          Arşivlenmiş ({archivedChats.length})
                        </Text>
                      </Group>
                      {showArchived ? (
                        <IconChevronUp size={14} color="gray" />
                      ) : (
                        <IconChevronDown size={14} color="gray" />
                      )}
                    </Group>
                  </Box>
                )}

                {showArchived &&
                  archivedChats.map((chat) => (
                    <ChatItem
                      key={chat.id}
                      chat={chat}
                      onClick={() => handleSelectChat(chat)}
                      selected={false}
                    />
                  ))}

                {filteredChats.length === 0 ? (
                  <Stack align="center" justify="center" h={200}>
                    <IconMessage size={40} color="gray" style={{ opacity: 0.3 }} />
                    <Text c="gray.6" size="sm">
                      Sohbet bulunamadı
                    </Text>
                  </Stack>
                ) : (
                  filteredChats.map((chat) => (
                    <ChatItem
                      key={chat.id}
                      chat={chat}
                      onClick={() => handleSelectChat(chat)}
                      selected={false}
                    />
                  ))
                )}
              </ScrollArea>

              {/* Stats Footer */}
              <Box
                p="xs"
                style={{
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(0,0,0,0.2)',
                }}
              >
                <Group justify="space-around">
                  <Box ta="center">
                    <Text size="lg" fw={700} c="white">
                      {chats.length}
                    </Text>
                    <Text size="xs" c="gray.6">
                      Sohbet
                    </Text>
                  </Box>
                  <Box ta="center">
                    <Text size="lg" fw={700} c="red">
                      {totalUnread}
                    </Text>
                    <Text size="xs" c="gray.6">
                      Okunmamış
                    </Text>
                  </Box>
                  <Box ta="center">
                    <Text size="lg" fw={700} c="blue">
                      {chats.filter((c) => c.isGroup).length}
                    </Text>
                    <Text size="xs" c="gray.6">
                      Grup
                    </Text>
                  </Box>
                </Group>
              </Box>
            </Stack>
          )}
        </Stack>
      </Drawer>

      {/* Media Viewer Modal */}
      <Modal
        opened={mediaViewerOpen}
        onClose={() => {
          setMediaViewerOpen(false);
          setMediaViewerData(null);
        }}
        size="lg"
        centered
        withCloseButton
        title={mediaViewerData?.type === 'document' ? mediaViewerData.filename : undefined}
        styles={{
          content: { background: '#1a1b1e' },
          header: { background: '#1a1b1e', color: 'white' },
          body: { padding: 0 },
        }}
      >
        {mediaViewerData && (
          <Box p="md">
            {mediaViewerData.type === 'image' && (
              <Image
                src={mediaViewerData.url}
                alt="Fotoğraf"
                width={800}
                height={600}
                style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 8 }}
                unoptimized
              />
            )}
            {mediaViewerData.type === 'video' && (
              <video
                src={mediaViewerData.url}
                controls
                autoPlay
                style={{ width: '100%', maxHeight: '70vh', borderRadius: 8 }}
              >
                <track kind="captions" />
              </video>
            )}
            {mediaViewerData.type === 'audio' && (
              <Box p="xl" ta="center">
                <ThemeIcon variant="light" color="orange" size={80} radius="xl" mb="md">
                  🎵
                </ThemeIcon>
                <audio src={mediaViewerData.url} controls autoPlay style={{ width: '100%' }}>
                  <track kind="captions" />
                </audio>
              </Box>
            )}
            {mediaViewerData.type === 'document' && (
              <Box p="xl" ta="center">
                <ThemeIcon variant="light" color="red" size={80} radius="xl" mb="md">
                  📄
                </ThemeIcon>
                <Text c="white" mb="md">
                  {mediaViewerData.filename || 'Belge'}
                </Text>
                <Button
                  component="a"
                  href={mediaViewerData.url}
                  download={mediaViewerData.filename || 'document'}
                  variant="gradient"
                  gradient={{ from: 'blue', to: 'cyan' }}
                >
                  İndir
                </Button>
              </Box>
            )}
            {mediaViewerData.type === 'sticker' && (
              <Box ta="center" p="xl">
                <Image
                  src={mediaViewerData.url}
                  alt="Sticker"
                  width={300}
                  height={300}
                  style={{ maxWidth: 300, maxHeight: 300 }}
                  unoptimized
                />
              </Box>
            )}
          </Box>
        )}
      </Modal>
    </>
  );
}

// Chat Item Component
function ChatItem({
  chat,
  onClick,
  selected,
}: {
  chat: Chat;
  onClick: () => void;
  selected: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        padding: '8px 12px',
        background: selected
          ? 'linear-gradient(90deg, rgba(37,211,102,0.15) 0%, transparent 100%)'
          : 'transparent',
        borderLeft: selected ? '3px solid #25D366' : '3px solid transparent',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        borderTop: 'none',
        borderRight: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        textAlign: 'left',
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Avatar
          color={chat.isGroup ? 'blue' : 'green'}
          radius="xl"
          size={36}
          style={{
            background: chat.isGroup
              ? 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)'
              : 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
          }}
        >
          {chat.isGroup ? (
            <IconUsers size={16} />
          ) : (
            <span style={{ fontSize: 14 }}>{chat.name[0]?.toUpperCase()}</span>
          )}
        </Avatar>
        {chat.unreadCount > 0 && (
          <div
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#25D366',
            }}
          />
        )}
      </div>
      <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'white',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {chat.name}
          </span>
          <span style={{ fontSize: 10, color: '#888', flexShrink: 0 }}>{chat.timestamp}</span>
        </div>
        <span
          style={{
            fontSize: 12,
            color: '#888',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'block',
          }}
        >
          {chat.lastMessage || 'Mesaj yok'}
        </span>
      </div>
      {chat.unreadCount > 0 && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'white',
            background: '#25D366',
            borderRadius: '50%',
            minWidth: 18,
            height: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {chat.unreadCount}
        </span>
      )}
    </button>
  );
}

export default WhatsAppNavButton;
