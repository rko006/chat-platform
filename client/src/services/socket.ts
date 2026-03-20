import { io, Socket } from 'socket.io-client';
import { Message, Reaction } from '../types';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

let socket: Socket | null = null;

export function initSocket(token: string): Socket {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket?.id);
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// ─── Socket event emitters ───────────────────────────────────────────────────
export const socketEmit = {
  joinConversation: (conversationId: string) => {
    socket?.emit('join_conversation', { conversationId });
  },

  leaveConversation: (conversationId: string) => {
    socket?.emit('leave_conversation', { conversationId });
  },

  sendMessage: (data: {
    conversationId: string;
    text?: string;
    messageType?: string;
    mediaUrl?: string;
    mediaType?: string;
    mediaSize?: number;
    mediaName?: string;
    replyTo?: string;
    tempId: string;
  }) => {
    socket?.emit('send_message', data);
  },

  typing: (conversationId: string) => {
    socket?.emit('typing', { conversationId });
  },

  stopTyping: (conversationId: string) => {
    socket?.emit('stop_typing', { conversationId });
  },

  messageSeen: (conversationId: string, messageIds: string[]) => {
    socket?.emit('message_seen', { conversationId, messageIds });
  },

  addReaction: (messageId: string, emoji: string, conversationId: string) => {
    socket?.emit('add_reaction', { messageId, emoji, conversationId });
  },

  removeReaction: (messageId: string, conversationId: string) => {
    socket?.emit('remove_reaction', { messageId, conversationId });
  },

  editMessage: (messageId: string, text: string, conversationId: string) => {
    socket?.emit('edit_message', { messageId, text, conversationId });
  },

  deleteMessage: (messageId: string, conversationId: string, deleteFor: 'me' | 'everyone') => {
    socket?.emit('delete_message', { messageId, conversationId, deleteFor });
  },
};

// ─── Socket event listeners ──────────────────────────────────────────────────
export const socketOn = {
  onReceiveMessage: (cb: (message: Message) => void) => {
    socket?.on('receive_message', cb);
    return () => socket?.off('receive_message', cb);
  },

  onMessageSent: (cb: (data: { messageId: string; tempId: string }) => void) => {
    socket?.on('message_sent', cb);
    return () => socket?.off('message_sent', cb);
  },

  onMessageDelivered: (cb: (data: { messageId: string; userId: string }) => void) => {
    socket?.on('message_delivered', cb);
    return () => socket?.off('message_delivered', cb);
  },

  onMessagesSeen: (cb: (data: { conversationId: string; messageIds: string[]; seenBy: string; seenAt: string }) => void) => {
    socket?.on('messages_seen', cb);
    return () => socket?.off('messages_seen', cb);
  },

  onTyping: (cb: (data: { userId: string; username: string; conversationId: string }) => void) => {
    socket?.on('typing', cb);
    return () => socket?.off('typing', cb);
  },

  onStopTyping: (cb: (data: { userId: string; conversationId: string }) => void) => {
    socket?.on('stop_typing', cb);
    return () => socket?.off('stop_typing', cb);
  },

  onUserOnline: (cb: (data: { userId: string }) => void) => {
    socket?.on('user_online', cb);
    return () => socket?.off('user_online', cb);
  },

  onUserOffline: (cb: (data: { userId: string; lastSeen: string }) => void) => {
    socket?.on('user_offline', cb);
    return () => socket?.off('user_offline', cb);
  },

  onReactionUpdated: (cb: (data: { messageId: string; reactions: Reaction[] }) => void) => {
    socket?.on('reaction_updated', cb);
    return () => socket?.off('reaction_updated', cb);
  },

  onMessageEdited: (cb: (data: { messageId: string; text: string; editedAt: string }) => void) => {
    socket?.on('message_edited', cb);
    return () => socket?.off('message_edited', cb);
  },

  onMessageDeleted: (cb: (data: { messageId: string; conversationId: string; deleteFor: string }) => void) => {
    socket?.on('message_deleted', cb);
    return () => socket?.off('message_deleted', cb);
  },

  onError: (cb: (data: { message: string }) => void) => {
    socket?.on('error', cb);
    return () => socket?.off('error', cb);
  },
};
