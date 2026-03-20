import React from 'react';
import { useChat } from '../contexts/ChatContext';
import ChatSidebar from '../components/ChatSidebar';
import Conversation from '../components/Conversation';

export default function ChatPage() {
  const { activeConversation } = useChat();

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-white dark:bg-slate-900">
      {/* Sidebar — full width on mobile, fixed width on desktop */}
      <div className={`
        ${activeConversation ? 'hidden lg:flex' : 'flex'}
        lg:w-[340px] xl:w-[380px] w-full flex-shrink-0 flex-col
        border-r border-slate-100 dark:border-slate-800
      `}>
        <ChatSidebar />
      </div>

      {/* Main conversation area */}
      <div className={`
        ${activeConversation ? 'flex' : 'hidden lg:flex'}
        flex-1 flex-col min-w-0
      `}>
        <Conversation />
      </div>
    </div>
  );
}
