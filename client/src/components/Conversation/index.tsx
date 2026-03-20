import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { Message } from '../../types';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import MessageBubble from '../MessageBubble';
import TypingIndicator from '../TypingIndicator';
import MessageInput from '../MessageInput';
import Avatar from '../common/Avatar';
import { formatMessageDate, shouldShowDateDivider } from '../../utils/formatDate';
import { formatLastSeen } from '../../utils/formatDate';
import { socketEmit } from '../../services/socket';
import { useTheme } from '../../contexts/ThemeContext';

export default function Conversation() {
  const { user } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const {
    activeConversation,
    messages,
    typingUsers,
    isLoadingMessages,
    hasMoreMessages,
    loadMoreMessages,
    setActiveConversation,
    markAsSeen,
  } = useChat();
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const prevScrollHeight = useRef(0);

  const { ref: topRef, inView: topInView } = useInView({ threshold: 0 });

  // Scroll to bottom on new messages
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      const isNearBottom = (() => {
        const list = listRef.current;
        if (!list) return true;
        return list.scrollHeight - list.scrollTop - list.clientHeight < 200;
      })();
      if (isNearBottom) scrollToBottom('smooth');
    }
  }, [messages, scrollToBottom]);

  // Preserve scroll when loading older messages
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (prevScrollHeight.current > 0) {
      list.scrollTop = list.scrollHeight - prevScrollHeight.current;
      prevScrollHeight.current = 0;
    }
  }, [messages]);

  // Load more when top is visible
  useEffect(() => {
    if (topInView && hasMoreMessages && !isLoadingMessages) {
      prevScrollHeight.current = listRef.current?.scrollHeight || 0;
      loadMoreMessages();
    }
  }, [topInView, hasMoreMessages, isLoadingMessages, loadMoreMessages]);

  // Mark messages as seen when conversation is active
  useEffect(() => {
    if (activeConversation && messages.length > 0) {
      markAsSeen(activeConversation._id);
    }
  }, [activeConversation, messages.length]);

  if (!activeConversation) {
    return <EmptyState />;
  }

  const partner = activeConversation.type === 'direct'
    ? activeConversation.members.find(m => m._id !== user?._id)
    : null;

  const title = activeConversation.type === 'group'
    ? activeConversation.name
    : partner?.username;

  const subtitle = activeConversation.type === 'group'
    ? `${activeConversation.members.length} members`
    : partner?.isOnline
    ? 'Online'
    : partner?.lastSeen
    ? formatLastSeen(partner.lastSeen)
    : '';

  const convTypingUsers = typingUsers.filter(t => t.conversationId === activeConversation._id);

  const filteredMessages = searchQuery
    ? messages.filter(m => m.text?.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shadow-sm">
        <button
          onClick={() => setActiveConversation(null)}
          className="lg:hidden p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
          {activeConversation.type === 'group' ? (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {activeConversation.name?.slice(0, 2).toUpperCase()}
            </div>
          ) : (
            <Avatar
              src={partner?.profilePicture}
              name={partner?.username || '?'}
              size="md"
              isOnline={partner?.isOnline}
            />
          )}
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900 dark:text-white text-sm truncate">{title}</h2>
            <p className={`text-xs truncate ${partner?.isOnline ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'}`}>
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSearch(v => !v)}
            className={`p-2 rounded-xl transition-colors ${showSearch ? 'bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500'}`}
          >
            <svg className="w-4.5 h-4.5 w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-500"
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 animate-fade-in">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search messages..."
            className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            autoFocus
          />
        </div>
      )}

      {/* Message list */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(99,102,241,0.03) 1px, transparent 0)', backgroundSize: '40px 40px' }}
      >
        {/* Load more trigger */}
        <div ref={topRef} className="h-1" />

        {isLoadingMessages && (
          <div className="flex justify-center py-4">
            <svg className="w-5 h-5 animate-spin text-brand-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {/* Messages */}
        {filteredMessages.map((message, idx) => {
          const prev = filteredMessages[idx - 1];
          const next = filteredMessages[idx + 1];
          const showDate = shouldShowDateDivider(message.createdAt, prev?.createdAt);

          const prevSender = prev ? (typeof prev.senderId === 'object' ? (prev.senderId as any)._id : prev.senderId) : null;
          const currSender = typeof message.senderId === 'object' ? (message.senderId as any)._id : message.senderId;
          const nextSender = next ? (typeof next.senderId === 'object' ? (next.senderId as any)._id : next.senderId) : null;
          const isGrouped = prevSender === currSender && !showDate;

          return (
            <React.Fragment key={message._id}>
              {showDate && (
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                  <span className="text-xs font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
                    {formatMessageDate(message.createdAt)}
                  </span>
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                </div>
              )}
              <MessageBubble
                message={message}
                showAvatar={activeConversation.type === 'group'}
                isGrouped={isGrouped}
                onReply={setReplyTo}
              />
            </React.Fragment>
          );
        })}

        {/* Typing indicator */}
        {convTypingUsers.length > 0 && (
          <TypingIndicator
            users={convTypingUsers}
            conversationMembers={activeConversation.members}
          />
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <MessageInput
        conversationId={activeConversation._id}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 text-center p-8">
      <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-brand-100 to-brand-200 dark:from-brand-900/30 dark:to-brand-800/30 flex items-center justify-center mb-6">
        <svg className="w-12 h-12 text-brand-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 12H7v-2h6v2zm3-4H7V8h9v2z" />
        </svg>
      </div>
      <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Your messages</h3>
      <p className="text-slate-400 dark:text-slate-500 text-sm max-w-xs">
        Select a conversation or start a new one to begin chatting
      </p>
    </div>
  );
}
