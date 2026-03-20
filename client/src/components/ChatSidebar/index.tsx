import React, { useState, useEffect, useRef } from 'react';
import { Conversation, User } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import { useTheme } from '../../contexts/ThemeContext';
import Avatar from '../common/Avatar';
import { formatConversationTime } from '../../utils/formatDate';
import { userAPI, chatAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function ChatSidebar() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { conversations, activeConversation, setActiveConversation, isLoadingConversations, unreadTotal, createDirectConversation, refreshConversations } = useChat();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = conversations.filter(conv => {
    const name = getConversationName(conv, user?._id);
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase());
    const hasUnread = tab === 'unread' ? (conv.unreadCounts?.[user?._id || ''] || 0) > 0 : true;
    return matchesSearch && hasUnread;
  });

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">ChatFlow</h1>
            {unreadTotal > 0 && (
              <span className="bg-brand-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {unreadTotal > 99 ? '99+' : unreadTotal}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowNewChat(true)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-500 dark:text-slate-400"
              title="New chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>

            {/* User menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu(v => !v)}
                className="p-0.5 hover:ring-2 hover:ring-brand-400 rounded-full transition-all"
              >
                <Avatar src={user?.profilePicture} name={user?.username || ''} size="sm" isOnline={true} />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 z-50 animate-fade-in overflow-hidden">
                  <div className="p-3 border-b border-slate-100 dark:border-slate-700">
                    <p className="font-semibold text-sm text-slate-800 dark:text-white">{user?.username}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{user?.email}</p>
                  </div>
                  <div className="py-1">
                    <MenuButton icon="🌙" label={isDark ? 'Light mode' : 'Dark mode'} onClick={() => { toggleTheme(); setShowUserMenu(false); }} />
                    <MenuButton icon="🚪" label="Sign out" onClick={async () => { setShowUserMenu(false); await logout(); }} danger />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-3">
          {(['all', 'unread'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize ${tab === t ? 'bg-brand-500 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoadingConversations ? (
          <div className="p-4 space-y-3">
            {[...Array(6)].map((_, i) => <ConversationSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center px-4">
            <span className="text-4xl mb-2">💬</span>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {searchQuery ? 'No conversations found' : tab === 'unread' ? 'No unread messages' : 'No conversations yet'}
            </p>
            {!searchQuery && tab === 'all' && (
              <button onClick={() => setShowNewChat(true)} className="mt-3 text-xs text-brand-500 hover:underline">
                Start a new conversation
              </button>
            )}
          </div>
        ) : (
          <div className="py-2">
            {filtered.map(conv => (
              <ConversationItem
                key={conv._id}
                conversation={conv}
                currentUserId={user?._id || ''}
                isActive={activeConversation?._id === conv._id}
                onClick={() => setActiveConversation(conv)}
              />
            ))}
          </div>
        )}
      </div>

      {/* New chat modal */}
      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onStartChat={async (userId) => {
            try {
              const conv = await createDirectConversation(userId);
              setActiveConversation(conv);
              setShowNewChat(false);
            } catch { toast.error('Failed to start conversation'); }
          }}
          onCreateGroup={async (name, memberIds) => {
            try {
              await chatAPI.createGroup({ name, memberIds });
              await refreshConversations();
              setShowNewChat(false);
              toast.success('Group created!');
            } catch { toast.error('Failed to create group'); }
          }}
          currentUserId={user?._id || ''}
        />
      )}
    </div>
  );
}

// ─── Conversation item ───────────────────────────────────────────────────────
function ConversationItem({ conversation, currentUserId, isActive, onClick }: {
  conversation: Conversation;
  currentUserId: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const partner = conversation.type === 'direct'
    ? conversation.members.find(m => m._id !== currentUserId)
    : null;

  const name = getConversationName(conversation, currentUserId);
  const avatar = partner?.profilePicture || conversation.groupImage;
  const isOnline = partner?.isOnline;
  const unread = conversation.unreadCounts?.[currentUserId] || 0;
  const lastMsg = conversation.lastMessage;
  const lastText = lastMsg?.isDeleted
    ? 'Message deleted'
    : lastMsg?.text
    ? lastMsg.text
    : lastMsg?.messageType === 'image' ? '📷 Photo'
    : lastMsg?.messageType === 'video' ? '🎬 Video'
    : lastMsg?.messageType === 'audio' ? '🎵 Voice message'
    : lastMsg?.messageType === 'file' ? '📎 File'
    : '';

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left ${isActive ? 'bg-brand-50 dark:bg-brand-900/20 border-r-2 border-brand-500' : ''}`}
    >
      <Avatar src={avatar} name={name} size="md" isOnline={conversation.type === 'direct' ? isOnline : undefined} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className={`text-sm truncate ${unread > 0 ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-800 dark:text-slate-200'}`}>
            {name}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0 ml-1">
            {conversation.lastMessageAt && formatConversationTime(conversation.lastMessageAt)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <p className={`text-xs truncate max-w-[170px] ${unread > 0 ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
            {lastText || 'Start a conversation'}
          </p>
          {unread > 0 && (
            <span className="flex-shrink-0 ml-1 min-w-[18px] h-[18px] bg-brand-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function getConversationName(conv: Conversation, userId?: string): string {
  if (conv.type === 'group') return conv.name || 'Group';
  const partner = conv.members.find(m => m._id !== userId);
  return partner?.username || 'Unknown';
}

function ConversationSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="skeleton w-10 h-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-3 w-3/4 rounded" />
        <div className="skeleton h-2.5 w-1/2 rounded" />
      </div>
    </div>
  );
}

function MenuButton({ icon, label, onClick, danger }: { icon: string; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${danger ? 'text-red-500' : 'text-slate-700 dark:text-slate-200'}`}
    >
      <span>{icon}</span>
      {label}
    </button>
  );
}

// ─── New Chat Modal ──────────────────────────────────────────────────────────
function NewChatModal({ onClose, onStartChat, onCreateGroup, currentUserId }: {
  onClose: () => void;
  onStartChat: (userId: string) => void;
  onCreateGroup: (name: string, memberIds: string[]) => void;
  currentUserId: string;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [selected, setSelected] = useState<User[]>([]);
  const [mode, setMode] = useState<'direct' | 'group'>('direct');
  const [groupName, setGroupName] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await userAPI.search(query);
        setResults(data.users);
      } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const toggleSelect = (u: User) => {
    setSelected(s => s.some(x => x._id === u._id) ? s.filter(x => x._id !== u._id) : [...s, u]);
  };

  const handleCreate = () => {
    if (mode === 'direct' && selected.length === 1) {
      onStartChat(selected[0]._id);
    } else if (mode === 'group' && selected.length >= 2 && groupName.trim()) {
      onCreateGroup(groupName.trim(), selected.map(u => u._id));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 animate-fade-in" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-white">New Conversation</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {/* Mode tabs */}
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-700 p-1 gap-1">
            {(['direct', 'group'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} className={`flex-1 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${mode === m ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>{m === 'direct' ? 'Direct Message' : 'Create Group'}</button>
            ))}
          </div>

          {mode === 'group' && (
            <input
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              placeholder="Group name..."
              className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          )}

          {/* Selected users */}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selected.map(u => (
                <div key={u._id} className="flex items-center gap-1.5 bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 rounded-full px-3 py-1 text-xs font-medium">
                  <Avatar src={u.profilePicture} name={u.username} size="xs" />
                  {u.username}
                  <button onClick={() => toggleSelect(u)} className="hover:text-brand-500">×</button>
                </div>
              ))}
            </div>
          )}

          {/* Search */}
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search users..."
            className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            autoFocus
          />

          {/* Results */}
          <div className="space-y-1">
            {searching && <p className="text-xs text-slate-400 text-center py-2">Searching...</p>}
            {results.map(u => (
              <button
                key={u._id}
                onClick={() => mode === 'direct' ? onStartChat(u._id) : toggleSelect(u)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left ${selected.some(s => s._id === u._id) ? 'bg-brand-50 dark:bg-brand-900/20' : ''}`}
              >
                <Avatar src={u.profilePicture} name={u.username} size="sm" isOnline={u.isOnline} />
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-white">{u.username}</p>
                  {u.bio && <p className="text-xs text-slate-400 truncate max-w-[200px]">{u.bio}</p>}
                </div>
                {mode === 'group' && selected.some(s => s._id === u._id) && (
                  <div className="ml-auto w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {mode === 'group' && selected.length >= 2 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-700">
            <button
              onClick={handleCreate}
              disabled={!groupName.trim()}
              className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 disabled:bg-brand-300 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              Create Group ({selected.length} members)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
