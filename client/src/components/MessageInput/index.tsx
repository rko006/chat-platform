import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Message, User, MediaUploadResult } from '../../types';
import { useChat } from '../../contexts/ChatContext';
import { socketEmit } from '../../services/socket';
import EmojiPicker from '../EmojiPicker';
import FileUploader from '../FileUploader';

interface MessageInputProps {
  conversationId: string;
  replyTo: Message | null;
  onCancelReply: () => void;
}

export default function MessageInput({ conversationId, replyTo, onCancelReply }: MessageInputProps) {
  const { sendMessage } = useChat();
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showFileUploader, setShowFileUploader] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout>();
  const audioChunksRef = useRef<Blob[]>([]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, [text]);

  // Focus on mount and when reply changes
  useEffect(() => {
    textareaRef.current?.focus();
  }, [replyTo]);

  const handleTyping = useCallback(() => {
    socketEmit.typing(conversationId);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketEmit.stopTyping(conversationId);
    }, 2000);
  }, [conversationId]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    handleTyping();
  };

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    socketEmit.stopTyping(conversationId);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    await sendMessage({
      text: trimmed,
      messageType: 'text',
      replyTo: replyTo?._id,
    });
    onCancelReply();
  }, [text, conversationId, replyTo, sendMessage, onCancelReply]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    const ta = textareaRef.current;
    if (ta) {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newText = text.slice(0, start) + emoji + text.slice(end);
      setText(newText);
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + emoji.length; ta.focus(); }, 0);
    } else {
      setText(t => t + emoji);
    }
    setShowEmoji(false);
  };

  const handleFileUploaded = async (result: MediaUploadResult) => {
    setShowFileUploader(false);
    const typeMap: Record<string, string> = {
      image: 'image',
      video: 'video',
      audio: 'audio',
    };
    await sendMessage({
      messageType: typeMap[result.mediaType] || 'file',
      mediaUrl: result.mediaUrl,
      mediaType: result.mimeType,
      mediaSize: result.mediaSize,
      mediaName: result.mediaName,
      replyTo: replyTo?._id,
    });
    onCancelReply();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());

        const formData = new FormData();
        formData.append('file', file);
        try {
          const { mediaAPI } = await import('../../services/api');
          const { data } = await mediaAPI.upload(file);
          await sendMessage({ messageType: 'audio', mediaUrl: data.mediaUrl, mediaType: 'audio/webm', replyTo: replyTo?._id });
          onCancelReply();
        } catch { console.error('Voice upload failed'); }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch { console.error('Mic not available'); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingTime(0);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingTime(0);
    audioChunksRef.current = [];
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="px-4 pb-4 pt-2 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
      {/* Reply bar */}
      {replyTo && (
        <div className="flex items-center gap-2 mb-2 p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border-l-4 border-brand-500 animate-fade-in">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-brand-600 dark:text-brand-400">
              Replying to {(replyTo.senderId as User)?.username}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {replyTo.text || `[${replyTo.messageType}]`}
            </p>
          </div>
          <button onClick={onCancelReply} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Input row */}
      {isRecording ? (
        <div className="flex items-center gap-3 px-2 py-2 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-medium text-red-600 dark:text-red-400 flex-1">
            Recording {formatTime(recordingTime)}
          </span>
          <button onClick={cancelRecording} className="text-slate-400 hover:text-red-500 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <button onClick={stopRecording} className="w-8 h-8 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-colors shadow-md">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          {/* Attach button */}
          <button
            onClick={() => setShowFileUploader(true)}
            className="mb-1 p-2 text-slate-400 hover:text-brand-500 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>

          {/* Text input area */}
          <div className="flex-1 relative flex items-end bg-slate-100 dark:bg-slate-800 rounded-2xl px-4 py-2.5 gap-2">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Message..."
              rows={1}
              className="flex-1 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none resize-none leading-5 max-h-[120px] overflow-y-auto scrollbar-thin"
            />
            {/* Emoji button inside */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowEmoji(v => !v)}
                className="text-slate-400 hover:text-amber-500 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              {showEmoji && (
                <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmoji(false)} />
              )}
            </div>
          </div>

          {/* Send or voice */}
          {text.trim() ? (
            <button
              onClick={handleSend}
              className="mb-1 w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 rounded-full flex items-center justify-center text-white shadow-md shadow-brand-500/30 transition-all duration-200 hover:scale-105 flex-shrink-0"
            >
              <svg className="w-5 h-5 -rotate-45 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          ) : (
            <button
              onMouseDown={startRecording}
              className="mb-1 w-10 h-10 bg-slate-100 dark:bg-slate-800 hover:bg-brand-100 dark:hover:bg-brand-900/30 rounded-full flex items-center justify-center text-slate-500 hover:text-brand-500 transition-all duration-200 flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* File uploader modal */}
      {showFileUploader && (
        <FileUploader onUploadComplete={handleFileUploaded} onClose={() => setShowFileUploader(false)} />
      )}
    </div>
  );
}
