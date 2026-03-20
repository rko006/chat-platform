import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Message, User } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import Avatar from '../common/Avatar';
import { formatMessageTime, formatFileSize, formatMessageDate } from '../../utils/formatDate';

interface MessageBubbleProps {
  message: Message;
  showAvatar?: boolean;
  isGrouped?: boolean;
  onReply: (message: Message) => void;
}

const QUICK_EMOJIS = ['❤️', '😂', '😮', '😢', '😡', '👍'];

function MessageStatus({ status }: { status: string }) {
  if (status === 'sending') return <svg className="w-3 h-3 text-white/60 animate-pulse" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg>;
  if (status === 'sent') return <svg className="w-3.5 h-3.5 text-white/70" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></svg>;
  if (status === 'delivered') return <svg className="w-4 h-3.5 text-white/70" fill="currentColor" viewBox="0 0 24 24"><path d="M.41 13.41L6 19l1.41-1.42L1.83 12 .41 13.41zm5.66 5.66l1.41 1.41L23 5.41 21.59 4 6.07 19.07zm9.6-9.6l-1.42-1.41-6.6 6.59 1.41 1.41 6.61-6.59z" /></svg>;
  if (status === 'seen') return <svg className="w-4 h-3.5 text-blue-300" fill="currentColor" viewBox="0 0 24 24"><path d="M.41 13.41L6 19l1.41-1.42L1.83 12 .41 13.41zm5.66 5.66l1.41 1.41L23 5.41 21.59 4 6.07 19.07zm9.6-9.6l-1.42-1.41-6.6 6.59 1.41 1.41 6.61-6.59z" /></svg>;
  return null;
}

function AudioMessage({ url }: { url: string }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause(); else audioRef.current.play();
    setPlaying(!playing);
  };
  return (
    <div className="flex items-center gap-2 mt-1 min-w-[180px]">
      <audio ref={audioRef} src={url}
        onTimeUpdate={() => { if (audioRef.current) setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100 || 0); }}
        onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
        onEnded={() => setPlaying(false)} />
      <button onClick={toggle} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
        {playing ? <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
          : <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>}
      </button>
      <div className="flex-1">
        <div className="h-1 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white/70 rounded-full" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-[10px] opacity-70 mt-0.5">{duration ? `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}` : '—'}</p>
      </div>
    </div>
  );
}

// ─── Instagram-style overlay ──────────────────────────────────────────────────
function InstagramSheet({ message, isMine, onClose, onReply, onEdit, onCopy, onUnsend, onDeleteForMe, onReact }: {
  message: Message; isMine: boolean; onClose: () => void;
  onReply: () => void; onEdit: () => void; onCopy: () => void;
  onUnsend: () => void; onDeleteForMe: () => void;
  onReact: (emoji: string) => void;
}) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const sender = message.senderId as User;
  const senderName = isMine ? 'You' : sender?.username || 'Unknown';
  const timeLabel = formatMessageDate(message.createdAt).toUpperCase() + ' AT ' + formatMessageTime(message.createdAt).toUpperCase();

  return (
    <>
      {/* Full blurred backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
        onClick={onClose}
      />

      {/* Centered content like Instagram */}
      <div className={`fixed inset-0 z-50 flex flex-col ${isMine ? 'items-end pr-4' : 'items-start pl-16'} justify-center gap-2`} onClick={onClose}>

        {/* Floating emoji pill — top */}
        <div
          className="bg-white dark:bg-slate-800 rounded-full px-3 py-2 flex items-center gap-0.5 shadow-xl"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
          onClick={e => e.stopPropagation()}
        >
          <p className="text-xs text-slate-400 dark:text-slate-500 mr-2 whitespace-nowrap"></p>
          {QUICK_EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => { onReact(emoji); onClose(); }}
              className="w-8 h-8 flex items-center justify-center text-xl hover:scale-125 active:scale-110 transition-transform rounded-full"
            >
              {emoji}
            </button>
          ))}
          <button
            onClick={() => { onReact('👍'); onClose(); }}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 text-lg font-light hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            +
          </button>
        </div>

        {/* Message preview bubble */}
        <div
          className={`max-w-[280px] px-4 py-2.5 rounded-2xl text-sm ${isMine ? 'bg-brand-500 text-white self-end' : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm self-start'}`}
          onClick={e => e.stopPropagation()}
        >
          {message.isDeleted
            ? <span className="italic opacity-60">Message unsent</span>
            : message.text || `[${message.messageType}]`}
        </div>

        {/* Actions card — white rounded card */}
        <div
          className="w-64 bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-2xl"
          style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Timestamp header */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 tracking-wide">
              {timeLabel}
            </p>
          </div>

          {/* Action rows */}
          <button onClick={() => { onReply(); onClose(); }} className="w-full flex items-center gap-4 px-4 py-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700">
            <svg className="w-5 h-5 text-slate-700 dark:text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            <span className="text-[15px] font-medium text-slate-800 dark:text-slate-100">Reply</span>
          </button>

          {!!message.text && (
            <button onClick={() => { onCopy(); onClose(); }} className="w-full flex items-center gap-4 px-4 py-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700">
              <svg className="w-5 h-5 text-slate-700 dark:text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="text-[15px] font-medium text-slate-800 dark:text-slate-100">Copy</span>
            </button>
          )}

          {isMine && message.messageType === 'text' && (
            <button onClick={() => { onEdit(); onClose(); }} className="w-full flex items-center gap-4 px-4 py-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700">
              <svg className="w-5 h-5 text-slate-700 dark:text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span className="text-[15px] font-medium text-slate-800 dark:text-slate-100">Edit</span>
            </button>
          )}

          <button onClick={() => { onDeleteForMe(); onClose(); }} className="w-full flex items-center gap-4 px-4 py-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700">
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="text-[15px] font-medium text-slate-800 dark:text-slate-100">Delete for you</span>
          </button>

          {isMine && (
            <button onClick={() => { onUnsend(); onClose(); }} className="w-full flex items-center gap-4 px-4 py-4 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors border-b border-slate-100 dark:border-slate-700">
              <div className="w-5 h-5 rounded-full border-2 border-red-500 flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                </svg>
              </div>
              <span className="text-[15px] font-semibold text-red-500">Unsend</span>
            </button>
          )}

          
        </div>
      </div>
    </>
  );
}

// ─── Main MessageBubble ───────────────────────────────────────────────────────
export default function MessageBubble({ message, showAvatar = true, isGrouped = false, onReply }: MessageBubbleProps) {
  const { user } = useAuth();
  const { reactToMessage, editMessage, deleteMessage } = useChat();

  const [showSheet, setShowSheet] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text || '');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [copied, setCopied] = useState(false);

  const longPressTimer = useRef<NodeJS.Timeout>();
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const swipeTriggered = useRef(false);
  const longPressTriggered = useRef(false);

  const sender = message.senderId as User;
  const isMine = sender?._id === user?._id || message.senderId === user?._id;
  const isDeleted = message.isDeleted;
  const isSystem = message.messageType === 'system';

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isDeleted) return;
    const t = e.touches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
    swipeTriggered.current = false;
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      if (!swipeTriggered.current) {
        longPressTriggered.current = true;
        if (navigator.vibrate) navigator.vibrate([15, 10, 15]);
        setShowSheet(true);
      }
    }, 450);
  }, [isDeleted]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (longPressTriggered.current) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartX.current;
    const dy = Math.abs(t.clientY - touchStartY.current);
    if (dy > 10) { clearTimeout(longPressTimer.current); return; }
    const validSwipe = isMine ? dx < 0 : dx > 0;
    if (validSwipe && Math.abs(dx) > 5) {
      clearTimeout(longPressTimer.current);
      setIsSwiping(true);
      const clamped = isMine ? Math.max(-65, dx) : Math.min(65, dx);
      setSwipeX(clamped);
      if (Math.abs(dx) > 55 && !swipeTriggered.current) {
        swipeTriggered.current = true;
        if (navigator.vibrate) navigator.vibrate(35);
      }
    }
  }, [isMine]);

  const handleTouchEnd = useCallback(() => {
    clearTimeout(longPressTimer.current);
    if (swipeTriggered.current && !longPressTriggered.current) onReply(message);
    setSwipeX(0);
    setIsSwiping(false);
    swipeTriggered.current = false;
  }, [message, onReply]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!isDeleted) setShowSheet(true);
  }, [isDeleted]);

  const handleMouseDown = useCallback(() => {
    if (isDeleted) return;
    longPressTimer.current = setTimeout(() => setShowSheet(true), 600);
  }, [isDeleted]);

  const handleMouseUp = useCallback(() => clearTimeout(longPressTimer.current), []);

  const handleCopy = () => {
    if (message.text) {
      navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleSaveEdit = () => {
    if (editText.trim() && editText !== message.text) editMessage(message._id, editText.trim());
    setIsEditing(false);
  };

  const groupedReactions = message.reactions.reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const myReaction = message.reactions.find(r => r.userId === user?._id)?.emoji;

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">{message.text}</span>
      </div>
    );
  }

  return (
    <>
      {lightboxUrl && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="Full" className="max-w-full max-h-full object-contain rounded-xl" />
          <button className="absolute top-4 right-4 text-white" onClick={() => setLightboxUrl(null)}>
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {copied && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl pointer-events-none animate-fade-in">
          ✓ Copied
        </div>
      )}

      {showSheet && (
        <InstagramSheet
          message={message}
          isMine={isMine}
          onClose={() => setShowSheet(false)}
          onReply={() => onReply(message)}
          onEdit={() => { setIsEditing(true); setEditText(message.text || ''); }}
          onCopy={handleCopy}
          onUnsend={() => deleteMessage(message._id, 'everyone')}
          onDeleteForMe={() => deleteMessage(message._id, 'me')}
          onReact={(emoji) => reactToMessage(message._id, emoji)}
        />
      )}

      <div className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : ''} ${isGrouped ? 'mt-0.5' : 'mt-3'}`}>
        <div className={`flex-shrink-0 ${isGrouped ? 'invisible' : ''}`}>
          {!isMine && showAvatar
            ? <Avatar src={sender?.profilePicture} name={sender?.username || '?'} size="sm" />
            : <div className="w-9" />}
        </div>

        {/* Swipe arrow */}
        <div
          className={`flex items-center justify-center overflow-hidden transition-all duration-150 ${isMine ? 'order-first' : 'order-last'}`}
          style={{ width: Math.abs(swipeX) > 8 ? '26px' : '0px', opacity: Math.min(Math.abs(swipeX) / 55, 1) }}
        >
          <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${Math.abs(swipeX) >= 55 ? 'bg-brand-500 text-white scale-110' : 'bg-slate-200 dark:bg-slate-600 text-slate-500'}`}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </div>
        </div>

        <div
          className={`relative max-w-[70%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
          style={{
            transform: `translateX(${swipeX}px)`,
            transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)',
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onContextMenu={handleContextMenu}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {!isMine && !isGrouped && (
            <span className="text-xs font-semibold text-brand-600 dark:text-brand-400 mb-1 ml-1">{sender?.username}</span>
          )}

          {message.replyTo && (
            <div className={`text-xs rounded-lg px-2 py-1 mb-1 border-l-2 border-brand-400 bg-black/5 dark:bg-white/5 max-w-full ${isMine ? 'self-end' : ''}`}>
              <span className="font-semibold text-brand-600 dark:text-brand-400">
                @{((message.replyTo as Message).senderId as User)?.username || 'Reply'}
              </span>
              <p className="text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                {(message.replyTo as Message)?.text || `[${(message.replyTo as Message)?.messageType}]`}
              </p>
            </div>
          )}

          <div
            className={`relative px-3 py-2 rounded-2xl select-none
              ${isMine ? 'bubble-sent rounded-br-sm' : 'bubble-received rounded-bl-sm'}
              ${isDeleted ? 'opacity-50' : ''}
              ${showSheet ? 'scale-95 brightness-75' : 'scale-100'}
              transition-all duration-200`}
          >
            {isDeleted ? (
              <p className="text-sm italic opacity-60">Message unsent</p>
            ) : isEditing ? (
              <div className="flex gap-1.5 min-w-[140px]">
                <input value={editText} onChange={e => setEditText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSaveEdit(); } if (e.key === 'Escape') setIsEditing(false); }}
                  className="bg-white/20 text-white rounded px-2 py-0.5 text-sm focus:outline-none flex-1 min-w-0" autoFocus />
                <button onClick={handleSaveEdit} className="text-white font-bold text-sm">✓</button>
                <button onClick={() => setIsEditing(false)} className="text-white/70 text-sm">✕</button>
              </div>
            ) : (
              <>
                {message.messageType === 'text' && message.text && (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.text}</p>
                )}
                {message.messageType === 'image' && message.mediaUrl && (
                  <div className="cursor-pointer rounded-xl overflow-hidden mt-1 max-w-xs" onClick={() => setLightboxUrl(message.mediaUrl!)}>
                    <img src={message.mediaUrl} alt="Image" className="w-full max-h-60 object-cover" loading="lazy" />
                  </div>
                )}
                {message.messageType === 'video' && message.mediaUrl && (
                  <video controls className="rounded-xl max-w-xs max-h-60 mt-1" preload="metadata"><source src={message.mediaUrl} /></video>
                )}
                {message.messageType === 'audio' && message.mediaUrl && <AudioMessage url={message.mediaUrl} />}
                {message.messageType === 'file' && message.mediaUrl && (
                  <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 mt-1 p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
                    <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate max-w-[150px]">{message.mediaName || 'File'}</p>
                      {message.mediaSize && <p className="text-xs opacity-70">{formatFileSize(message.mediaSize)}</p>}
                    </div>
                  </a>
                )}
              </>
            )}

            <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
              {message.isEdited && <span className="text-[10px] opacity-50">edited</span>}
              <span className={`text-[10px] ${isMine ? 'text-white/60' : 'text-slate-400 dark:text-slate-500'}`}>
                {formatMessageTime(message.createdAt)}
              </span>
              {isMine && <MessageStatus status={message.status} />}
            </div>
          </div>

          {Object.keys(groupedReactions).length > 0 && (
            <div className={`flex flex-wrap gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
              {Object.entries(groupedReactions).map(([emoji, count]) => (
                <button key={emoji} onClick={() => reactToMessage(message._id, emoji)}
                  className={`flex items-center gap-0.5 text-xs rounded-full px-2 py-0.5 transition-all
                    ${myReaction === emoji
                      ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 ring-1 ring-brand-400'
                      : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 shadow-sm'}`}>
                  <span>{emoji}</span>
                  {count > 1 && <span className="font-medium">{count}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}