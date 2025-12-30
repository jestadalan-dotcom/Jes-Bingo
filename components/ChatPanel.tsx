import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, X, Minimize2, Maximize2 } from 'lucide-react';
import { ChatMessagePayload } from '../types';

interface ChatPanelProps {
  messages: ChatMessagePayload[];
  onSendMessage: (text: string) => void;
  currentUser: string;
  isOpen: boolean;
  onToggle: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ messages, onSendMessage, currentUser, isOpen, onToggle }) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText);
      setInputText('');
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-xl z-40 transition-all flex items-center gap-2"
      >
        <MessageSquare className="w-6 h-6" />
        <span className="font-bold hidden md:inline">Chat</span>
        {messages.length > 0 && (
           <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full animate-bounce">
             {messages.length > 9 ? '9+' : messages.length}
           </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-80 md:w-96 bg-white rounded-2xl shadow-2xl z-40 flex flex-col border border-slate-200 overflow-hidden animate-fade-in max-h-[500px]">
      <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
        <h3 className="font-bold flex items-center gap-2">
           <MessageSquare className="w-4 h-4" /> Party Chat
        </h3>
        <button onClick={onToggle} className="hover:text-blue-300 transition-colors">
          <Minimize2 className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 min-h-[300px]">
        {messages.length === 0 ? (
           <div className="text-center text-slate-400 text-sm mt-10">
              No messages yet. Say hi! 👋
           </div>
        ) : (
            messages.map((msg) => {
                const isMe = msg.sender === currentUser;
                if (msg.isSystem) {
                    return (
                        <div key={msg.id} className="text-center text-xs text-slate-400 my-2 italic">
                            {msg.text}
                        </div>
                    )
                }
                return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className="text-[10px] text-slate-400 mb-0.5 px-1">{msg.sender}</div>
                        <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${isMe ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'}`}>
                            {msg.text}
                        </div>
                    </div>
                );
            })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-slate-100 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2 bg-slate-100 rounded-full text-sm outline-none focus:ring-2 focus:ring-blue-200 transition-all"
        />
        <button 
           type="submit" 
           disabled={!inputText.trim()}
           className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};

export default ChatPanel;