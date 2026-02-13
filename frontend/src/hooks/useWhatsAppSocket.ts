'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from '@/lib/config';
import logger from '@/lib/logger';

// WhatsApp servisinin aktif olup olmadığını kontrol et
// Environment variable ile kontrol edilebilir
const WHATSAPP_ENABLED = process.env.NEXT_PUBLIC_WHATSAPP_ENABLED === 'true';

// Extract base URL without /api path
const getSocketUrl = () => {
  // API_BASE_URL comes from config (local or production)
  // WhatsApp service runs on port 3002
  const baseUrl = API_BASE_URL.replace('/api', '').replace(':3001', ':3002');
  return baseUrl;
};

export interface WhatsAppMessage {
  chatId: string;
  messageId: string;
  body: string;
  timestamp: number;
  fromMe: boolean;
  type: string;
  senderName: string;
  sender?: {
    id: string;
    name: string;
    phone: string;
  } | null;
  isGroup: boolean;
}

export interface ConnectionStatus {
  connected: boolean;
  status: string;
  error: string | null;
  retryCount: number;
  lastConnected: string | null;
}

export interface TypingUpdate {
  chatId: string;
  participantId: string;
  participantName: string;
  isTyping: boolean;
}

export interface PresenceUpdate {
  chatId: string;
  participantId: string;
  participantName: string;
  presence: 'composing' | 'available' | 'unavailable' | 'paused';
  lastSeen?: number;
}

export interface MessageStatus {
  chatId: string;
  messageId: string;
  fromMe: boolean;
  status: 'error' | 'pending' | 'sent' | 'delivered' | 'read' | 'played' | 'unknown';
  statusCode: number;
}

interface UseWhatsAppSocketOptions {
  onNewMessage?: (message: WhatsAppMessage) => void;
  onConnectionStatus?: (status: ConnectionStatus) => void;
  onTypingUpdate?: (update: TypingUpdate) => void;
  onPresenceUpdate?: (update: PresenceUpdate) => void;
  onMessageStatus?: (status: MessageStatus) => void;
  onQRUpdate?: (qr: string) => void;
  autoConnect?: boolean;
}

export function useWhatsAppSocket(options: UseWhatsAppSocketOptions = {}) {
  const {
    onNewMessage,
    onConnectionStatus,
    onTypingUpdate,
    onPresenceUpdate,
    onMessageStatus,
    onQRUpdate,
    autoConnect = true,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [waStatus, setWaStatus] = useState<ConnectionStatus>({
    connected: false,
    status: 'disconnected',
    error: null,
    retryCount: 0,
    lastConnected: null,
  });
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingUpdate>>(new Map());

  // Store callbacks in refs to avoid re-connecting on callback changes
  const callbackRefs = useRef({
    onNewMessage,
    onConnectionStatus,
    onTypingUpdate,
    onPresenceUpdate,
    onMessageStatus,
    onQRUpdate,
  });

  // Update refs when callbacks change (without triggering effect)
  useEffect(() => {
    callbackRefs.current = {
      onNewMessage,
      onConnectionStatus,
      onTypingUpdate,
      onPresenceUpdate,
      onMessageStatus,
      onQRUpdate,
    };
  });

  // Initialize socket connection - only depends on autoConnect
  useEffect(() => {
    // WhatsApp servisi devre dışıysa bağlanma
    if (!WHATSAPP_ENABLED) {
      logger.debug('[WhatsApp Socket] WhatsApp servisi devre dışı (NEXT_PUBLIC_WHATSAPP_ENABLED=false)');
      return;
    }

    if (!autoConnect) return;

    // Prevent multiple connections
    if (socketRef.current?.connected) {
      logger.debug('[WhatsApp Socket] Already connected, skipping');
      return;
    }

    const socketUrl = getSocketUrl();
    logger.debug('[WhatsApp Socket] Connecting to:', { socketUrl });

    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      logger.info('[WhatsApp Socket] Connected', { socketId: socket.id });
      setIsSocketConnected(true);
    });

    socket.on('disconnect', (reason) => {
      logger.warn('[WhatsApp Socket] Disconnected', { reason });
      setIsSocketConnected(false);
    });

    socket.on('connect_error', (error) => {
      logger.error('[WhatsApp Socket] Connection error', {
        message: error.message || 'Connection failed',
        name: error.name,
        description:
          (error as Error & { description?: string }).description ||
          `Unable to connect to WhatsApp service at ${socketUrl}. Is the service running?`,
      });
      setIsSocketConnected(false);
    });

    // WhatsApp connection status
    socket.on('connection:status', (status: ConnectionStatus) => {
      logger.debug('[WhatsApp Socket] WA Status', { status: status.status });
      setWaStatus(status);
      callbackRefs.current.onConnectionStatus?.(status);

      // Clear QR when connected
      if (status.connected) {
        setQrCode(null);
      }
    });

    // QR code updates
    socket.on('qr:update', (data: { qr: string }) => {
      logger.info('[WhatsApp Socket] QR received');
      setQrCode(data.qr);
      callbackRefs.current.onQRUpdate?.(data.qr);
    });

    // New messages
    socket.on('message:new', (message: WhatsAppMessage) => {
      logger.debug('[WhatsApp Socket] New message from:', { senderName: message.senderName });
      callbackRefs.current.onNewMessage?.(message);
    });

    // Typing indicators
    socket.on('typing:update', (update: TypingUpdate) => {
      if (update.isTyping) {
        setTypingUsers((prev) => new Map(prev).set(update.chatId, update));

        // Auto-clear typing after 10 seconds
        setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Map(prev);
            next.delete(update.chatId);
            return next;
          });
        }, 10000);
      } else {
        setTypingUsers((prev) => {
          const next = new Map(prev);
          next.delete(update.chatId);
          return next;
        });
      }
      callbackRefs.current.onTypingUpdate?.(update);
    });

    // Presence updates
    socket.on('presence:update', (update: PresenceUpdate) => {
      callbackRefs.current.onPresenceUpdate?.(update);
    });

    // Message status updates
    socket.on('message:status', (status: MessageStatus) => {
      callbackRefs.current.onMessageStatus?.(status);
    });

    return () => {
      logger.debug('[WhatsApp Socket] Cleaning up');
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [autoConnect]); // Only autoConnect - callbacks are in refs

  // Send typing indicator
  const sendTypingStart = useCallback((chatId: string) => {
    socketRef.current?.emit('typing:start', { chatId });
  }, []);

  const sendTypingStop = useCallback((chatId: string) => {
    socketRef.current?.emit('typing:stop', { chatId });
  }, []);

  // Subscribe to presence for a chat
  const subscribeToPresence = useCallback((chatId: string) => {
    socketRef.current?.emit('presence:subscribe', { chatId });
  }, []);

  // Get typing user for a specific chat
  const getTypingUser = useCallback(
    (chatId: string) => {
      return typingUsers.get(chatId);
    },
    [typingUsers]
  );

  return {
    socket: socketRef.current,
    isSocketConnected,
    waStatus,
    qrCode,
    typingUsers,
    sendTypingStart,
    sendTypingStop,
    subscribeToPresence,
    getTypingUser,
  };
}

export default useWhatsAppSocket;
