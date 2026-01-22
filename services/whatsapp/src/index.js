import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode';
import pino from 'pino';
import dotenv from 'dotenv';
import { Boom } from '@hapi/boom';
import fs from 'fs';
import path from 'path';
import pg from 'pg';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;
const USER_ID = 1; // Şimdilik sabit user_id - sonra auth'dan alınabilir

// Create HTTP server and Socket.IO
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: ['http://localhost:3000', 'https://catering-tr.com', process.env.FRONTEND_URL].filter(Boolean),
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Track connected socket clients
const connectedClients = new Set();

app.use(cors());
app.use(express.json());

// Logger
const logger = pino({ level: 'warn' });

// PostgreSQL bağlantısı (Supabase)
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Simple in-memory store (hızlı erişim için)
const chatStore = new Map();
const messageStore = new Map();
const contactStore = new Map();

// Cache dosyaları
const CACHE_DIR = './cache';
const MEDIA_DIR = './media'; // Medya dosyaları için
const CHATS_CACHE = path.join(CACHE_DIR, 'chats.json');
const CONTACTS_CACHE = path.join(CACHE_DIR, 'contacts.json');
const MESSAGES_CACHE = path.join(CACHE_DIR, 'messages.json');

// Klasörleri oluştur
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}
if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

// Medya kaydetme fonksiyonu
async function saveMediaToFile(messageId, buffer, mimetype, filename) {
  try {
    // Dosya uzantısını belirle
    const ext = mimetype?.split('/')[1]?.split(';')[0] || 'bin';
    const safeFilename = filename || `${messageId}.${ext}`;
    const filePath = path.join(MEDIA_DIR, safeFilename);
    
    // Dosyayı kaydet
    fs.writeFileSync(filePath, buffer);
    console.log(`[Media] Saved: ${filePath} (${buffer.length} bytes)`);
    
    // DB'ye kaydet
    await pool.query(`
      INSERT INTO whatsapp_media (user_id, message_id, file_path, file_name, mime_type, file_size)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id, message_id) DO UPDATE SET
        file_path = EXCLUDED.file_path,
        file_name = EXCLUDED.file_name
    `, [USER_ID, messageId, filePath, safeFilename, mimetype, buffer.length]);
    
    return filePath;
  } catch (e) {
    console.error('[Media] Save error:', e.message);
    return null;
  }
}

// Medya indirme ve kaydetme (arka planda)
async function downloadAndSaveMedia(msg) {
  try {
    const messageContent = msg.message;
    const messageId = msg.key?.id;
    if (!messageContent || !messageId) return;
    
    const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage'];
    let mediaMessage = null;
    let mediaType = null;
    
    for (const type of mediaTypes) {
      if (messageContent[type]) {
        mediaMessage = messageContent[type];
        mediaType = type;
        break;
      }
    }
    
    if (!mediaMessage) return;
    
    console.log(`[Media] Downloading ${mediaType} for message ${messageId}...`);
    
    const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
    const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger });
    
    if (buffer) {
      const mimetype = mediaMessage.mimetype || 'application/octet-stream';
      const filename = mediaMessage.fileName || `${messageId}.${mimetype.split('/')[1] || 'bin'}`;
      await saveMediaToFile(messageId, buffer, mimetype, filename);
    }
  } catch (e) {
    console.error('[Media] Download failed:', e.message);
  }
}

// Cache kaydetme fonksiyonları
function saveChatsCache() {
  try {
    const data = Object.fromEntries(chatStore);
    fs.writeFileSync(CHATS_CACHE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[Cache] Error saving chats:', e.message);
  }
}

function saveContactsCache() {
  try {
    const data = Object.fromEntries(contactStore);
    fs.writeFileSync(CONTACTS_CACHE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[Cache] Error saving contacts:', e.message);
  }
}

function saveMessagesCache() {
  try {
    // Map içindeki her chat için son 50 mesajı kaydet
    const data = {};
    for (const [chatId, messages] of messageStore) {
      data[chatId] = messages.slice(-50);
    }
    fs.writeFileSync(MESSAGES_CACHE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[Cache] Error saving messages:', e.message);
  }
}

// Cache yükleme fonksiyonu
function loadCache() {
  try {
    // Chats
    if (fs.existsSync(CHATS_CACHE)) {
      const data = JSON.parse(fs.readFileSync(CHATS_CACHE, 'utf8'));
      for (const [id, chat] of Object.entries(data)) {
        chatStore.set(id, chat);
      }
      console.log(`[Cache] Loaded ${chatStore.size} chats`);
    }
    
    // Contacts
    if (fs.existsSync(CONTACTS_CACHE)) {
      const data = JSON.parse(fs.readFileSync(CONTACTS_CACHE, 'utf8'));
      for (const [id, contact] of Object.entries(data)) {
        contactStore.set(id, contact);
      }
      console.log(`[Cache] Loaded ${contactStore.size} contacts`);
    }
    
    // Messages
    if (fs.existsSync(MESSAGES_CACHE)) {
      const data = JSON.parse(fs.readFileSync(MESSAGES_CACHE, 'utf8'));
      for (const [chatId, messages] of Object.entries(data)) {
        messageStore.set(chatId, messages);
      }
      console.log(`[Cache] Loaded messages for ${messageStore.size} chats`);
    }
  } catch (e) {
    console.error('[Cache] Error loading cache:', e.message);
  }
}

// ============ SUPABASE KAYIT FONKSİYONLARI ============

// Contact kaydet/güncelle
async function saveContactToDb(waId, name, pushName, isGroup = false) {
  try {
    await pool.query(`
      INSERT INTO whatsapp_contacts (user_id, wa_id, name, push_name, phone, is_group)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id, wa_id) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, whatsapp_contacts.name),
        push_name = COALESCE(EXCLUDED.push_name, whatsapp_contacts.push_name),
        updated_at = NOW()
    `, [USER_ID, waId, name, pushName, waId.split('@')[0], isGroup]);
  } catch (e) {
    console.error('[DB] Error saving contact:', e.message);
  }
}

// Chat kaydet/güncelle
async function saveChatToDb(waId, name, isGroup, lastMessage = null, lastMessageTime = null) {
  try {
    await pool.query(`
      INSERT INTO whatsapp_chats (user_id, wa_id, name, is_group, last_message, last_message_time)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id, wa_id) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, whatsapp_chats.name),
        last_message = COALESCE(EXCLUDED.last_message, whatsapp_chats.last_message),
        last_message_time = COALESCE(EXCLUDED.last_message_time, whatsapp_chats.last_message_time),
        updated_at = NOW()
    `, [USER_ID, waId, name, isGroup, lastMessage, lastMessageTime]);
  } catch (e) {
    console.error('[DB] Error saving chat:', e.message);
  }
}

// Mesaj kaydet
async function saveMessageToDb(chatId, messageId, body, fromMe, timestamp, messageType = 'text') {
  try {
    await pool.query(`
      INSERT INTO whatsapp_messages (user_id, chat_id, message_id, body, from_me, timestamp, message_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id, message_id) DO NOTHING
    `, [USER_ID, chatId, messageId, body, fromMe, new Date(timestamp * 1000), messageType]);
  } catch (e) {
    console.error('[DB] Error saving message:', e.message);
  }
}

// Veritabanından yükle
async function loadFromDb() {
  try {
    // Contacts
    const contactsResult = await pool.query(
      'SELECT wa_id, name, push_name, is_group FROM whatsapp_contacts WHERE user_id = $1',
      [USER_ID]
    );
    for (const row of contactsResult.rows) {
      contactStore.set(row.wa_id, { id: row.wa_id, name: row.name, pushName: row.push_name, isGroup: row.is_group });
    }
    console.log(`[DB] Loaded ${contactStore.size} contacts`);

    // Chats
    const chatsResult = await pool.query(
      'SELECT wa_id, name, is_group, last_message, last_message_time FROM whatsapp_chats WHERE user_id = $1 ORDER BY last_message_time DESC NULLS LAST',
      [USER_ID]
    );
    for (const row of chatsResult.rows) {
      chatStore.set(row.wa_id, { 
        id: row.wa_id, 
        name: row.name, 
        isGroup: row.is_group,
        lastMessage: row.last_message,
        lastMessageTime: row.last_message_time
      });
    }
    console.log(`[DB] Loaded ${chatStore.size} chats`);

    // Messages (her chat için son 500)
    const messagesResult = await pool.query(`
      SELECT chat_id, message_id, body, from_me, timestamp, message_type
      FROM whatsapp_messages 
      WHERE user_id = $1
      ORDER BY timestamp ASC
    `, [USER_ID]);
    
    for (const row of messagesResult.rows) {
      if (!messageStore.has(row.chat_id)) {
        messageStore.set(row.chat_id, []);
      }
      
      // message_type'a göre doğru mesaj yapısı oluştur
      let messageObj = {};
      const msgType = row.message_type || 'text';
      
      if (msgType === 'imageMessage') {
        messageObj.imageMessage = { 
          caption: row.body?.replace('🖼️ Fotoğraf', '').trim() || '',
          mimetype: 'image/jpeg'
        };
      } else if (msgType === 'documentMessage') {
        // Dosya adını body'den çıkar
        const filename = row.body?.replace('📎 ', '').trim() || 'document';
        messageObj.documentMessage = { 
          fileName: filename,
          mimetype: 'application/pdf',
          caption: ''
        };
      } else if (msgType === 'videoMessage') {
        messageObj.videoMessage = { 
          caption: row.body?.replace('🎬 Video', '').trim() || '',
          mimetype: 'video/mp4'
        };
      } else if (msgType === 'audioMessage') {
        messageObj.audioMessage = { mimetype: 'audio/ogg' };
      } else if (msgType === 'stickerMessage') {
        messageObj.stickerMessage = { mimetype: 'image/webp' };
      } else {
        messageObj.conversation = row.body || '';
      }
      
      messageStore.get(row.chat_id).push({
        key: { id: row.message_id, remoteJid: row.chat_id, fromMe: row.from_me },
        message: messageObj,
        messageTimestamp: Math.floor(new Date(row.timestamp).getTime() / 1000),
        _dbLoaded: true // DB'den yüklendiğini işaretle
      });
    }
    console.log(`[DB] Loaded messages for ${messageStore.size} chats`);
  } catch (e) {
    console.error('[DB] Error loading from database:', e.message);
  }
}

// Debounced batch save
let saveTimeout = null;
const pendingSaves = { contacts: [], chats: [], messages: [] };

function queueSave(type, data) {
  pendingSaves[type].push(data);
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(flushSaves, 2000);
}

async function flushSaves() {
  // Contacts
  for (const c of pendingSaves.contacts) {
    await saveContactToDb(c.waId, c.name, c.pushName, c.isGroup);
  }
  // Chats
  for (const c of pendingSaves.chats) {
    await saveChatToDb(c.waId, c.name, c.isGroup, c.lastMessage, c.lastMessageTime);
  }
  // Messages
  for (const m of pendingSaves.messages) {
    await saveMessageToDb(m.chatId, m.messageId, m.body, m.fromMe, m.timestamp, m.messageType);
  }
  pendingSaves.contacts = [];
  pendingSaves.chats = [];
  pendingSaves.messages = [];
}

// Başlangıçta veritabanından yükle
loadFromDb().catch(e => console.error('[DB] Initial load failed:', e.message));

// ============ CONNECTION STATE MANAGEMENT ============
let sock = null;
let qrCodeData = null;
let isReady = false;
const AUTH_FOLDER = './auth_info';

// Enhanced connection state
const connectionState = {
  status: 'disconnected', // disconnected, connecting, qr_ready, connected, reconnecting, error
  lastError: null,
  lastConnected: null,
  retryCount: 0,
  maxRetries: 10,
  baseDelay: 1000,    // 1 saniye
  maxDelay: 30000,    // Max 30 saniye
  healthCheckInterval: null,
  reconnectTimeout: null,
};

// Backwards compatibility
let connectionStatus = 'disconnected';

// Update connection status helper
function updateConnectionStatus(status, error = null) {
  connectionState.status = status;
  connectionStatus = status; // backwards compatibility
  connectionState.lastError = error;
  
  if (status === 'connected') {
    connectionState.lastConnected = new Date();
    connectionState.retryCount = 0;
  }
  
  console.log(`[Connection] Status: ${status}${error ? ` - ${error}` : ''}`);
  
  // Emit to all connected Socket.IO clients
  io.emit('connection:status', {
    connected: status === 'connected',
    status: status,
    error: error,
    retryCount: connectionState.retryCount,
    lastConnected: connectionState.lastConnected,
  });
}

// Calculate exponential backoff delay
function getReconnectDelay() {
  const delay = Math.min(
    connectionState.baseDelay * Math.pow(2, connectionState.retryCount),
    connectionState.maxDelay
  );
  // Add jitter (±20%)
  const jitter = delay * 0.2 * (Math.random() - 0.5);
  return Math.floor(delay + jitter);
}

// Clear any pending reconnect
function clearReconnectTimeout() {
  if (connectionState.reconnectTimeout) {
    clearTimeout(connectionState.reconnectTimeout);
    connectionState.reconnectTimeout = null;
  }
}

// Cooldown to prevent rapid reconnect attempts
let lastReconnectAttempt = 0;
const RECONNECT_COOLDOWN = 5000; // 5 seconds minimum between reconnects

// Schedule reconnection with exponential backoff
function scheduleReconnect(reason = 'unknown') {
  // Check cooldown
  const now = Date.now();
  if (now - lastReconnectAttempt < RECONNECT_COOLDOWN) {
    console.log(`[Connection] Reconnect cooldown active, skipping (reason: ${reason})`);
    return;
  }
  lastReconnectAttempt = now;
  
  clearReconnectTimeout();
  
  if (connectionState.retryCount >= connectionState.maxRetries) {
    console.log(`[Connection] Max retries (${connectionState.maxRetries}) reached. Manual reconnect required.`);
    updateConnectionStatus('error', `Bağlantı ${connectionState.maxRetries} deneme sonrası başarısız`);
    return;
  }
  
  connectionState.retryCount++;
  const delay = getReconnectDelay();
  
  console.log(`[Connection] Scheduling reconnect #${connectionState.retryCount} in ${delay}ms (reason: ${reason})`);
  updateConnectionStatus('reconnecting', `Yeniden bağlanılıyor... (${connectionState.retryCount}/${connectionState.maxRetries})`);
  
  connectionState.reconnectTimeout = setTimeout(() => {
    connectToWhatsApp();
  }, delay);
}

// Health check - verify connection is still active
let healthCheckFailures = 0;
const MAX_HEALTH_FAILURES = 3; // Reconnect after 3 consecutive failures

function startHealthCheck() {
  stopHealthCheck();
  healthCheckFailures = 0;
  
  connectionState.healthCheckInterval = setInterval(async () => {
    if (!sock || !isReady) return;
    
    try {
      // Simple ping to verify socket is responsive
      const state = sock.ws?.readyState;
      if (state !== 1) { // 1 = OPEN
        healthCheckFailures++;
        console.log(`[Health] WebSocket not open (state: ${state}), failure ${healthCheckFailures}/${MAX_HEALTH_FAILURES}`);
        
        if (healthCheckFailures >= MAX_HEALTH_FAILURES) {
          console.log('[Health] Max failures reached, triggering reconnect');
          healthCheckFailures = 0;
          scheduleReconnect('health_check_failed');
        }
      } else {
        // Reset failures on successful check
        if (healthCheckFailures > 0) {
          console.log('[Health] Connection recovered');
          healthCheckFailures = 0;
        }
      }
    } catch (e) {
      console.log(`[Health] Check error: ${e.message}`);
    }
  }, 45000); // Check every 45 seconds (less aggressive)
}

function stopHealthCheck() {
  if (connectionState.healthCheckInterval) {
    clearInterval(connectionState.healthCheckInterval);
    connectionState.healthCheckInterval = null;
  }
}

// Clean corrupted session
async function cleanSession() {
  console.log('[Session] Cleaning corrupted session files...');
  stopHealthCheck();
  clearReconnectTimeout();
  
  if (sock) {
    try {
      sock.ev.removeAllListeners();
      await sock.logout().catch(() => {});
    } catch (e) {}
    sock = null;
  }
  
  // Remove auth folder
  if (fs.existsSync(AUTH_FOLDER)) {
    try {
      fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
      console.log('[Session] Auth folder removed');
    } catch (e) {
      console.error('[Session] Failed to remove auth folder:', e.message);
    }
  }
  
  isReady = false;
  qrCodeData = null;
  connectionState.retryCount = 0;
  updateConnectionStatus('disconnected');
}

// Initialize WhatsApp Connection
async function connectToWhatsApp() {
  // Prevent multiple simultaneous connection attempts
  if (connectionState.status === 'connecting') {
    console.log('[Connection] Already connecting, skipping...');
    return;
  }
  
  clearReconnectTimeout();
  updateConnectionStatus('connecting');
  
  try {
    // Auth state
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    
    // Get latest version
    const { version } = await fetchLatestBaileysVersion();
    console.log(`[Connection] Using WA version: ${version.join('.')}`);
    
    // Create socket with history sync
    sock = makeWASocket({
      version,
      logger,
      printQRInTerminal: true,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger)
      },
      generateHighQualityLinkPreview: true,
      syncFullHistory: true,  // Tüm geçmişi senkronize et
      // Connection timeout settings
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      // Retry settings
      retryRequestDelayMs: 250,
      maxMsgRetryCount: 5,
    });
    
    // Save credentials on update
    sock.ev.on('creds.update', saveCreds);
    
    // Chat updates - store chats
    sock.ev.on('chats.upsert', (chats) => {
      for (const chat of chats) {
        chatStore.set(chat.id, chat);
        // DB'ye kaydet
        queueSave('chats', {
          waId: chat.id,
          name: chat.name || chat.subject,
          isGroup: chat.id.endsWith('@g.us'),
          lastMessage: null,
          lastMessageTime: null
        });
      }
    });
    
    sock.ev.on('chats.update', (updates) => {
      for (const update of updates) {
        const existing = chatStore.get(update.id) || {};
        chatStore.set(update.id, { ...existing, ...update });
        // DB'ye kaydet
        queueSave('chats', {
          waId: update.id,
          name: update.name || existing.name,
          isGroup: update.id.endsWith('@g.us'),
          lastMessage: null,
          lastMessageTime: null
        });
      }
    });
    
    // Contacts - store contact names
    sock.ev.on('contacts.upsert', (contacts) => {
      for (const contact of contacts) {
        contactStore.set(contact.id, contact);
        // DB'ye kaydet
        queueSave('contacts', {
          waId: contact.id,
          name: contact.name || contact.verifiedName,
          pushName: contact.notify,
          isGroup: contact.id.endsWith('@g.us')
        });
      }
      console.log(`[Contacts] Loaded ${contacts.length} contacts`);
    });
    
    sock.ev.on('contacts.update', (updates) => {
      for (const update of updates) {
        const existing = contactStore.get(update.id) || {};
        contactStore.set(update.id, { ...existing, ...update });
        // DB'ye kaydet
        queueSave('contacts', {
          waId: update.id,
          name: update.name || existing.name,
          pushName: update.notify || existing.notify,
          isGroup: update.id.endsWith('@g.us')
        });
      }
    });
    
    // History sync - eski sohbetler ve mesajlar
    sock.ev.on('messaging-history.set', ({ chats: syncedChats, contacts: syncedContacts, messages: syncedMessages }) => {
      console.log(`[History] Syncing ${syncedChats?.length || 0} chats, ${syncedContacts?.length || 0} contacts, ${syncedMessages?.length || 0} messages`);
      
      // Chats
      if (syncedChats) {
        for (const chat of syncedChats) {
          chatStore.set(chat.id, chat);
          queueSave('chats', {
            waId: chat.id,
            name: chat.name || chat.subject,
            isGroup: chat.id.endsWith('@g.us'),
            lastMessage: null,
            lastMessageTime: null
          });
        }
      }
      
      // Contacts
      if (syncedContacts) {
        for (const contact of syncedContacts) {
          contactStore.set(contact.id, contact);
          queueSave('contacts', {
            waId: contact.id,
            name: contact.name || contact.verifiedName,
            pushName: contact.notify,
            isGroup: contact.id.endsWith('@g.us')
          });
        }
      }
      
      // Messages
      if (syncedMessages) {
        for (const msg of syncedMessages) {
          const chatId = msg.key?.remoteJid;
          if (chatId) {
            if (!messageStore.has(chatId)) {
              messageStore.set(chatId, []);
            }
            const messages = messageStore.get(chatId);
            if (!messages.find(m => m.key?.id === msg.key?.id)) {
              messages.push(msg);
              // DB'ye kaydet
              const body = msg.message?.conversation || 
                          msg.message?.extendedTextMessage?.text || 
                          (msg.message?.imageMessage ? '🖼️ Fotoğraf' : '') ||
                          (msg.message?.videoMessage ? '🎥 Video' : '') ||
                          (msg.message?.documentMessage ? '📎 Dosya' : '') ||
                          '';
              queueSave('messages', {
                chatId: chatId,
                messageId: msg.key.id,
                body: body,
                fromMe: msg.key.fromMe || false,
                timestamp: msg.messageTimestamp || Math.floor(Date.now() / 1000),
                messageType: Object.keys(msg.message || {})[0] || 'text'
              });
            }
          }
        }
      }
      
      console.log(`[History] Total: ${chatStore.size} chats, ${contactStore.size} contacts, ${messageStore.size} chat messages`);
    });
    
    // Connection update handler with enhanced error handling
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr, isNewLogin } = update;
      
      if (qr) {
        console.log('[Connection] QR Code received');
        qrCodeData = await qrcode.toDataURL(qr);
        updateConnectionStatus('qr_ready');
        connectionState.retryCount = 0; // Reset retry count when QR is shown
        
        // Emit QR to all connected clients
        io.emit('qr:update', { qr: qrCodeData });
      }
      
      if (connection === 'close') {
        isReady = false;
        stopHealthCheck();
        
        const statusCode = (lastDisconnect?.error instanceof Boom)
          ? lastDisconnect.error.output?.statusCode
          : null;
        
        const errorMessage = lastDisconnect?.error?.message || 'Unknown error';
        
        console.log(`[Connection] Closed - Status: ${statusCode}, Error: ${errorMessage}`);
        
        // Determine reconnection strategy based on disconnect reason
        let shouldReconnect = true;
        let needsCleanSession = false;
        
        switch (statusCode) {
          case DisconnectReason.loggedOut:
            // User logged out from phone
            console.log('[Connection] Logged out from phone - session cleanup required');
            shouldReconnect = false;
            needsCleanSession = true;
            break;
            
          case DisconnectReason.badSession:
            // Session corrupted
            console.log('[Connection] Bad session detected - cleaning up');
            needsCleanSession = true;
            shouldReconnect = true;
            break;
            
          case DisconnectReason.connectionClosed:
          case DisconnectReason.connectionLost:
            // Network issues - normal reconnect
            console.log('[Connection] Connection lost - will reconnect');
            shouldReconnect = true;
            break;
            
          case DisconnectReason.connectionReplaced:
            // Another device/session took over
            console.log('[Connection] Connection replaced by another device');
            shouldReconnect = false;
            break;
            
          case DisconnectReason.timedOut:
            // Timeout - retry
            console.log('[Connection] Connection timed out - will retry');
            shouldReconnect = true;
            break;
            
          case DisconnectReason.restartRequired:
            // Restart needed
            console.log('[Connection] Restart required');
            shouldReconnect = true;
            break;
            
          case DisconnectReason.multideviceMismatch:
            // Multi-device version mismatch
            console.log('[Connection] Multi-device mismatch - cleaning session');
            needsCleanSession = true;
            shouldReconnect = true;
            break;
            
          default:
            // Unknown - try to reconnect
            console.log(`[Connection] Unknown disconnect reason (${statusCode}) - will retry`);
            shouldReconnect = true;
        }
        
        if (needsCleanSession) {
          await cleanSession();
        }
        
        if (shouldReconnect) {
          scheduleReconnect(statusCode ? `status_${statusCode}` : 'unknown');
        } else {
          updateConnectionStatus('disconnected', errorMessage);
        }
        
      } else if (connection === 'open') {
        console.log('[Connection] WhatsApp connected successfully!');
        isReady = true;
        qrCodeData = null;
        updateConnectionStatus('connected');
        
        // Start health monitoring
        startHealthCheck();
        
        // Otomatik sync - grupları yükle
        setTimeout(async () => {
          try {
            console.log('[AutoSync] Fetching groups...');
            const groups = await sock.groupFetchAllParticipating();
            for (const [id, group] of Object.entries(groups)) {
              chatStore.set(id, { id, name: group.subject, isGroup: true, ...group });
              // DB'ye kaydet
              queueSave('chats', {
                waId: id,
                name: group.subject,
                isGroup: true,
                lastMessage: null,
                lastMessageTime: null
              });
            }
            console.log(`[AutoSync] Loaded ${Object.keys(groups).length} groups`);
          } catch (e) {
            console.log('[AutoSync] Could not fetch groups:', e.message);
          }
        }, 2000);
      } else if (connection === 'connecting') {
        console.log('[Connection] Connecting...');
        updateConnectionStatus('connecting');
      }
    });
    
    // Message handler - store messages and pushNames
    sock.ev.on('messages.upsert', async (m) => {
      for (const msg of m.messages) {
        const chatId = msg.key.remoteJid;
        if (!chatId) continue;
        
        if (!messageStore.has(chatId)) {
          messageStore.set(chatId, []);
        }
        const messages = messageStore.get(chatId);
        
        // Mesaj içeriğini al
        const body = msg.message?.conversation || 
                    msg.message?.extendedTextMessage?.text || 
                    (msg.message?.imageMessage ? '🖼️ Fotoğraf' : '') ||
                    (msg.message?.videoMessage ? '🎥 Video' : '') ||
                    (msg.message?.documentMessage ? `📎 ${msg.message.documentMessage.fileName || 'Dosya'}` : '') ||
                    (msg.message?.audioMessage ? '🎵 Ses' : '') ||
                    '';
        
        // Add if not exists
        if (!messages.find(m => m.key?.id === msg.key?.id)) {
          messages.push(msg);
          // Keep only last 500 messages per chat (memory'de)
          if (messages.length > 500) {
            messages.shift();
          }
          
          // DB'ye kaydet
          queueSave('messages', {
            chatId: chatId,
            messageId: msg.key.id,
            body: body,
            fromMe: msg.key.fromMe || false,
            timestamp: msg.messageTimestamp || Math.floor(Date.now() / 1000),
            messageType: Object.keys(msg.message || {})[0] || 'text'
          });
          
          // NOT: Medya otomatik indirilmiyor - kullanıcı isterse /media/:messageId ile indirebilir
        }
        
        // Also update chat
        if (!chatStore.has(chatId)) {
          chatStore.set(chatId, { id: chatId });
        }
        
        // pushName'i kaydet (kişinin WhatsApp profil ismi)
        if (msg.pushName && !msg.key.fromMe) {
          const existing = contactStore.get(chatId) || {};
          contactStore.set(chatId, { ...existing, id: chatId, notify: msg.pushName, pushName: msg.pushName });
          // DB'ye kaydet
          queueSave('contacts', {
            waId: chatId,
            name: null,
            pushName: msg.pushName,
            isGroup: chatId.endsWith('@g.us')
          });
        }
        
        // Chat'i de kaydet
        if (!chatStore.has(chatId)) {
          chatStore.set(chatId, { id: chatId, name: msg.pushName });
          queueSave('chats', {
            waId: chatId,
            name: msg.pushName,
            isGroup: chatId.endsWith('@g.us'),
            lastMessage: body,
            lastMessageTime: new Date()
          });
        }
        
        // Emit new message to Socket.IO clients
        if (m.type === 'notify') {
          const contact = contactStore.get(chatId);
          const senderName = msg.pushName || contact?.pushName || contact?.name || chatId.split('@')[0];
          
          // Get sender info for group messages
          let sender = null;
          if (chatId.endsWith('@g.us') && msg.key.participant) {
            const participantContact = contactStore.get(msg.key.participant);
            sender = {
              id: msg.key.participant,
              name: msg.pushName || participantContact?.pushName || participantContact?.name || msg.key.participant.split('@')[0],
              phone: msg.key.participant.split('@')[0],
            };
          }
          
          io.emit('message:new', {
            chatId: chatId,
            messageId: msg.key.id,
            body: body,
            timestamp: msg.messageTimestamp || Math.floor(Date.now() / 1000),
            fromMe: msg.key.fromMe || false,
            type: Object.keys(msg.message || {})[0] || 'text',
            senderName: senderName,
            sender: sender, // For group messages
            isGroup: chatId.endsWith('@g.us'),
          });
          
          if (!msg.key.fromMe) {
            console.log('[Message] New from:', senderName, '-', body.substring(0, 50));
          }
        }
      }
    });
    
    // ============ PRESENCE / TYPING HANDLERS ============
    sock.ev.on('presence.update', (presenceUpdate) => {
      const { id: chatId, presences } = presenceUpdate;
      
      if (presences) {
        for (const [jid, presence] of Object.entries(presences)) {
          const contact = contactStore.get(jid);
          const name = contact?.pushName || contact?.name || jid.split('@')[0];
          
          io.emit('presence:update', {
            chatId: chatId,
            participantId: jid,
            participantName: name,
            presence: presence.lastKnownPresence, // 'composing', 'available', 'unavailable', 'paused'
            lastSeen: presence.lastSeen,
          });
          
          // Also emit typing specific event
          if (presence.lastKnownPresence === 'composing') {
            io.emit('typing:update', {
              chatId: chatId,
              participantId: jid,
              participantName: name,
              isTyping: true,
            });
          } else if (presence.lastKnownPresence === 'paused' || presence.lastKnownPresence === 'available') {
            io.emit('typing:update', {
              chatId: chatId,
              participantId: jid,
              participantName: name,
              isTyping: false,
            });
          }
        }
      }
    });
    
    // ============ MESSAGE STATUS UPDATES (READ RECEIPTS) ============
    sock.ev.on('messages.update', (updates) => {
      for (const update of updates) {
        if (update.update?.status) {
          // Status: 0 = ERROR, 1 = PENDING, 2 = SERVER_ACK (sent), 3 = DELIVERY_ACK (delivered), 4 = READ, 5 = PLAYED
          const statusMap = {
            0: 'error',
            1: 'pending',
            2: 'sent',
            3: 'delivered',
            4: 'read',
            5: 'played',
          };
          
          io.emit('message:status', {
            chatId: update.key.remoteJid,
            messageId: update.key.id,
            fromMe: update.key.fromMe,
            status: statusMap[update.update.status] || 'unknown',
            statusCode: update.update.status,
          });
        }
      }
    });
    
    // Message receipt updates (when others read your messages)
    sock.ev.on('message-receipt.update', (updates) => {
      for (const update of updates) {
        const receipts = update.receipt;
        io.emit('message:receipt', {
          chatId: update.key.remoteJid,
          messageId: update.key.id,
          fromMe: update.key.fromMe,
          receiptType: receipts?.receiptTimestamp ? 'read' : 'delivered',
          timestamp: receipts?.receiptTimestamp || receipts?.readTimestamp,
          participantId: update.key.participant, // For group messages
        });
      }
    });
    
  } catch (error) {
    console.error('[Connection] Error during connection setup:', error.message);
    updateConnectionStatus('error', error.message);
    scheduleReconnect('setup_error');
  }
}

// Force reconnect (manual trigger)
async function forceReconnect() {
  console.log('[Connection] Force reconnect requested');
  stopHealthCheck();
  clearReconnectTimeout();
  
  if (sock) {
    try {
      sock.ev.removeAllListeners();
      sock.end();
    } catch (e) {}
    sock = null;
  }
  
  isReady = false;
  connectionState.retryCount = 0;
  updateConnectionStatus('disconnected');
  
  // Small delay before reconnecting
  await new Promise(r => setTimeout(r, 500));
  connectToWhatsApp();
}

// Reset retry counter (e.g., when user manually triggers reconnect)
function resetRetryCounter() {
  connectionState.retryCount = 0;
  clearReconnectTimeout();
}

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    whatsapp: {
      connected: isReady,
      status: connectionStatus
    }
  });
});

// Get connection status (enhanced)
app.get('/status', (req, res) => {
  res.json({
    connected: isReady,
    status: connectionState.status,
    hasQR: !!qrCodeData,
    // Enhanced status info
    details: {
      retryCount: connectionState.retryCount,
      maxRetries: connectionState.maxRetries,
      lastError: connectionState.lastError,
      lastConnected: connectionState.lastConnected,
      isHealthy: isReady && connectionState.status === 'connected',
    }
  });
});

// Force reconnect endpoint
app.post('/reconnect', async (req, res) => {
  try {
    resetRetryCounter();
    await forceReconnect();
    res.json({ success: true, message: 'Reconnection initiated' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clean session and start fresh
app.post('/clean-session', async (req, res) => {
  try {
    await cleanSession();
    res.json({ success: true, message: 'Session cleaned. Please scan QR code to reconnect.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get QR code
app.get('/qr', (req, res) => {
  if (isReady) {
    return res.json({ success: false, message: 'Already connected', connected: true });
  }
  
  if (!qrCodeData) {
    return res.json({ success: false, message: 'QR code not ready yet, please wait...' });
  }
  
  res.json({ success: true, qr: qrCodeData });
});

// Initialize/Connect
app.post('/connect', async (req, res) => {
  if (isReady) {
    return res.json({ success: true, message: 'Already connected' });
  }
  
  if (!sock) {
    connectToWhatsApp();
  }
  
  res.json({ success: true, message: 'Initializing WhatsApp client...' });
});

// Sync all chats (fetch from WhatsApp)
app.post('/sync', async (req, res) => {
  if (!isReady || !sock) {
    return res.status(400).json({ success: false, error: 'WhatsApp not connected' });
  }
  
  try {
    console.log('[Sync] Fetching all chats...');
    
    // Fetch all chats using Baileys internal method
    const chats = await sock.groupFetchAllParticipating();
    
    // Groups
    for (const [id, group] of Object.entries(chats)) {
      chatStore.set(id, { id, name: group.subject, isGroup: true, ...group });
    }
    
    console.log(`[Sync] Loaded ${Object.keys(chats).length} groups`);
    
    res.json({ 
      success: true, 
      message: `Synced ${Object.keys(chats).length} groups`,
      chatCount: chatStore.size,
      contactCount: contactStore.size
    });
  } catch (error) {
    console.error('[Sync] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Disconnect
app.post('/disconnect', async (req, res) => {
  try {
    if (sock) {
      await sock.logout();
      sock = null;
      isReady = false;
      qrCodeData = null;
      connectionStatus = 'disconnected';
      
      // Clear auth folder
      if (fs.existsSync(AUTH_FOLDER)) {
        fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
      }
    }
    res.json({ success: true, message: 'Disconnected' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper: Convert Long object or any timestamp to plain number
function toTimestamp(ts) {
  if (!ts) return null;
  // If it's already a number
  if (typeof ts === 'number') return ts;
  // If it's a Long object (from protobuf)
  if (typeof ts === 'object' && ts.low !== undefined) {
    return ts.low; // Use low part for timestamps (high is usually 0)
  }
  // If it's a string, try to parse
  if (typeof ts === 'string') {
    const parsed = parseInt(ts, 10);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

// Get all chats
app.get('/chats', async (req, res) => {
  if (!isReady || !sock) {
    return res.status(400).json({ success: false, error: 'WhatsApp not connected' });
  }
  
  try {
    // Store'dan chat listesini al
    const chats = Array.from(chatStore.values());
    
    const formattedChats = chats
      .filter(chat => chat.id && !chat.id.includes('status@broadcast'))
      .map(chat => {
        const messages = messageStore.get(chat.id) || [];
        const lastMsg = messages[messages.length - 1];
        
        // Contact'tan isim al (pushName, notify, name sırasıyla)
        const contact = contactStore.get(chat.id);
        const chatName = contact?.pushName || contact?.notify || contact?.name || contact?.verifiedName || chat.name || chat.id.split('@')[0];
        
        // Timestamp'ı düz sayıya çevir
        const rawTimestamp = lastMsg?.messageTimestamp || chat.conversationTimestamp || null;
        const timestamp = toTimestamp(rawTimestamp);
        
        return {
          id: chat.id,
          name: chatName,
          isGroup: chat.id.includes('@g.us'),
          unreadCount: chat.unreadCount || 0,
          lastMessage: lastMsg?.message?.conversation || 
                       lastMsg?.message?.extendedTextMessage?.text || '',
          timestamp: timestamp,
          archived: chat.archived || false,
          pinned: chat.pinned || false
        };
      })
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, 100);
    
    res.json({ success: true, chats: formattedChats });
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get messages from a chat
app.get('/chats/:chatId/messages', async (req, res) => {
  if (!isReady || !sock) {
    return res.status(400).json({ success: false, error: 'WhatsApp not connected' });
  }
  
  try {
    const { chatId } = req.params;
    const { limit = 50 } = req.query;
    
    // Store'dan mesajları al
    let messages = messageStore.get(chatId) || [];
    
    // Check if this is a group chat
    const isGroup = chatId.endsWith('@g.us');
    
    const formattedMessages = messages
      .slice(-parseInt(limit))
      .map(msg => {
        // Medya tipini belirle
        const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];
        const messageContent = msg.message || {};
        let type = 'text';
        let hasMedia = false;
        let mimetype = null;
        let filename = null;
        let filesize = null;
        let caption = null;

        for (const mediaType of mediaTypes) {
          if (messageContent[mediaType]) {
            hasMedia = true;
            type = mediaType.replace('Message', '');
            mimetype = messageContent[mediaType].mimetype;
            filename = messageContent[mediaType].fileName;
            filesize = messageContent[mediaType].fileLength;
            caption = messageContent[mediaType].caption;
            break;
          }
        }

        // Ses mesajı (ptt = push to talk)
        if (messageContent.audioMessage?.ptt) {
          type = 'ptt';
        }

        // Get sender info for group messages
        let sender = null;
        if (isGroup && msg.key?.participant && !msg.key?.fromMe) {
          const participantId = msg.key.participant;
          const participantContact = contactStore.get(participantId);
          // Try multiple sources for the name
          const senderName = msg.pushName || 
                            participantContact?.pushName || 
                            participantContact?.notify || 
                            participantContact?.name || 
                            participantContact?.verifiedName ||
                            participantId.split('@')[0];
          sender = {
            id: participantId,
            name: senderName,
            phone: participantId.split('@')[0],
          };
        }

        return {
          id: msg.key?.id || msg.id,
          body: messageContent.conversation || 
                messageContent.extendedTextMessage?.text ||
                caption ||
                '',
          timestamp: toTimestamp(msg.messageTimestamp) || Math.floor(Date.now() / 1000),
          fromMe: msg.key?.fromMe || false,
          type,
          hasMedia,
          mimetype,
          filename,
          filesize: filesize ? Number(filesize) : null,
          caption,
          sender
        };
      });
    
    res.json({ success: true, messages: formattedMessages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Download media from a message
app.get('/media/:messageId', async (req, res) => {
  if (!isReady || !sock) {
    return res.status(400).json({ success: false, error: 'WhatsApp not connected' });
  }
  
  try {
    const { messageId } = req.params;
    
    // Tüm chat'lerde mesajı ara
    let targetMessage = null;
    for (const [chatId, messages] of messageStore.entries()) {
      const found = messages.find(m => m.key?.id === messageId);
      if (found) {
        targetMessage = found;
        break;
      }
    }
    
    if (!targetMessage) {
      return res.status(404).json({ success: false, error: 'Mesaj bulunamadı' });
    }
    
    // DB'den yüklenen eski mesaj mı kontrol et
    if (targetMessage._dbLoaded) {
      // Önce kaydedilmiş medya var mı kontrol et
      try {
        const savedMedia = await pool.query(
          'SELECT local_path, mimetype, filename FROM whatsapp_media WHERE message_id = $1',
          [messageId]
        );
        
        if (savedMedia.rows.length > 0 && savedMedia.rows[0].local_path) {
          const filePath = savedMedia.rows[0].local_path;
          if (fs.existsSync(filePath)) {
            const buffer = fs.readFileSync(filePath);
            const base64 = buffer.toString('base64');
            const mimetype = savedMedia.rows[0].mimetype || 'application/octet-stream';
            const dataUrl = `data:${mimetype};base64,${base64}`;
            
            console.log(`[Media] Loaded saved media from ${filePath}`);
            return res.json({ success: true, data: dataUrl, filename: savedMedia.rows[0].filename });
          }
        }
      } catch (dbErr) {
        console.error('[Media] DB check error:', dbErr.message);
      }
      
      // Kaydedilmiş medya yok - eski mesaj için medya artık mevcut değil
      return res.status(410).json({ 
        success: false, 
        error: 'Bu eski bir mesaj. Medya dosyası artık mevcut değil. Yeni mesajlar için medyayı "Kaydet" butonuyla saklayabilirsiniz.' 
      });
    }
    
    const messageContent = targetMessage.message;
    const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];
    let mediaMessage = null;
    
    for (const type of mediaTypes) {
      if (messageContent?.[type]) {
        mediaMessage = messageContent[type];
        break;
      }
    }
    
    if (!mediaMessage) {
      return res.status(404).json({ success: false, error: 'Bu mesajda medya yok' });
    }
    
    console.log(`[Media] Downloading media for message ${messageId}`);
    
    // Baileys ile medyayı indir
    const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
    const buffer = await downloadMediaMessage(
      targetMessage,
      'buffer',
      {},
      { 
        logger,
        reuploadRequest: sock.updateMediaMessage
      }
    );
    
    if (!buffer) {
      return res.status(500).json({ success: false, error: 'Medya indirilemedi' });
    }
    
    // Base64'e çevir
    const base64 = buffer.toString('base64');
    const mimetype = mediaMessage.mimetype || 'application/octet-stream';
    const dataUrl = `data:${mimetype};base64,${base64}`;
    
    console.log(`[Media] Downloaded ${buffer.length} bytes`);
    
    res.json({ 
      success: true, 
      data: dataUrl,
      mimetype,
      filename: mediaMessage.fileName,
      filesize: buffer.length
    });
    
  } catch (error) {
    console.error('[Media] Download error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save media to disk (manuel kaydetme - kullanıcı istediğinde)
app.post('/media/:messageId/save', async (req, res) => {
  if (!isReady || !sock) {
    return res.status(400).json({ success: false, error: 'WhatsApp not connected' });
  }
  
  try {
    const { messageId } = req.params;
    
    // Mesajı bul
    let targetMessage = null;
    for (const [chatId, messages] of messageStore.entries()) {
      const found = messages.find(m => m.key?.id === messageId);
      if (found) {
        targetMessage = found;
        break;
      }
    }
    
    if (!targetMessage) {
      return res.status(404).json({ success: false, error: 'Mesaj bulunamadı' });
    }
    
    const messageContent = targetMessage.message;
    const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage'];
    let mediaMessage = null;
    
    for (const type of mediaTypes) {
      if (messageContent?.[type]) {
        mediaMessage = messageContent[type];
        break;
      }
    }
    
    if (!mediaMessage) {
      return res.status(404).json({ success: false, error: 'Bu mesajda medya yok' });
    }
    
    console.log(`[Media] Saving media for message ${messageId}...`);
    
    // Medyayı indir
    const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
    const buffer = await downloadMediaMessage(targetMessage, 'buffer', {}, { logger });
    
    if (!buffer) {
      return res.status(500).json({ success: false, error: 'Medya indirilemedi' });
    }
    
    // Dosyayı kaydet
    const mimetype = mediaMessage.mimetype || 'application/octet-stream';
    const filename = mediaMessage.fileName || `${messageId}.${mimetype.split('/')[1] || 'bin'}`;
    const filePath = await saveMediaToFile(messageId, buffer, mimetype, filename);
    
    if (!filePath) {
      return res.status(500).json({ success: false, error: 'Dosya kaydedilemedi' });
    }
    
    console.log(`[Media] Saved: ${filePath}`);
    
    res.json({
      success: true,
      filePath,
      filename,
      mimetype,
      filesize: buffer.length
    });
    
  } catch (error) {
    console.error('[Media] Save error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send media message
app.post('/send-media', async (req, res) => {
  if (!isReady || !sock) {
    return res.status(400).json({ success: false, error: 'WhatsApp not connected' });
  }
  
  try {
    const { chatId, type, data, filename, caption } = req.body;
    
    if (!chatId || !type || !data) {
      return res.status(400).json({ success: false, error: 'chatId, type ve data gerekli' });
    }
    
    console.log(`[SendMedia] Sending ${type} to ${chatId}`);
    
    // Base64'ten buffer'a çevir
    const base64Data = data.includes(',') ? data.split(',')[1] : data;
    const buffer = Buffer.from(base64Data, 'base64');
    
    let result;
    
    switch(type) {
      case 'image':
        result = await sock.sendMessage(chatId, { 
          image: buffer,
          caption: caption || ''
        });
        break;
        
      case 'video':
        result = await sock.sendMessage(chatId, { 
          video: buffer,
          caption: caption || ''
        });
        break;
        
      case 'audio':
        result = await sock.sendMessage(chatId, { 
          audio: buffer,
          mimetype: 'audio/mp4'
        });
        break;
        
      case 'document':
        result = await sock.sendMessage(chatId, { 
          document: buffer,
          fileName: filename || 'document',
          caption: caption || ''
        });
        break;
        
      default:
        return res.status(400).json({ success: false, error: 'Geçersiz medya tipi' });
    }
    
    console.log('[SendMedia] Media sent successfully!');
    
    res.json({
      success: true,
      messageId: result?.key?.id,
      timestamp: Math.floor(Date.now() / 1000)
    });
    
  } catch (error) {
    console.error('[SendMedia] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send message
app.post('/send', async (req, res) => {
  if (!isReady || !sock) {
    return res.status(400).json({ success: false, error: 'WhatsApp not connected' });
  }
  
  try {
    const { chatId, message } = req.body;
    
    if (!chatId || !message) {
      return res.status(400).json({ success: false, error: 'chatId and message required' });
    }
    
    console.log(`[Send] Sending to ${chatId}: "${message.substring(0, 50)}..."`);
    
    // Baileys ile mesaj gönder
    const result = await sock.sendMessage(chatId, { text: message });
    
    console.log('[Send] Message sent successfully!');
    
    // Gönderilen mesajı store'a ekle
    if (!messageStore.has(chatId)) {
      messageStore.set(chatId, []);
    }
    const timestamp = Math.floor(Date.now() / 1000);
    messageStore.get(chatId).push({
      key: result.key,
      message: { conversation: message },
      messageTimestamp: timestamp
    });
    
    // DB'ye kaydet
    queueSave('messages', {
      chatId: chatId,
      messageId: result?.key?.id || `msg-${Date.now()}`,
      body: message,
      fromMe: true,
      timestamp: timestamp,
      messageType: 'text'
    });
    
    res.json({
      success: true,
      messageId: result?.key?.id || `msg-${Date.now()}`,
      timestamp: Math.floor(Date.now() / 1000)
    });
    
  } catch (error) {
    console.error('[Send] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error?.message || 'Mesaj gönderilemedi'
    });
  }
});

// Mark messages as read
app.post('/chats/:chatId/seen', async (req, res) => {
  if (!isReady || !sock) {
    return res.status(400).json({ success: false, error: 'WhatsApp not connected' });
  }
  
  try {
    const { chatId } = req.params;
    const messages = messageStore.get(chatId) || [];
    const lastMsg = messages[messages.length - 1];
    
    if (lastMsg && !lastMsg.key.fromMe) {
      await sock.readMessages([lastMsg.key]);
    }
    res.json({ success: true, message: 'Messages marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get contacts - from chats
app.get('/contacts', async (req, res) => {
  if (!isReady || !sock) {
    return res.status(400).json({ success: false, error: 'WhatsApp not connected' });
  }
  
  try {
    const chats = Array.from(chatStore.values());
    const formattedContacts = chats
      .filter(chat => chat.id?.includes('@s.whatsapp.net'))
      .map(chat => ({
        id: chat.id,
        name: chat.name || chat.id.split('@')[0],
        number: chat.id.split('@')[0],
        isGroup: false
      }))
      .slice(0, 100);
    
    res.json({ success: true, contacts: formattedContacts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ SOCKET.IO CONNECTION HANDLERS ============
io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);
  connectedClients.add(socket.id);
  
  // Send current status immediately
  socket.emit('connection:status', {
    connected: isReady,
    status: connectionState.status,
    error: connectionState.lastError,
    retryCount: connectionState.retryCount,
    lastConnected: connectionState.lastConnected,
  });
  
  // Send QR if available
  if (qrCodeData) {
    socket.emit('qr:update', { qr: qrCodeData });
  }
  
  // Handle typing indicator from client
  socket.on('typing:start', async (data) => {
    const { chatId } = data;
    if (sock && isReady && chatId) {
      try {
        await sock.sendPresenceUpdate('composing', chatId);
      } catch (e) {
        console.error('[Typing] Error sending typing start:', e.message);
      }
    }
  });
  
  socket.on('typing:stop', async (data) => {
    const { chatId } = data;
    if (sock && isReady && chatId) {
      try {
        await sock.sendPresenceUpdate('paused', chatId);
      } catch (e) {
        console.error('[Typing] Error sending typing stop:', e.message);
      }
    }
  });
  
  // Handle presence subscription
  socket.on('presence:subscribe', async (data) => {
    const { chatId } = data;
    if (sock && isReady && chatId) {
      try {
        await sock.presenceSubscribe(chatId);
      } catch (e) {
        console.error('[Presence] Error subscribing:', e.message);
      }
    }
  });
  
  socket.on('disconnect', (reason) => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id} (${reason})`);
    connectedClients.delete(socket.id);
  });
});

// Start server with Socket.IO
httpServer.listen(PORT, () => {
  console.log(`\n🚀 WhatsApp Service running on port ${PORT}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('REST API Endpoints:');
  console.log('  GET  /health - Health check');
  console.log('  GET  /status - Connection status (enhanced)');
  console.log('  GET  /qr - Get QR code');
  console.log('  POST /connect - Initialize connection');
  console.log('  POST /disconnect - Disconnect');
  console.log('  POST /reconnect - Force reconnect');
  console.log('  POST /clean-session - Clean session');
  console.log('  GET  /chats - List chats');
  console.log('  GET  /chats/:id/messages - Get messages');
  console.log('  POST /send - Send text message');
  console.log('  GET  /media/:messageId - Download media');
  console.log('  POST /send-media - Send media');
  console.log('  GET  /contacts - List contacts');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Socket.IO Events:');
  console.log('  → connection:status - Connection state changes');
  console.log('  → qr:update - QR code updates');
  console.log('  → message:new - New incoming messages');
  console.log('  → typing:update - Typing indicators');
  console.log('  → presence:update - Online/offline status');
  console.log('  → message:status - Message read receipts');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Auto-connect if auth exists
  if (fs.existsSync(AUTH_FOLDER)) {
    console.log('[Startup] Auth found, auto-connecting...');
    connectToWhatsApp();
  }
});
