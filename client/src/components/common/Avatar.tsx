import React from 'react';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
  className?: string;
}

const sizeMap = {
  xs: 'w-7 h-7 text-xs',
  sm: 'w-9 h-9 text-sm',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
};

const dotSizeMap = {
  xs: 'w-2 h-2',
  sm: 'w-2.5 h-2.5',
  md: 'w-3 h-3',
  lg: 'w-3.5 h-3.5',
  xl: 'w-4 h-4',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getColorFromName(name: string): string {
  const colors = [
    'from-violet-400 to-purple-500',
    'from-blue-400 to-cyan-500',
    'from-emerald-400 to-teal-500',
    'from-rose-400 to-pink-500',
    'from-amber-400 to-orange-500',
    'from-indigo-400 to-blue-500',
    'from-fuchsia-400 to-purple-500',
    'from-sky-400 to-blue-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function Avatar({ src, name, size = 'md', isOnline, className = '' }: AvatarProps) {
  const initials = getInitials(name || '?');
  const gradient = getColorFromName(name || '?');

  return (
    <div className={`relative flex-shrink-0 ${className}`}>
      <div className={`${sizeMap[size]} rounded-full overflow-hidden ring-2 ring-white dark:ring-slate-800`}>
        {src ? (
          <img
            src={src}
            alt={name}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            <span className={`font-semibold text-white ${sizeMap[size].split(' ')[2]}`}>
              {initials}
            </span>
          </div>
        )}
      </div>
      {isOnline !== undefined && (
        <span className={`absolute bottom-0 right-0 ${dotSizeMap[size]} rounded-full ring-2 ring-white dark:ring-slate-800 ${isOnline ? 'bg-emerald-400' : 'bg-slate-300 dark:bg-slate-600'}`} />
      )}
    </div>
  );
}
