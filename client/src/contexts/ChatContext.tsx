import React, {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, ReactNode
} from 'react';
import { Conversation, Message, User, TypingUser } from '../types';
import { chatAPI, messageAPI } from '../services/api';
import { socketOn, socketEmit } from '../services/socket';
import { useAuth } from './AuthContext';
import { getSocket } from '../services/socket';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';

interface ChatContextType {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  messages: Message[];
  typingUsers: TypingUser[];
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  hasMoreMessages: boolean;
  onlineUsers: Set<string>;
  unreadTotal: number;
  setActiveConversation: (conv: Conversation | null) => void;
  loadMoreMessages: () => Promise<void>;
  sendMessage: (data: {
    text?: string;
    messageType?: string;
    mediaUrl?: string;
    mediaType?: string;
    mediaSize?: number;
    mediaName?: string;
    replyTo?: string;
  }) => Promise<void>;
  editMessage: (messageId: string, text: string) => void;
  deleteMessage: (messageId: string, deleteFor: 'me' | 'everyone') => void;
  reactToMessage: (messageId: string, emoji: string) => void;
  markAsSeen: (conversationId: string) => void;
  createDirectConversation: (targetUserId: string) => Promise<Conversation>;
  refreshConversations: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversationState] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const activeConvRef = useRef<Conversation | null>(null);

  const unreadTotal = conversations.reduce((sum, conv) => {
    const count = conv.unreadCounts?.[user?._id || ''] || 0;
    return sum + count;
  }, 0);

  const refreshConversations = useCallback(async () => {
    if (!user) return;
    setIsLoadingConversations(true);
    try {
      const { data } = await chatAPI.getConversations();
      setConversations(data.conversations);
    } catch {
      toast.error('Failed to load conversations');
    } finally {
      setIsLoadingConversations(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) refreshConversations();
  }, [user, refreshConversations]);

  const setActiveConversation = useCallback(async (conv: Conversation | null) => {
    setActiveConversationState(conv);
    activeConvRef.current = conv;
    setMessages([]);
    setHasMoreMessages(false);
    if (!conv) return;
    socketEmit.joinConversation(conv._id);
    setIsLoadingMessages(true);
    try {
      const { data } = await messageAPI.getMessages(conv._id);
      setMessages(data.messages);
      setHasMoreMessages(data.hasMore);
    } catch {
      toast.error('Failed to load messages');
    } finally {
      setIsLoadingMessages(false);
    }
    markAsSeen(conv._id);
  }, []);

  const loadMoreMessages = useCallback(async () => {
    if (!activeConversation || isLoadingMessages || !hasMoreMessages) return;
    const oldest = messages[0];
    if (!oldest) return;
    setIsLoadingMessages(true);
    try {
      const { data } = await messageAPI.getMessages(activeConversation._id, oldest.createdAt);
      setMessages(prev => [...data.messages, ...prev]);
      setHasMoreMessages(data.hasMore);
    } catch {
      toast.error('Failed to load older messages');
    } finally {
      setIsLoadingMessages(false);
    }
  }, [activeConversation, isLoadingMessages, hasMoreMessages, messages]);

  const sendMessage = useCallback(async (data: {
    text?: string;
    messageType?: string;
    mediaUrl?: string;
    mediaType?: string;
    mediaSize?: number;
    mediaName?: string;
    replyTo?: string;
  }) => {
    if (!activeConvRef.current || !user) return;
    const tempId = uuidv4();
    const optimistic: Message = {
      _id: tempId,
      conversationId: activeConvRef.current._id,
      senderId: user,
      text: data.text,
      mediaUrl: data.mediaUrl,
      mediaType: data.mediaType,
      mediaSize: data.mediaSize,
      mediaName: data.mediaName,
      messageType: (data.messageType as any) || 'text',
      status: 'sending',
      seenBy: [],
      deliveredTo: [],
      replyTo: data.replyTo || null,
      reactions: [],
      isEdited: false,
      isDeleted: false,
      isPinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tempId,
      isSending: true,
    };
    setMessages(prev => [...prev, optimistic]);
    const socket = getSocket();
    if (socket?.connected) {
      socketEmit.sendMessage({
        conversationId: activeConvRef.current._id,
        ...data,
        tempId,
      });
    } else {
      try {
        const { data: res } = await messageAPI.send({
          conversationId: activeConvRef.current._id,
          ...data,
        });
        setMessages(prev => prev.map(m => m.tempId === tempId ? res.message : m));
      } catch {
        setMessages(prev => prev.map(m =>
          m.tempId === tempId ? { ...m, status: 'failed' as any, isSending: false } : m
        ));
      }
    }
    setConversations(prev => prev.map(c =>
      c._id === activeConvRef.current!._id
        ? { ...c, lastMessageAt: new Date().toISOString() }
        : c
    ));
  }, [user]);

  const editMessage = useCallback((messageId: string, text: string) => {
    if (!activeConversation) return;
    socketEmit.editMessage(messageId, text, activeConversation._id);
    setMessages(prev => prev.map(m =>
      m._id === messageId ? { ...m, text, isEdited: true, editedAt: new Date().toISOString() } : m
    ));
  }, [activeConversation]);

  const deleteMessage = useCallback((messageId: string, deleteFor: 'me' | 'everyone') => {
    if (!activeConversation) return;
    socketEmit.deleteMessage(messageId, activeConversation._id, deleteFor);
    if (deleteFor === 'everyone') {
      setMessages(prev => prev.map(m =>
        m._id === messageId ? { ...m, isDeleted: true, text: undefined, mediaUrl: undefined } : m
      ));
    } else {
      setMessages(prev => prev.filter(m => m._id !== messageId));
    }
  }, [activeConversation]);

  const reactToMessage = useCallback((messageId: string, emoji: string) => {
    if (!activeConversation || !user) return;

    const message = messages.find(m => m._id === messageId);
    if (!message) return;

    const existingReaction = message.reactions.find(r => r.userId === user._id);

    if (existingReaction && existingReaction.emoji === emoji) {
      socketEmit.removeReaction(messageId, activeConversation._id);
    } else {
      socketEmit.addReaction(messageId, emoji, activeConversation._id);
    }
  }, [activeConversation, user, messages]);
  
  const markAsSeen = useCallback((conversationId: string) => {
    if (!user) return;
    setConversations(prev => prev.map(c =>
      c._id === conversationId
        ? { ...c, unreadCounts: { ...c.unreadCounts, [user._id]: 0 } }
        : c
    ));
  }, [user]);

  const createDirectConversation = useCallback(async (targetUserId: string): Promise<Conversation> => {
    const { data } = await chatAPI.createDirect(targetUserId);
    const exists = conversations.find(c => c._id === data.conversation._id);
    if (!exists) {
      setConversations(prev => [data.conversation, ...prev]);
    }
    return data.conversation;
  }, [conversations]);

  // ─── Socket listeners ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const offReceive = socketOn.onReceiveMessage((message) => {
      const isActive = activeConvRef.current?._id === message.conversationId;
      const senderId = (message.senderId as any)?._id || message.senderId;
      const isMyMessage = senderId === user._id;

      if (isActive) {
        setMessages(prev => {
          if (isMyMessage) {
            // Replace optimistic bubble with real message
            const optimisticIndex = prev.findIndex(m => m.isSending === true);
            if (optimisticIndex !== -1) {
              const updated = [...prev];
              updated[optimisticIndex] = { ...message, isSending: false };
              return updated;
            }
            // Already handled by onMessageSent — skip
            if (prev.some(m => m._id === message._id)) return prev;
            return prev;
          }
          // Message from someone else
          if (prev.some(m => m._id === message._id)) return prev;
          return [...prev, message];
        });
        if (!isMyMessage) {
          socketEmit.messageSeen(message.conversationId, [message._id]);
        }
      }

      setConversations(prev => prev.map(c =>
        c._id === message.conversationId
          ? {
            ...c,
            lastMessage: message,
            lastMessageAt: message.createdAt,
            unreadCounts: isActive
              ? { ...c.unreadCounts, [user._id]: 0 }
              : { ...c.unreadCounts, [user._id]: (c.unreadCounts?.[user._id] || 0) + 1 },
          }
          : c
      ));
    });

    const offSent = socketOn.onMessageSent(({ messageId, tempId }) => {
      setMessages(prev => prev.map(m =>
        m.tempId === tempId ? { ...m, _id: messageId, isSending: false, status: 'sent' } : m
      ));
    });

    const offDelivered = socketOn.onMessageDelivered(({ messageId }) => {
      setMessages(prev => prev.map(m =>
        m._id === messageId ? { ...m, status: 'delivered' } : m
      ));
    });

    const offSeen = socketOn.onMessagesSeen(({ conversationId, messageIds }) => {
      if (activeConvRef.current?._id === conversationId) {
        setMessages(prev => prev.map(m =>
          messageIds.includes(m._id) ? { ...m, status: 'seen' } : m
        ));
      }
    });

    const offTyping = socketOn.onTyping((data) => {
      if (data.userId === user._id) return;
      setTypingUsers(prev => {
        const exists = prev.some(t => t.userId === data.userId && t.conversationId === data.conversationId);
        return exists ? prev : [...prev, data];
      });
    });

    const offStopTyping = socketOn.onStopTyping((data) => {
      setTypingUsers(prev => prev.filter(t =>
        !(t.userId === data.userId && t.conversationId === data.conversationId)
      ));
    });

    const offOnline = socketOn.onUserOnline(({ userId }) => {
      setOnlineUsers(prev => new Set([...prev, userId]));
      setConversations(prev => prev.map(c => ({
        ...c,
        members: c.members.map(m => m._id === userId ? { ...m, isOnline: true } : m),
      })));
    });

    const offOffline = socketOn.onUserOffline(({ userId, lastSeen }) => {
      setOnlineUsers(prev => { const s = new Set(prev); s.delete(userId); return s; });
      setConversations(prev => prev.map(c => ({
        ...c,
        members: c.members.map(m => m._id === userId ? { ...m, isOnline: false, lastSeen } : m),
      })));
    });

    const offReaction = socketOn.onReactionUpdated(({ messageId, reactions }) => {
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, reactions } : m));
    });

    const offEdit = socketOn.onMessageEdited(({ messageId, text, editedAt }) => {
      setMessages(prev => prev.map(m =>
        m._id === messageId ? { ...m, text, isEdited: true, editedAt } : m
      ));
    });

    const offDelete = socketOn.onMessageDeleted(({ messageId, deleteFor }) => {
      if (deleteFor === 'everyone') {
        setMessages(prev => prev.map(m =>
          m._id === messageId ? { ...m, isDeleted: true, text: undefined, mediaUrl: undefined } : m
        ));
      }
    });

    return () => {
      offReceive(); offSent(); offDelivered(); offSeen();
      offTyping(); offStopTyping(); offOnline(); offOffline();
      offReaction(); offEdit(); offDelete();
    };
  }, [user]);

  return (
    <ChatContext.Provider value={{
      conversations,
      activeConversation,
      messages,
      typingUsers,
      isLoadingConversations,
      isLoadingMessages,
      hasMoreMessages,
      onlineUsers,
      unreadTotal,
      setActiveConversation,
      loadMoreMessages,
      sendMessage,
      editMessage,
      deleteMessage,
      reactToMessage,
      markAsSeen,
      createDirectConversation,
      refreshConversations,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}