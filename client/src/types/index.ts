export interface User {
  _id: string;
  username: string;
  email: string;
  profilePicture?: string;
  bio?: string;
  isOnline: boolean;
  lastSeen: string;
  notificationSettings?: {
    messages: boolean;
    sounds: boolean;
    preview: boolean;
  };
  pinnedChats?: string[];
  archivedChats?: string[];
  createdAt: string;
}

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'system';
export type MessageStatus = 'sent' | 'delivered' | 'seen' | 'sending' | 'failed';

export interface Reaction {
  emoji: string;
  userId: string;
  createdAt: string;
}

export interface Message {
  _id: string;
  conversationId: string;
  senderId: User | string;
  text?: string;
  mediaUrl?: string;
  mediaType?: string;
  mediaSize?: number;
  mediaName?: string;
  thumbnail?: string;
  messageType: MessageType;
  status: MessageStatus;
  seenBy: Array<{ userId: string; seenAt: string }>;
  deliveredTo: Array<{ userId: string; deliveredAt: string }>;
  replyTo?: Message | string | null;
  reactions: Reaction[];
  isEdited: boolean;
  editedAt?: string;
  isDeleted: boolean;
  deletedAt?: string;
  forwardedFrom?: string | null;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  // Optimistic UI
  tempId?: string;
  isSending?: boolean;
}

export type ConversationType = 'direct' | 'group';

export interface Conversation {
  _id: string;
  type: ConversationType;
  members: User[];
  lastMessage?: Message;
  lastMessageAt: string;
  name?: string;
  groupImage?: string;
  admins?: string[];
  description?: string;
  unreadCounts?: Record<string, number>;
  mutedBy?: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface TypingUser {
  userId: string;
  username: string;
  conversationId: string;
}

export interface MediaUploadResult {
  mediaUrl: string;
  mediaType: string;
  mediaSize: number;
  mediaName: string;
  mimeType: string;
}

export interface PaginatedMessages {
  messages: Message[];
  hasMore: boolean;
  page: number;
}
