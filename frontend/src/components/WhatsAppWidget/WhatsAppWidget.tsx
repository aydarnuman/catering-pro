'use client';

import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Button,
  CloseButton,
  Drawer,
  Group,
  Highlight,
  Indicator,
  Loader,
  Menu,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Tooltip,
  Transition,
} from '@mantine/core';
import { useDisclosure, useDebouncedCallback } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArchive,
  IconBrandWhatsapp,
  IconCheck,
  IconChecks,
  IconChevronDown,
  IconChevronUp,
  IconClock,
  IconFile,
  IconMaximize,
  IconMessage,
  IconMicrophone,
  IconMinimize,
  IconMoodSmile,
  IconPaperclip,
  IconPhone,
  IconPhoto,
  IconPlugConnected,
  IconPlugOff,
  IconQrcode,
  IconRefresh,
  IconSearch,
  IconSend,
  IconSettings,
  IconUsers,
  IconVideo,
  IconX,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, ChangeEvent } from 'react';
import { API_BASE_URL } from '@/lib/config';
import { useWhatsAppSocket, WhatsAppMessage, MessageStatus } from '@/hooks/useWhatsAppSocket';

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
  type: 'text' | 'image' | 'document';
  status?: 'pending' | 'sent' | 'delivered' | 'read' | 'error';
  sender?: {
    id: string;
    name: string;
    phone: string;
  } | null;
}

// Generate consistent color for a user
function getUserColor(userId: string): string {
  const colors = [
    '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3',
    '#03A9F4', '#00BCD4', '#009688', '#4CAF50', '#8BC34A',
    '#FF9800', '#FF5722', '#795548', '#607D8B',
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
function showBrowserNotification(title: string, body: string) {
  if (Notification.permission !== 'granted') return;
  if (document.hasFocus()) return;
  
  const notification = new Notification(title, {
    body,
    icon: '/whatsapp-icon.png',
    tag: 'whatsapp-message',
  } as NotificationOptions);
  
  try {
    const audio = new Audio('/notification.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch (e) {}
  
  notification.onclick = () => {
    window.focus();
    notification.close();
  };
}

export function WhatsAppWidget() {
  const [opened, { open, close, toggle }] = useDisclosure(false);
  const [expanded, setExpanded] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [loading, setLoading] = useState(true);
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
  const [sendingMedia, setSendingMedia] = useState(false);
  const messagesViewportRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

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
      // Update chat list
      setChats(prev => {
        const chatIndex = prev.findIndex(c => c.id === msg.chatId);
        if (chatIndex >= 0) {
          const updated = [...prev];
          updated[chatIndex] = {
            ...updated[chatIndex],
            lastMessage: msg.body,
            timestamp: new Date(msg.timestamp * 1000).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
            unreadCount: selectedChat?.id === msg.chatId ? 0 : updated[chatIndex].unreadCount + 1,
          };
          const [chat] = updated.splice(chatIndex, 1);
          return [chat, ...updated];
        }
        return prev;
      });
      
      // Add to messages if chat is open
      if (selectedChat?.id === msg.chatId) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.messageId)) return prev;
          return [...prev, {
            id: msg.messageId,
            content: msg.body,
            timestamp: new Date(msg.timestamp * 1000).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
            fromMe: msg.fromMe,
            type: 'text',
            status: 'sent',
            sender: msg.sender,
          }];
        });
        scrollToBottom();
      }
      
      // Browser notification
      if (!msg.fromMe && notificationsEnabled) {
        showBrowserNotification(msg.senderName, msg.body.substring(0, 100));
      }
    },
    onMessageStatus: (status: MessageStatus) => {
      if (selectedChat?.id === status.chatId) {
        setMessages(prev => prev.map(m =>
          m.id === status.messageId ? { ...m, status: status.status as Message['status'] } : m
        ));
      }
    },
    onConnectionStatus: (status) => {
      if (status.connected) {
        fetchChats();
      }
    },
  });

  const connected = waStatus.connected;
  const totalUnread = chats.reduce((sum, chat) => sum + chat.unreadCount, 0);

  useEffect(() => {
    requestNotificationPermission().then(setNotificationsEnabled);
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (messagesViewportRef.current) {
        messagesViewportRef.current.scrollTop = messagesViewportRef.current.scrollHeight;
      }
    }, 100);
  };

  const fetchChats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/social/whatsapp/chats`);
      const data = await res.json();
      if (data.success && data.chats) {
        const allChats: Chat[] = data.chats.map((chat: any) => ({
          id: chat.id,
          name: chat.name || chat.id.split('@')[0],
          lastMessage: chat.lastMessage || '',
          timestamp: chat.timestamp ? new Date(chat.timestamp * 1000).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '',
          unreadCount: chat.unreadCount || 0,
          isGroup: chat.isGroup || false,
          isArchived: chat.archived || false,
        }));
        setChats(allChats.filter((c) => !c.isArchived));
        setArchivedChats(allChats.filter((c) => c.isArchived));
      }
    } catch (e) {
      console.error('Failed to fetch chats:', e);
    }
  }, []);

  const fetchMessages = useCallback(async (chatId: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/social/whatsapp/chats/${encodeURIComponent(chatId)}/messages?limit=30`);
      const data = await res.json();
      if (data.success && data.messages) {
        const formattedMessages: Message[] = data.messages.map((msg: any) => ({
          id: msg.id,
          content: msg.body || '',
          timestamp: msg.timestamp ? new Date(msg.timestamp * 1000).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '',
          fromMe: msg.fromMe,
          type: 'text',
          status: 'sent',
          sender: msg.sender || null,
        }));
        setMessages(formattedMessages.reverse());
        scrollToBottom();
      }
    } catch (e) {
      console.error('Failed to fetch messages:', e);
    }
    setLoadingMessages(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/social/whatsapp/status`);
        const status = await res.json();
        if (status.connected) {
          fetchChats();
        }
      } catch (e) {
        console.error('WhatsApp status check failed:', e);
      }
      setLoading(false);
    };
    init();
  }, [fetchChats]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await fetch(`${API_BASE_URL}/api/social/whatsapp/connect`, { method: 'POST' });
      setTimeout(() => setConnecting(false), 3000);
    } catch (error) {
      setConnecting(false);
      notifications.show({ title: 'Hata', message: 'Servis bağlantısı başarısız', color: 'red' });
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/social/whatsapp/disconnect`, { method: 'POST' });
    } catch (e) {}
    setChats([]);
    setSelectedChat(null);
    notifications.show({ title: 'Bağlantı Kesildi', message: 'WhatsApp bağlantısı sonlandırıldı', color: 'orange' });
  };

  const markAsRead = useCallback(async (chatId: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/social/whatsapp/chats/${encodeURIComponent(chatId)}/seen`, { method: 'POST' });
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, unreadCount: 0 } : c));
    } catch (e) {}
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
    
    const tempId = `temp-${Date.now()}`;
    const msgContent = messageInput.trim();
    const chatId = selectedChat.id;
    
    const tempMsg: Message = {
      id: tempId,
      content: msgContent,
      timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      fromMe: true,
      type: 'text',
      status: 'pending',
    };
    
    setMessageInput('');
    setMessages(prev => [...prev, tempMsg]);
    sendTypingStop(chatId);
    scrollToBottom();

    try {
      const res = await fetch(`${API_BASE_URL}/api/social/whatsapp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message: msgContent }),
      });
      const data = await res.json();
      
      if (data.success) {
        setMessages(prev => prev.map(m => 
          m.id === tempId ? { ...m, status: 'sent' } : m
        ));
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      setMessages(prev => prev.map(m => 
        m.id === tempId ? { ...m, status: 'error' } : m
      ));
      notifications.show({ title: 'Gönderilemedi', message: 'Mesaj gönderilemedi', color: 'orange' });
    }
  };

  const handleRetryMessage = async (msg: Message) => {
    if (!selectedChat || msg.status !== 'error') return;
    
    const chatId = selectedChat.id;
    const msgId = msg.id;
    
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'pending' } : m));
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/social/whatsapp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message: msg.content }),
      });
      const data = await res.json();
      
      if (data.success) {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'sent' } : m));
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'error' } : m));
      notifications.show({ title: 'Hata', message: error.message || 'Mesaj gönderilemedi', color: 'red' });
    }
  };

  // File to Base64 converter
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // Handle file selection for media sending
  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>, type: 'image' | 'document') => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat) return;

    e.target.value = '';

    // Validate file size (max 16MB)
    const maxSize = 16 * 1024 * 1024;
    if (file.size > maxSize) {
      notifications.show({
        title: 'Dosya Çok Büyük',
        message: 'Maksimum 16MB',
        color: 'red',
      });
      return;
    }

    const chatId = selectedChat.id;
    setSendingMedia(true);

    const tempId = `temp-media-${Date.now()}`;
    const tempMsg: Message = {
      id: tempId,
      content: type === 'image' ? '🖼️ Gönderiliyor...' : `📎 ${file.name}`,
      timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      fromMe: true,
      type: type,
      status: 'pending',
    };
    
    setMessages(prev => [...prev, tempMsg]);
    scrollToBottom();

    try {
      const base64Data = await fileToBase64(file);
      
      const res = await fetch(`${API_BASE_URL}/api/social/whatsapp/send-media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          type,
          data: base64Data,
          filename: file.name,
          caption: '',
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setMessages(prev => prev.map(m => 
          m.id === tempId ? { ...m, status: 'sent', content: type === 'image' ? '' : `📎 ${file.name}` } : m
        ));
        notifications.show({
          title: '✅ Gönderildi',
          message: type === 'image' ? 'Fotoğraf gönderildi' : 'Döküman gönderildi',
          color: 'green',
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      setMessages(prev => prev.map(m => 
        m.id === tempId ? { ...m, status: 'error' } : m
      ));
      notifications.show({
        title: 'Gönderilemedi',
        message: error.message || 'Medya gönderilemedi',
        color: 'red',
      });
    } finally {
      setSendingMedia(false);
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'pending': return <Loader size={10} color="white" />;
      case 'sent': return <IconCheck size={12} color="rgba(255,255,255,0.7)" />;
      case 'delivered': return <IconChecks size={12} color="rgba(255,255,255,0.7)" />;
      case 'read': return <IconChecks size={12} color="#53BDEB" />;
      case 'error': return <IconX size={12} color="white" />;
      default: return <IconChecks size={12} color="rgba(255,255,255,0.7)" />;
    }
  };

  const filteredChats = chats.filter(chat => chat.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredMessages = messageSearch ? messages.filter(m => m.content.toLowerCase().includes(messageSearch.toLowerCase())) : messages;
  const typingUser = selectedChat ? getTypingUser(selectedChat.id) : null;
  const drawerWidth = expanded ? 600 : 400;

  return (
    <>
      {/* Floating Button */}
      <Tooltip label={connected ? `WhatsApp (${totalUnread} okunmamış)` : 'WhatsApp'} position="right">
        <Box
          onClick={toggle}
          style={{ position: 'fixed', bottom: 24, left: 24, zIndex: 1000, cursor: 'pointer' }}
        >
          <Indicator
            inline
            label={totalUnread > 0 ? totalUnread : undefined}
            size={totalUnread > 0 ? 22 : 0}
            offset={4}
            color="red"
            processing={totalUnread > 0}
          >
            <Paper
              shadow="xl"
              radius="xl"
              p={0}
              style={{
                width: 60,
                height: 60,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: connected 
                  ? 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)'
                  : 'linear-gradient(135deg, #6B7280 0%, #4B5563 100%)',
                border: '3px solid rgba(255,255,255,0.2)',
                transition: 'all 0.3s ease',
                transform: opened ? 'scale(0.9)' : 'scale(1)',
              }}
            >
              <IconBrandWhatsapp size={32} color="white" />
            </Paper>
          </Indicator>
        </Box>
      </Tooltip>

      {/* Drawer */}
      <Drawer
        opened={opened}
        onClose={close}
        position="left"
        size={drawerWidth}
        withCloseButton={false}
        padding={0}
        styles={{
          body: { height: '100%', padding: 0 },
          content: { background: 'linear-gradient(180deg, #0f1419 0%, #1a1f2e 100%)', borderRight: '1px solid rgba(255,255,255,0.08)' },
        }}
      >
        <Stack h="100%" gap={0}>
          {/* Header */}
          <Box
            p="md"
            style={{ background: 'linear-gradient(135deg, rgba(37,211,102,0.15) 0%, rgba(18,140,126,0.1) 100%)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
          >
            <Group justify="space-between">
              <Group gap="sm">
                <ThemeIcon size={40} radius="xl" variant="gradient" gradient={{ from: '#25D366', to: '#128C7E' }}>
                  <IconBrandWhatsapp size={22} />
                </ThemeIcon>
                <Box>
                  <Text fw={600} c="white" size="sm">WhatsApp</Text>
                  <Group gap={4}>
                    <Box style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? '#25D366' : '#EF4444' }} />
                    <Text size="xs" c={connected ? 'green' : 'red'}>{connected ? 'Bağlı' : 'Bağlı Değil'}</Text>
                  </Group>
                </Box>
              </Group>
              <Group gap="xs">
                {connected && (
                  <Tooltip label="Bağlantıyı Kes">
                    <ActionIcon variant="subtle" color="red" size="md" onClick={handleDisconnect}>
                      <IconPlugOff size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}
                <Tooltip label={expanded ? 'Küçült' : 'Genişlet'}>
                  <ActionIcon variant="subtle" color="gray" size="md" onClick={() => setExpanded(!expanded)}>
                    {expanded ? <IconMinimize size={16} /> : <IconMaximize size={16} />}
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Tam Sayfa">
                  <ActionIcon variant="subtle" color="gray" size="md" component={Link} href="/sosyal-medya/whatsapp">
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
              <Text c="gray.5" size="sm">Yükleniyor...</Text>
            </Stack>
          ) : !connected ? (
            <Stack align="center" justify="center" p="xl" style={{ flex: 1 }} gap="xl">
              {qrCode ? (
                <>
                  <Box p="md" style={{ background: 'white', borderRadius: 16 }}>
                    <img src={qrCode} alt="QR" style={{ width: 200, height: 200, borderRadius: 8 }} />
                  </Box>
                  <Stack gap="xs" ta="center">
                    <Text c="gray.4" size="sm">1. WhatsApp&apos;ı açın</Text>
                    <Text c="gray.4" size="sm">2. Bağlı Cihazlar → Cihaz Bağla</Text>
                    <Text c="gray.4" size="sm">3. QR kodu tarayın</Text>
                  </Stack>
                  <Button variant="light" color="gray" onClick={handleConnect} loading={connecting}>
                    QR&apos;ı Yenile
                  </Button>
                </>
              ) : (
                <>
                  <ThemeIcon size={80} radius="xl" variant="light" color="green">
                    <IconQrcode size={40} />
                  </ThemeIcon>
                  <Text c="gray.4" ta="center">WhatsApp hesabınızı bağlayın</Text>
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
            <Stack style={{ flex: 1 }} gap={0}>
              {/* Chat Header */}
              <Box p="sm" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
                <Group justify="space-between">
                  <Group gap="sm">
                    <ActionIcon variant="subtle" color="gray" onClick={() => setSelectedChat(null)}>
                      <IconChevronDown size={18} style={{ transform: 'rotate(90deg)' }} />
                    </ActionIcon>
                    <Avatar color="green" radius="xl" size={36} style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}>
                      {selectedChat.isGroup ? <IconUsers size={16} /> : selectedChat.name[0]?.toUpperCase()}
                    </Avatar>
                    <Box>
                      <Text fw={500} c="white" size="sm" truncate style={{ maxWidth: expanded ? 300 : 180 }}>
                        {selectedChat.name}
                      </Text>
                      <Text size="xs" c={typingUser ? 'green' : 'gray.5'}>
                        {typingUser ? `${typingUser.participantName} yazıyor...` : 'Çevrimiçi'}
                      </Text>
                    </Box>
                  </Group>
                  <Group gap={4}>
                    <ActionIcon variant="subtle" color="gray" size="md"><IconPhone size={16} /></ActionIcon>
                    <ActionIcon variant="subtle" color="gray" size="sm"><IconVideo size={16} /></ActionIcon>
                    <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setMessageSearch(messageSearch ? '' : ' ')}>
                      <IconSearch size={16} />
                    </ActionIcon>
                  </Group>
                </Group>
                
                {messageSearch !== '' && (
                  <TextInput
                    placeholder="Mesajlarda ara..."
                    value={messageSearch}
                    onChange={(e) => setMessageSearch(e.target.value)}
                    size="xs"
                    mt="xs"
                    leftSection={<IconSearch size={12} />}
                    rightSection={messageSearch && (
                      <ActionIcon size="xs" variant="subtle" onClick={() => setMessageSearch('')}>
                        <IconX size={12} />
                      </ActionIcon>
                    )}
                    styles={{ input: { background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white' } }}
                  />
                )}
              </Box>

              {/* Messages */}
              <ScrollArea style={{ flex: 1 }} viewportRef={messagesViewportRef} p="sm">
                {loadingMessages ? (
                  <Stack align="center" justify="center" h={200}>
                    <Loader color="green" size="sm" />
                  </Stack>
                ) : filteredMessages.length === 0 ? (
                  <Stack align="center" justify="center" h={200}>
                    <IconMessage size={40} color="gray" style={{ opacity: 0.3 }} />
                    <Text c="gray.6" size="sm">{messageSearch ? 'Mesaj bulunamadı' : 'Henüz mesaj yok'}</Text>
                  </Stack>
                ) : (
                  <Stack gap="xs">
                    {filteredMessages.map((msg) => (
                      <Box 
                        key={msg.id} 
                        style={{ 
                          display: 'flex', 
                          justifyContent: msg.fromMe ? 'flex-end' : 'flex-start',
                          cursor: msg.status === 'error' ? 'pointer' : 'default',
                        }}
                        onClick={() => msg.status === 'error' && handleRetryMessage(msg)}
                      >
                        <Box>
                          {selectedChat.isGroup && !msg.fromMe && msg.sender && (
                            <Text size="xs" fw={500} mb={2} style={{ color: getUserColor(msg.sender.id) }}>
                              {msg.sender.name}
                            </Text>
                          )}
                          <Paper
                            p="xs"
                            radius="lg"
                            style={{
                              maxWidth: '80%',
                              background: msg.status === 'error' 
                                ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
                                : msg.fromMe 
                                  ? 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)' 
                                  : 'rgba(255,255,255,0.08)',
                              borderBottomRightRadius: msg.fromMe ? 4 : 12,
                              borderBottomLeftRadius: msg.fromMe ? 12 : 4,
                              opacity: msg.status === 'pending' ? 0.7 : 1,
                            }}
                          >
                            {messageSearch ? (
                              <Highlight
                                highlight={messageSearch}
                                style={{ fontSize: 12, color: msg.fromMe ? 'white' : '#e0e0e0', wordBreak: 'break-word' }}
                              >
                                {msg.content}
                              </Highlight>
                            ) : (
                              <Text size="xs" c={msg.fromMe ? 'white' : 'gray.2'} style={{ wordBreak: 'break-word' }}>
                                {msg.content}
                              </Text>
                            )}
                            <Group gap={4} justify="flex-end" mt={2}>
                              <Text size="xs" c={msg.fromMe ? 'rgba(255,255,255,0.7)' : 'gray.6'}>{msg.timestamp}</Text>
                              {msg.fromMe && getStatusIcon(msg.status)}
                            </Group>
                            {msg.status === 'error' && (
                              <Text size="xs" c="white" ta="center" mt={4} fw={500}>⟳ Tekrar dene</Text>
                            )}
                          </Paper>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                )}
              </ScrollArea>

              {/* Input */}
              <Box p="sm" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
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
                  ref={documentInputRef}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileSelect(e, 'document')}
                />
                
                <Group gap="xs">
                  <ActionIcon variant="subtle" color="gray" size="sm"><IconMoodSmile size={18} /></ActionIcon>
                  <Menu shadow="md" width={160} position="top-start">
                    <Menu.Target>
                      <ActionIcon 
                        variant="subtle" 
                        color="gray" 
                        size="sm"
                        loading={sendingMedia}
                      >
                        <IconPaperclip size={18} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item 
                        leftSection={<IconPhoto size={14} color="#25D366" />}
                        onClick={() => photoInputRef.current?.click()}
                        disabled={sendingMedia}
                      >
                        Fotoğraf
                      </Menu.Item>
                      <Menu.Item 
                        leftSection={<IconFile size={14} color="#EF4444" />}
                        onClick={() => documentInputRef.current?.click()}
                        disabled={sendingMedia}
                      >
                        Döküman
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
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
                    styles={{ input: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: 13 } }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  {messageInput.trim() ? (
                    <ActionIcon size={32} radius="xl" variant="gradient" gradient={{ from: '#25D366', to: '#128C7E' }} onClick={handleSendMessage}>
                      <IconSend size={16} />
                    </ActionIcon>
                  ) : (
                    <ActionIcon size={32} radius="xl" variant="light" color="green">
                      <IconMicrophone size={16} />
                    </ActionIcon>
                  )}
                </Group>
              </Box>
            </Stack>
          ) : (
            <Stack style={{ flex: 1 }} gap={0}>
              <Box p="sm" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <TextInput
                  placeholder="Sohbet ara..."
                  leftSection={<IconSearch size={14} />}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  size="xs"
                  radius="lg"
                  styles={{ input: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' } }}
                />
              </Box>

              <ScrollArea style={{ flex: 1 }}>
                {archivedChats.length > 0 && (
                  <Box px="sm" py="xs" onClick={() => setShowArchived(!showArchived)} style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }}>
                    <Group justify="space-between">
                      <Group gap="xs">
                        <IconArchive size={16} color="gray" />
                        <Text size="xs" c="gray.5">Arşivlenmiş ({archivedChats.length})</Text>
                      </Group>
                      {showArchived ? <IconChevronUp size={14} color="gray" /> : <IconChevronDown size={14} color="gray" />}
                    </Group>
                  </Box>
                )}

                {showArchived && archivedChats.map((chat) => (
                  <ChatItem key={chat.id} chat={chat} onClick={() => handleSelectChat(chat)} selected={false} />
                ))}

                {filteredChats.length === 0 ? (
                  <Stack align="center" justify="center" h={200}>
                    <IconMessage size={40} color="gray" style={{ opacity: 0.3 }} />
                    <Text c="gray.6" size="sm">Sohbet bulunamadı</Text>
                  </Stack>
                ) : (
                  filteredChats.map((chat) => (
                    <ChatItem key={chat.id} chat={chat} onClick={() => handleSelectChat(chat)} selected={false} />
                  ))
                )}
              </ScrollArea>

              <Box p="xs" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
                <Group justify="space-around">
                  <Box ta="center">
                    <Text size="lg" fw={700} c="white">{chats.length}</Text>
                    <Text size="xs" c="gray.6">Sohbet</Text>
                  </Box>
                  <Box ta="center">
                    <Text size="lg" fw={700} c="red">{totalUnread}</Text>
                    <Text size="xs" c="gray.6">Okunmamış</Text>
                  </Box>
                  <Box ta="center">
                    <Text size="lg" fw={700} c="blue">{chats.filter(c => c.isGroup).length}</Text>
                    <Text size="xs" c="gray.6">Grup</Text>
                  </Box>
                </Group>
              </Box>
            </Stack>
          )}
        </Stack>
      </Drawer>
    </>
  );
}

function ChatItem({ chat, onClick, selected }: { chat: Chat; onClick: () => void; selected: boolean }) {
  return (
    <Box
      px="sm"
      py="xs"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        background: selected ? 'linear-gradient(90deg, rgba(37,211,102,0.15) 0%, transparent 100%)' : 'transparent',
        borderLeft: selected ? '3px solid #25D366' : '3px solid transparent',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <Group wrap="nowrap" gap="sm">
        <Indicator color="green" size={8} offset={3} disabled={chat.unreadCount === 0}>
          <Avatar
            color={chat.isGroup ? 'blue' : 'green'}
            radius="xl"
            size={40}
            style={{
              background: chat.isGroup
                ? 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)'
                : 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
            }}
          >
            {chat.isGroup ? <IconUsers size={18} /> : chat.name[0]?.toUpperCase()}
          </Avatar>
        </Indicator>
        <Box style={{ flex: 1, overflow: 'hidden' }}>
          <Group justify="space-between" wrap="wrap">
            <Text fw={500} c="white" size="sm" truncate>{chat.name}</Text>
            <Text size="xs" c="gray.6">{chat.timestamp}</Text>
          </Group>
          <Text size="xs" c="gray.5" truncate>{chat.lastMessage || 'Mesaj yok'}</Text>
        </Box>
        {chat.unreadCount > 0 && (
          <Badge size="sm" circle color="green" style={{ minWidth: 20 }}>
            {chat.unreadCount}
          </Badge>
        )}
      </Group>
    </Box>
  );
}

export default WhatsAppWidget;
