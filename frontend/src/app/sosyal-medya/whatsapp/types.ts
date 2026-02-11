export interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  isGroup: boolean;
  isArchived?: boolean;
}

export interface Message {
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

/** API chat list item shape */
export interface ApiChat {
  id: string;
  name?: string;
  lastMessage?: string;
  timestamp?: number;
  unreadCount?: number;
  isGroup?: boolean;
  archived?: boolean;
}

/** API message shape */
export interface ApiMessage {
  id: string;
  body?: string;
  caption?: string;
  timestamp?: number;
  fromMe?: boolean;
  type?: string;
  hasMedia?: boolean;
  mediaUrl?: string;
  mimetype?: string;
  filename?: string;
  filesize?: number;
}
