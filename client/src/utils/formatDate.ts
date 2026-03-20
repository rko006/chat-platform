import { format, isToday, isYesterday, isThisWeek, isThisYear, formatDistanceToNow } from 'date-fns';

export function formatMessageTime(date: string | Date): string {
  const d = new Date(date);
  return format(d, 'h:mm a');
}

export function formatConversationTime(date: string | Date): string {
  const d = new Date(date);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  if (isThisWeek(d)) return format(d, 'EEE');
  if (isThisYear(d)) return format(d, 'MMM d');
  return format(d, 'MM/dd/yy');
}

export function formatMessageDate(date: string | Date): string {
  const d = new Date(date);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  if (isThisWeek(d)) return format(d, 'EEEE');
  if (isThisYear(d)) return format(d, 'MMMM d');
  return format(d, 'MMMM d, yyyy');
}

export function formatLastSeen(date: string | Date): string {
  const d = new Date(date);
  if (isToday(d)) return `last seen today at ${format(d, 'h:mm a')}`;
  if (isYesterday(d)) return `last seen yesterday at ${format(d, 'h:mm a')}`;
  return `last seen ${formatDistanceToNow(d, { addSuffix: true })}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function shouldShowDateDivider(current: string | Date, previous?: string | Date): boolean {
  if (!previous) return true;
  const curr = new Date(current);
  const prev = new Date(previous);
  return curr.toDateString() !== prev.toDateString();
}

export function formatAudioDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
