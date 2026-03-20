import React from 'react';
import Avatar from '../common/Avatar';
import { User } from '../../types';

interface TypingIndicatorProps {
  users: Array<{ userId: string; username: string }>;
  conversationMembers: User[];
}

export default function TypingIndicator({ users, conversationMembers }: TypingIndicatorProps) {
  if (users.length === 0) return null;

  const getUser = (userId: string) => conversationMembers.find(m => m._id === userId);

  const label = users.length === 1
    ? `${users[0].username} is typing`
    : users.length === 2
    ? `${users[0].username} and ${users[1].username} are typing`
    : `${users.length} people are typing`;

  return (
    <div className="flex items-end gap-2 px-4 py-1 animate-fade-in">
      {users.slice(0, 2).map(u => {
        const member = getUser(u.userId);
        return (
          <Avatar
            key={u.userId}
            src={member?.profilePicture}
            name={u.username}
            size="xs"
          />
        );
      })}
      <div className="flex items-center gap-1.5 bg-white dark:bg-slate-700 rounded-2xl rounded-bl-sm px-3 py-2.5 shadow-sm">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-400 rounded-full block"
            style={{
              animation: 'bounceDot 1.4s infinite ease-in-out',
              animationDelay: `${i * 0.16}s`,
            }}
          />
        ))}
      </div>
      <span className="text-xs text-slate-400 dark:text-slate-500 mb-1">{label}</span>
    </div>
  );
}
