'use client';

import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  role: {
    name: string;
  };
}

interface Message {
  id: string;
  tenantId: string;
  branchId: string;
  senderId: string;
  recipientId: string | null;
  recipientRole: string | null;
  content: string;
  isRead: boolean;
  createdAt: string;
  sender?: {
    id: string;
    firstName: string;
    lastName: string;
    role?: { name: string };
  };
}

interface ConversationItem {
  employee: Employee;
  lastMessage: Message | null;
  unreadCount: number;
}

export default function MessagingPage() {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activePartner, setActivePartner] = useState<Employee | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('http://localhost:4000/api/v1');
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string>('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<any>(null);

  // Load token and API URL
  useEffect(() => {
    const storedToken = localStorage.getItem('hos_jwt_token') || '';
    setToken(storedToken);

    // Decode token to find current employee ID
    if (storedToken) {
      try {
        const parts = storedToken.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          setCurrentEmployeeId(payload.employeeId || '');
        }
      } catch (e) {
        console.error('Error decoding token:', e);
      }
    }

    const customUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
    setApiBaseUrl(customUrl);
  }, []);

  const getHeaders = () => {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  };

  // Fetch initial conversations list
  const fetchConversationsList = async () => {
    if (!token || !apiBaseUrl) return;
    try {
      const res = await fetch(`${apiBaseUrl}/messaging/conversations`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      } else {
        setError('Failed to load conversations.');
      }
    } catch (err) {
      setError('Connection error.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch chat history for selected partner
  const fetchChatHistory = async (partnerId: string) => {
    if (!token || !apiBaseUrl) return;
    try {
      const res = await fetch(`${apiBaseUrl}/messaging/conversation/${partnerId}`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }
  };

  // Handle marking messages as read
  const markMessagesAsRead = async (partnerId: string, msgs: Message[]) => {
    if (!token || !apiBaseUrl) return;
    const unreadFromPartner = msgs.filter(
      (m) => m.senderId === partnerId && !m.isRead
    );

    for (const msg of unreadFromPartner) {
      try {
        await fetch(`${apiBaseUrl}/messaging/${msg.id}/read`, {
          method: 'PATCH',
          headers: getHeaders(),
        });
      } catch (err) {
        console.error('Error marking message read:', err);
      }
    }

    // Refresh conversations list to clear counts
    fetchConversationsList();
  };

  // Auto-scroll chat window to the bottom
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load conversations once token is loaded
  useEffect(() => {
    if (token && apiBaseUrl) {
      fetchConversationsList();
    }
  }, [token, apiBaseUrl]);

  // Handle partner switch
  useEffect(() => {
    if (activePartner) {
      fetchChatHistory(activePartner.id);
    }
  }, [activePartner]);

  // Set up WebSockets
  useEffect(() => {
    let socket: any = null;
    if (token && apiBaseUrl) {
      const wsUrl = apiBaseUrl.replace('/api/v1', '/messaging');
      socket = io(wsUrl, {
        transports: ['websocket'],
        auth: { token },
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('[WS-Messaging] Gateway connected.');
      });

      socket.on('message', (msg: Message) => {
        console.log('[WS-Messaging] New message received:', msg);

        // If the message is from the active partner, or we are the sender
        if (
          (activePartner && msg.senderId === activePartner.id) ||
          msg.senderId === currentEmployeeId
        ) {
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === msg.id);
            if (exists) return prev;
            const updated = [...prev, msg];
            // If message is from partner, mark it read instantly
            if (msg.senderId === activePartner?.id) {
              fetch(`${apiBaseUrl}/messaging/${msg.id}/read`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
              }).then(() => {
                fetchConversationsList();
              });
            }
            return updated;
          });
        } else {
          // Trigger sidebar reload to update count
          fetchConversationsList();
        }
      });
    }

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [token, apiBaseUrl, activePartner, currentEmployeeId]);

  // Send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activePartner) return;

    try {
      const res = await fetch(`${apiBaseUrl}/messaging`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          recipientId: activePartner.id,
          content: inputText.trim(),
        }),
      });

      if (res.ok) {
        setInputText('');
        // Sidebar list will update through Websocket echo or fetch
        fetchConversationsList();
      } else {
        const err = await res.json();
        alert(err.message || 'Error sending message');
      }
    } catch (err) {
      alert('Error sending message');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-200">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-sm font-medium">Loading workspace messaging...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar - Conversations list */}
      <div className="w-80 border-r border-slate-800 bg-slate-900/60 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Staff Directory
          </h2>
          <p className="text-xs text-slate-400 mt-1">Direct messaging with active staff</p>
        </div>

        {error && (
          <div className="bg-rose-500/10 border-b border-rose-500/20 text-rose-500 p-3 text-xs text-center">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="text-slate-500 text-xs text-center p-4">No other active staff available.</div>
          ) : (
            conversations.map((item) => {
              const isActive = activePartner?.id === item.employee.id;
              return (
                <button
                  key={item.employee.id}
                  onClick={() => {
                    setActivePartner(item.employee);
                    // Clear count in UI instantly
                    setConversations((prev) =>
                      prev.map((c) =>
                        c.employee.id === item.employee.id ? { ...c, unreadCount: 0 } : c
                      )
                    );
                    markMessagesAsRead(item.employee.id, messages);
                  }}
                  className={`w-full text-left p-3 rounded-lg flex items-center justify-between transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : 'hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-sm truncate">
                        {item.employee.firstName} {item.employee.lastName}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider ${
                          isActive
                            ? 'bg-indigo-500 text-indigo-100'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {item.employee.role.name}
                      </span>
                    </div>
                    {item.lastMessage ? (
                      <p
                        className={`text-xs mt-0.5 truncate ${
                          isActive ? 'text-indigo-200' : 'text-slate-400'
                        }`}
                      >
                        {item.lastMessage.content}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 italic mt-0.5">No messages exchanged</p>
                    )}
                  </div>
                  {item.unreadCount > 0 && !isActive && (
                    <span className="h-5 w-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                      {item.unreadCount}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Panel */}
      <div className="flex-1 flex flex-col bg-slate-950">
        {activePartner ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-100 text-base">
                  {activePartner.firstName} {activePartner.lastName}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  <span className="text-xs text-slate-400 font-medium">Online</span>
                  <span className="text-slate-600 text-[10px]">•</span>
                  <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest font-bold">
                    {activePartner.role.name}
                  </span>
                </div>
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm">
                  <span className="text-4xl">💬</span>
                  <p className="mt-2">This is the start of your secure direct message history.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderId === currentEmployeeId;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-xl p-3.5 shadow-sm text-sm ${
                          isMe
                            ? 'bg-indigo-600 text-white rounded-br-none'
                            : 'bg-slate-800/80 text-slate-200 rounded-bl-none border border-slate-700/50'
                        }`}
                      >
                        <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                        <div
                          className={`text-[9px] mt-1 flex items-center justify-between ${
                            isMe ? 'text-indigo-200' : 'text-slate-400'
                          }`}
                        >
                          <span>
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {isMe && (
                            <span className="ml-2">
                              {msg.isRead ? '✓✓ Read' : '✓ Sent'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Send Input Box */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/20">
              <form onSubmit={handleSendMessage} className="relative flex items-center">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message ${activePartner.firstName}...`}
                  rows={1}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-lg py-3 pl-4 pr-24 text-sm text-slate-200 placeholder-slate-500 focus:outline-none resize-none overflow-hidden"
                />
                <div className="absolute right-3 flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 hidden sm:inline font-mono">
                    ↵ to send
                  </span>
                  <button
                    type="submit"
                    disabled={!inputText.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white px-3 py-1.5 rounded-md text-xs font-bold transition-all shadow-md"
                  >
                    Send
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <span className="text-6xl mb-4 text-indigo-500 animate-pulse">✉️</span>
            <h3 className="text-lg font-bold text-slate-200">No chat selected</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm text-center">
              Select a colleague from the staff directory on the left to start communicating securely.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
