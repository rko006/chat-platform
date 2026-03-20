import { useCallback, useRef } from 'react';
import { socketEmit } from '../services/socket';

export function useTyping(conversationId: string) {
  const typingRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const startTyping = useCallback(() => {
    if (!typingRef.current) {
      typingRef.current = true;
      socketEmit.typing(conversationId);
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (typingRef.current) {
        typingRef.current = false;
        socketEmit.stopTyping(conversationId);
      }
    }, 2500);
  }, [conversationId]);

  const stopTyping = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (typingRef.current) {
      typingRef.current = false;
      socketEmit.stopTyping(conversationId);
    }
  }, [conversationId]);

  return { startTyping, stopTyping };
}
