import { useRef, useCallback, useEffect } from 'react';

export function useScrollToBottom<T extends HTMLElement>(dependencies: any[]) {
  const ref = useRef<T>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (!ref.current) return;
    ref.current.scrollTo({ top: ref.current.scrollHeight, behavior });
  }, []);

  const isNearBottom = useCallback((threshold = 200): boolean => {
    if (!ref.current) return true;
    const { scrollHeight, scrollTop, clientHeight } = ref.current;
    return scrollHeight - scrollTop - clientHeight < threshold;
  }, []);

  useEffect(() => {
    if (isNearBottom()) scrollToBottom('smooth');
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps

  return { ref, scrollToBottom, isNearBottom };
}
