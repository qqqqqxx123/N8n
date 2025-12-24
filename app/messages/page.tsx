'use client';

import { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/navbar';
import { Contact } from '@/lib/types/database';

interface Message {
  id: string;
  contact_id: string;
  direction: 'in' | 'out';
  body: string | null;
  template_name: string | null;
  status: string;
  is_read: boolean;
  created_at: string;
}

interface Conversation {
  contact: Contact;
  latestMessage: Message;
  unreadCount: number;
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageBody, setMessageBody] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchConversationsMemo = useCallback(async () => {
    try {
      const response = await fetch('/api/messages/conversations?limit=100');
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAllContacts = useCallback(async () => {
    try {
      const response = await fetch('/api/contacts?limit=1000');
      if (response.ok) {
        const data = await response.json();
        setAllContacts(data.contacts || []);
      }
    } catch (err) {
      console.error('Error fetching contacts:', err);
    }
  }, []);

  const fetchMessages = useCallback(async (contactId: string) => {
    try {
      const response = await fetch(`/api/messages/${contactId}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  }, []);

  const markAsRead = useCallback(async (contactId: string) => {
    try {
      await fetch(`/api/messages/${contactId}/read`, {
        method: 'POST',
      });
      // Refresh conversations to update unread count
      fetchConversationsMemo();
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  }, [fetchConversationsMemo]);

  useEffect(() => {
    fetchConversationsMemo();
    fetchAllContacts();
  }, [fetchConversationsMemo, fetchAllContacts]);

  useEffect(() => {
    if (selectedContact) {
      fetchMessages(selectedContact.id);
      markAsRead(selectedContact.id);
    }
  }, [selectedContact, markAsRead, fetchMessages]);

  // Auto-refresh conversations and contacts every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConversationsMemo();
      fetchAllContacts(); // Also refresh contacts to include newly created ones
      if (selectedContact) {
        fetchMessages(selectedContact.id);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [selectedContact, fetchConversationsMemo, fetchAllContacts, fetchMessages]);

  async function handleSendMessage() {
    if (!selectedContact || !messageBody.trim()) return;

    setIsSending(true);
    setError(null);

    try {
      const response = await fetch(`/api/messages/${selectedContact.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: messageBody }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send message');
      }

      const result = await response.json();
      setMessageBody('');

      // Immediately update messages with the response data (with updated status from API)
      if (result.message) {
        setMessages(prev => {
          // Remove any duplicate message with same ID, then add the new one
          const filtered = prev.filter(m => m.id !== result.message.id);
          return [...filtered, result.message];
        });
      }

      // Refresh messages after a short delay to ensure we have the latest status
      // (in case webhook response came after API response)
      setTimeout(async () => {
        await fetchMessages(selectedContact.id);
      }, 1000);

      await fetchConversationsMemo();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  }

  function formatTime(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-full mx-auto h-[calc(100vh-5rem)]">
        <div className="flex h-full">
          {/* Contacts List */}
          <div className="w-1/3 border-r bg-white flex flex-col">
            <div className="p-4 border-b">
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Messages</h2>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or WhatsApp number..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 placeholder:text-gray-400"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-center text-gray-500">Loading...</div>
              ) : (() => {
                // Create a map of contacts with conversations (for unread counts and latest messages)
                const conversationMap = new Map<string, { contact: Contact; unreadCount: number; latestMessage?: Message }>();
                conversations.forEach(conv => {
                  conversationMap.set(conv.contact.id, {
                    contact: conv.contact,
                    unreadCount: conv.unreadCount,
                    latestMessage: conv.latestMessage,
                  });
                });

                // Merge contacts from conversations with allContacts to ensure new contacts are shown
                const allContactsMap = new Map<string, Contact>();
                allContacts.forEach(contact => {
                  allContactsMap.set(contact.id, contact);
                });
                // Add contacts from conversations that might not be in allContacts yet
                conversationMap.forEach((conv) => {
                  if (!allContactsMap.has(conv.contact.id)) {
                    allContactsMap.set(conv.contact.id, conv.contact);
                  }
                });

                // Convert back to array and filter based on search query
                const mergedContacts = Array.from(allContactsMap.values());
                const filteredContacts = mergedContacts.filter(contact => {
                  if (!searchQuery.trim()) return true;
                  const query = searchQuery.toLowerCase();
                  const name = (contact.full_name || '').toLowerCase();
                  const phone = (contact.phone_e164 || '').toLowerCase();
                  return name.includes(query) || phone.includes(query);
                });

                // Separate: contacts with conversations first, then all others
                const contactsWithConversations = filteredContacts.filter(c => conversationMap.has(c.id));
                const contactsWithoutConversations = filteredContacts.filter(c => !conversationMap.has(c.id));

                if (filteredContacts.length === 0) {
                  return <div className="p-4 text-center text-gray-500">No contacts found</div>;
                }

                return (
                  <>
                    {/* Contacts with conversations */}
                    {contactsWithConversations.map((contact) => {
                      const conv = conversationMap.get(contact.id);
                      return (
                        <button
                          key={contact.id}
                          onClick={() => setSelectedContact(contact)}
                          className={`w-full text-left p-4 border-b hover:bg-gray-50 transition-colors ${
                            selectedContact?.id === contact.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-gray-900 truncate">
                                  {contact.full_name || contact.phone_e164}
                                </p>
                                {conv && conv.unreadCount > 0 && (
                                  <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-600 rounded-full">
                                    {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 truncate mt-1">
                                {contact.phone_e164}
                              </p>
                              {conv && conv.latestMessage && (
                                <p className="text-xs text-gray-500 truncate mt-1">
                                  {conv.latestMessage.body || 'Message'}
                                </p>
                              )}
                            </div>
                            {conv && conv.latestMessage && (
                              <span className="text-xs text-gray-500 ml-2">
                                {formatTime(conv.latestMessage.created_at)}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}

                    {/* Contacts without conversations */}
                    {contactsWithoutConversations.map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => setSelectedContact(contact)}
                        className={`w-full text-left p-4 border-b hover:bg-gray-50 transition-colors ${
                          selectedContact?.id === contact.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 truncate">
                              {contact.full_name || contact.phone_e164}
                            </p>
                            <p className="text-sm text-gray-600 truncate mt-1">
                              {contact.phone_e164}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Message View */}
          <div className="flex-1 flex flex-col bg-gray-100">
            {selectedContact ? (
              <>
                {/* Contact Header */}
                <div className="bg-white border-b p-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedContact.full_name || selectedContact.phone_e164}
                  </h3>
                  <p className="text-sm text-gray-600">{selectedContact.phone_e164}</p>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.direction === 'out' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg px-4 py-2 ${
                          message.direction === 'out'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-900 border border-gray-200'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.body || '(No content)'}</p>
                        <p
                          className={`text-xs mt-1 ${
                            message.direction === 'out' ? 'text-blue-100' : 'text-gray-500'
                          }`}
                        >
                          {formatTime(message.created_at)}
                          {message.direction === 'out' && (
                            <span className="ml-1">
                              {message.status === 'delivered' ? '✓✓' : message.status === 'sent' ? '✓' : ''}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Message Input */}
                <div className="bg-white border-t p-4">
                  {error && (
                    <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                      {error}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={messageBody}
                      onChange={(e) => setMessageBody(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Type a message..."
                      className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base text-gray-900 bg-white"
                      disabled={isSending}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={isSending || !messageBody.trim()}
                      className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSending ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                Select a conversation to start messaging
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

