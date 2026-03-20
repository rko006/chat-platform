import React, { useRef, useEffect } from 'react';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  position?: 'top' | 'bottom';
}

export default function EmojiPicker({ onSelect, onClose, position = 'top' }: EmojiPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Quick emoji reactions row
  const quickEmojis = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '👏', '🙏', '💯'];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Attempt to load emoji-mart dynamically
  const [EmojiMartPicker, setEmojiMartPicker] = React.useState<any>(null);

  useEffect(() => {
    import('@emoji-mart/react').then(m => setEmojiMartPicker(() => m.default)).catch(() => {});
  }, []);

  return (
    <div
      ref={ref}
      className={`absolute ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} right-0 z-50 animate-fade-in`}
    >
      {EmojiMartPicker ? (
        <EmojiMartPicker
          onEmojiSelect={(e: any) => { onSelect(e.native); onClose(); }}
          theme="auto"
          previewPosition="none"
          skinTonePosition="none"
          maxFrequentRows={1}
          perLine={8}
        />
      ) : (
        // Fallback quick picker
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-3">
          <div className="flex gap-1 flex-wrap max-w-[220px]">
            {quickEmojis.map(emoji => (
              <button
                key={emoji}
                onClick={() => { onSelect(emoji); onClose(); }}
                className="w-9 h-9 flex items-center justify-center text-xl hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reaction picker (compact row of quick emojis) ────────────────────────────
interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function ReactionPicker({ onSelect, onClose }: ReactionPickerProps) {
  const quickEmojis = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉'];
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-slate-800 rounded-full shadow-xl border border-slate-200 dark:border-slate-700 px-2 py-1.5 flex gap-0.5 animate-fade-in"
    >
      {quickEmojis.map(emoji => (
        <button
          key={emoji}
          onClick={() => { onSelect(emoji); onClose(); }}
          className="w-8 h-8 flex items-center justify-center text-lg hover:scale-125 transition-transform"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
