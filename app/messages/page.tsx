'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import { Contact } from '@/lib/types/database';
import { supabase } from '@/lib/supabase/client';
import { normalizeDOB } from '@/lib/utils/dob';

interface Message {
  id: string;
  contact_id: string | null;
  phone_e164: string | null;
  direction: 'in' | 'out' | 'out (AI reply)';
  body: string | null;
  template_name: string | null;
  status: string;
  is_read: boolean;
  created_at: string;
}

interface Conversation {
  conversationKey: string; // contact_id or phone_e164
  contact: Contact | null;
  phone_e164: string | null;
  latestMessage: Message;
  unreadCount: number;
}

interface ConversationParticipant {
  conversationKey: string;
  contact: Contact | null;
  phone_e164: string | null;
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedParticipant, setSelectedParticipant] = useState<ConversationParticipant | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageBody, setMessageBody] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [contactName, setContactName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [isClearingMessages, setIsClearingMessages] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [isLoadingAiStatus, setIsLoadingAiStatus] = useState(true);
  const [isTogglingAi, setIsTogglingAi] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<string>('not_connected');
  const [isCheckingWhatsapp, setIsCheckingWhatsapp] = useState(true);
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone_e164: '',
    tags: [] as string[],
    DOB: '',
    total_spend: 0,
  });
  const [initialFormState, setInitialFormState] = useState({
    full_name: '',
    phone_e164: '',
    tags: [] as string[],
    DOB: '',
    total_spend: 0,
  });
  const subscriptionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Normalize phone number for display (ensure + prefix)
  const formatPhoneForDisplay = useCallback((phone: string | null): string => {
    if (!phone) return '';
    return phone.startsWith('+') ? phone : `+${phone}`;
  }, []);

  const fetchAiStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/ai');
      if (response.ok) {
        const data = await response.json();
        setAiEnabled(data.ai_enabled || false);
      }
    } catch (err) {
      console.error('Error fetching AI status:', err);
    } finally {
      setIsLoadingAiStatus(false);
    }
  }, []);

  const toggleAi = useCallback(async () => {
    setIsTogglingAi(true);
    try {
      const newStatus = !aiEnabled;
      const response = await fetch('/api/settings/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_enabled: newStatus }),
      });

      if (response.ok) {
        setAiEnabled(newStatus);
      } else {
        console.error('Failed to update AI status');
      }
    } catch (err) {
      console.error('Error toggling AI:', err);
    } finally {
      setIsTogglingAi(false);
    }
  }, [aiEnabled]);

  const fetchWhatsappStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/whatsapp/connection');
      if (response.ok) {
        const data = await response.json();
        setWhatsappStatus(data.status || 'not_connected');
      }
    } catch (err) {
      console.error('Error fetching WhatsApp status:', err);
    } finally {
      setIsCheckingWhatsapp(false);
    }
  }, []);

  const fetchConversations = useCallback(async () => {
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

  const fetchMessages = useCallback(async (conversationKey: string) => {
    try {
      const response = await fetch(`/api/messages/${conversationKey}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  }, []);

  const markAsRead = useCallback(async (conversationKey: string) => {
    try {
      // Mark messages as read for this conversation
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationKey);
      
      if (isUUID) {
        await fetch(`/api/messages/${conversationKey}/read`, {
          method: 'POST',
        });
      } else {
        // For phone-based conversations, mark unread messages as read
        const { data: unreadMessages } = await supabase
          .from('messages')
          .select('id')
          .eq('phone_e164', conversationKey)
          .is('contact_id', null)
          .eq('direction', 'in')
          .eq('is_read', false);

        if (unreadMessages && unreadMessages.length > 0) {
          await supabase
            .from('messages')
            .update({ is_read: true })
            .in('id', unreadMessages.map(m => m.id));
        }
      }
      
      // Refresh conversations to update unread count
      fetchConversations();
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  }, [fetchConversations]);

  // Set up Supabase Realtime subscription
  useEffect(() => {
    console.log('Setting up Supabase Realtime subscription for messages');
    
    // Create a unique channel name to avoid conflicts
    const channelName = `messages-changes-${Date.now()}`;
    
    // Subscribe to new messages
    subscriptionRef.current = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          console.log('New message received via Realtime:', payload);
          const newMessage = payload.new as Message;
          
          // Always refresh conversations to update the list
          fetchConversations();
          
          // If the new message is for the currently selected conversation, add it to messages
          if (selectedParticipant) {
            const conversationKey = newMessage.contact_id || newMessage.phone_e164;
            const selectedKey = selectedParticipant.conversationKey;
            
            // Handle both UUID and phone number matching
            const isMatch = conversationKey === selectedKey || 
                          (selectedParticipant.contact?.id && newMessage.contact_id === selectedParticipant.contact.id) ||
                          (selectedParticipant.phone_e164 && newMessage.phone_e164 === selectedParticipant.phone_e164);
            
            if (isMatch) {
              console.log('New message matches selected conversation, adding to messages:', newMessage);
              setMessages(prev => {
                // Check if message already exists
                if (prev.some(m => m.id === newMessage.id)) {
                  console.log('Message already exists in state, skipping');
                  return prev;
                }
                const updated = [...prev, newMessage].sort((a, b) => 
                  new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                );
                console.log('Added new message to state, total messages:', updated.length);
                return updated;
              });
              
              // Scroll to bottom after a short delay to ensure DOM is updated
              setTimeout(() => {
                if (messagesEndRef.current) {
                  messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
                }
              }, 100);
              
              // Mark as read if it's an inbound message
              if (newMessage.direction === 'in') {
                markAsRead(selectedParticipant.conversationKey);
              }
            } else {
              console.log('New message does not match selected conversation:', {
                messageKey: conversationKey,
                selectedKey: selectedKey,
                messageContactId: newMessage.contact_id,
                messagePhone: newMessage.phone_e164
              });
            }
          } else {
            console.log('No participant selected, only refreshing conversations list');
          }
        }
      )
      .subscribe((status) => {
        console.log('Supabase Realtime subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to messages changes');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Error subscribing to messages changes');
        }
      });

    return () => {
      console.log('Cleaning up Supabase Realtime subscription');
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [selectedParticipant, fetchConversations, markAsRead]);

  useEffect(() => {
    fetchConversations();
    fetchAiStatus();
    fetchWhatsappStatus();
  }, [fetchConversations, fetchAiStatus, fetchWhatsappStatus]);

  useEffect(() => {
    if (selectedParticipant) {
      fetchMessages(selectedParticipant.conversationKey);
      markAsRead(selectedParticipant.conversationKey);
    }
  }, [selectedParticipant, fetchMessages, markAsRead]);

  // Fallback polling mechanism in case Realtime doesn't work
  useEffect(() => {
    if (!selectedParticipant) return;

    // Poll for new messages every 3 seconds as a fallback
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/messages/${selectedParticipant.conversationKey}`);
        if (response.ok) {
          const data = await response.json();
          const latestMessages = data.messages || [];
          
          // Check if there are new messages
          setMessages(prev => {
            const prevIds = new Set(prev.map(m => m.id));
            const newMessages = latestMessages.filter((m: Message) => !prevIds.has(m.id));
            
            if (newMessages.length > 0) {
              console.log('Found new messages via polling:', newMessages.length);
              // Scroll to bottom when new messages arrive
              setTimeout(() => {
                if (messagesEndRef.current) {
                  messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
                }
              }, 100);
            }
            
            // Merge and sort all messages
            const allMessages = [...prev, ...newMessages];
            const uniqueMessages = Array.from(
              new Map(allMessages.map(m => [m.id, m])).values()
            );
            return uniqueMessages.sort((a, b) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
          });
        }
      } catch (err) {
        console.error('Error polling for messages:', err);
      }
    }, 3000); // Poll every 3 seconds

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [selectedParticipant]);

  // Auto-scroll to bottom when messages change or participant changes
  useEffect(() => {
    if (messagesEndRef.current && messagesContainerRef.current) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages, selectedParticipant]);

  // Auto-dismiss success messages
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  async function handleSendMessage() {
    if (!selectedParticipant || !messageBody.trim()) return;

    // Can only send to contacts (not orphaned phone numbers)
    if (!selectedParticipant.contact?.id) {
      setError('Cannot send message: Contact not found. Please create contact first.');
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const response = await fetch(`/api/messages/${selectedParticipant.contact.id}`, {
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

      // Immediately update messages with the response data
      if (result.message) {
        setMessages(prev => {
          const filtered = prev.filter(m => m.id !== result.message.id);
          return [...filtered, result.message].sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });
      }

      // Refresh messages after a short delay
      setTimeout(async () => {
        await fetchMessages(selectedParticipant.conversationKey);
      }, 1000);

      await fetchConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  }

  async function handleAddContact() {
    if (!selectedParticipant || !selectedParticipant.phone_e164) {
      setError('No phone number available');
      return;
    }

    if (selectedParticipant.contact) {
      setError('Contact already exists');
      return;
    }

    setIsAddingContact(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_e164: selectedParticipant.phone_e164,
          full_name: contactName.trim() || null,
          source: 'messages_manual_add',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create contact');
      }

      const data = await response.json();
      setSuccess('Contact added successfully!');
      setShowAddContactModal(false);
      setContactName('');

      // Refresh conversations to update contact info
      await fetchConversations();

      // Update selected participant with new contact
      setSelectedParticipant({
        ...selectedParticipant,
        contact: data.contact,
        conversationKey: data.contact.id,
      });

      // Refresh messages
      await fetchMessages(data.contact.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add contact');
    } finally {
      setIsAddingContact(false);
    }
  }

  function handleOpenEditModal() {
    if (!selectedParticipant) return;
    
    // Initialize form with existing contact data or phone number
    const initialForm = {
      full_name: selectedParticipant.contact?.full_name || '',
      phone_e164: selectedParticipant.phone_e164 || '',
      tags: selectedParticipant.contact?.tags || [],
      DOB: selectedParticipant.contact?.DOB || '',
      total_spend: selectedParticipant.contact?.total_spend || 0,
    };
    setEditForm(initialForm);
    setInitialFormState(initialForm);
    setError(null);
    setSuccess(null);
    setShowEditModal(true);
  }

  async function handleClearMessages() {
    if (!selectedParticipant || !selectedParticipant.contact?.id) {
      setError('No contact selected');
      return;
    }

    if (!confirm('Are you sure you want to delete all messages for this contact? This action cannot be undone.')) {
      return;
    }

    setIsClearingMessages(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/messages/${selectedParticipant.contact.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to clear messages');
      }

      setSuccess('All messages cleared successfully!');
      setMessages([]);
      
      // Refresh conversations to update unread count
      await fetchConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear messages');
    } finally {
      setIsClearingMessages(false);
    }
  }

  async function handleSaveContact() {
    if (!selectedParticipant) return;

    setIsSavingContact(true);
    setError(null);
    setSuccess(null);

    try {
      const isExistingContact = !!selectedParticipant.contact?.id;
      
      if (isExistingContact) {
        // Build update object with only fields that changed from initial form state
        const updateData: Record<string, any> = {};
        
        const trimmedFullName = editForm.full_name.trim() || null;
        if (trimmedFullName !== (initialFormState.full_name || null)) {
          updateData.full_name = trimmedFullName;
        }
        
        const trimmedPhone = editForm.phone_e164.trim() || null;
        if (trimmedPhone !== (initialFormState.phone_e164 || null)) {
          updateData.phone_e164 = trimmedPhone;
        }
        
        // Only update tags if they've changed from initial state
        const initialTags = initialFormState.tags || [];
        const currentTags = editForm.tags || [];
        const tagsChanged = JSON.stringify(initialTags.sort()) !== JSON.stringify(currentTags.sort());
        if (tagsChanged) {
          updateData.tags = currentTags;
        }
        
        // Only update DOB if it's changed from initial state
        const trimmedDOB = editForm.DOB.trim() || null;
        const initialDOB = initialFormState.DOB || null;
        if (trimmedDOB !== initialDOB) {
          updateData.DOB = trimmedDOB;
        }
        
        // Only update total_spend if it's changed from initial state
        if (editForm.total_spend !== initialFormState.total_spend) {
          updateData.total_spend = editForm.total_spend || 0;
        }
        
        // Update existing contact
        if (!selectedParticipant.contact?.id) {
          throw new Error('Contact ID is required for update');
        }
        const response = await fetch(`/api/contacts/${selectedParticipant.contact.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update contact');
        }

        const data = await response.json();
        setSuccess('Contact updated successfully!');
        setShowEditModal(false);

        // Refresh conversations to update contact info
        await fetchConversations();

        // Update selected participant with updated contact
        setSelectedParticipant({
          ...selectedParticipant,
          contact: data.contact,
        });
      } else {
        // Create new contact
        const response = await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone_e164: editForm.phone_e164.trim() || selectedParticipant.phone_e164,
            full_name: editForm.full_name.trim() || null,
            tags: editForm.tags,
            DOB: editForm.DOB.trim() ? normalizeDOB(editForm.DOB.trim()) : null,
            total_spend: editForm.total_spend || 0,
            source: 'messages_manual_add',
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create contact');
        }

        const data = await response.json();
        setSuccess('Contact created successfully!');
        setShowEditModal(false);

        // Refresh conversations to update contact info
        await fetchConversations();

        // Update selected participant with new contact
        setSelectedParticipant({
          ...selectedParticipant,
          contact: data.contact,
          conversationKey: data.contact.id,
        });

        // Refresh messages
        await fetchMessages(data.contact.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save contact');
    } finally {
      setIsSavingContact(false);
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

  // Get display name for conversation
  function getConversationDisplayName(conv: Conversation): string {
    if (conv.contact?.full_name) {
      return conv.contact.full_name;
    }
    return formatPhoneForDisplay(conv.phone_e164) || 'Unknown';
  }

  // Get display phone for conversation
  function getConversationDisplayPhone(conv: Conversation): string {
    return formatPhoneForDisplay(conv.phone_e164) || '';
  }

  // Filter conversations based on search
  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const name = getConversationDisplayName(conv).toLowerCase();
    const phone = getConversationDisplayPhone(conv).toLowerCase();
    return name.includes(query) || phone.includes(query);
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-full mx-auto h-[calc(100vh-5rem)]">
        {/* WhatsApp Connection Alert */}
        {!isCheckingWhatsapp && whatsappStatus !== 'connected' && (
          <div className="mx-4 mt-4 mb-4">
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      <strong>WhatsApp is not connected.</strong> Please connect your WhatsApp account to send and receive messages.
                    </p>
                  </div>
                </div>
                <Link
                  href="/connect-whatsapp"
                  className="ml-4 flex-shrink-0 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-yellow-800 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                >
                  Connect WhatsApp
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="flex h-full">
          {/* Conversations List */}
          <div className="w-1/3 border-r bg-white flex flex-col">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-semibold text-gray-900">Messages</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">AI</span>
                  <button
                    onClick={toggleAi}
                    disabled={isLoadingAiStatus || isTogglingAi}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      aiEnabled ? 'bg-blue-600' : 'bg-gray-300'
                    } ${isLoadingAiStatus || isTogglingAi ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        aiEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or phone number..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 placeholder:text-gray-400"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-center text-gray-500">Loading...</div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-4 text-center text-gray-500">No conversations found</div>
              ) : (
                filteredConversations.map((conv) => {
                  const participant: ConversationParticipant = {
                    conversationKey: conv.conversationKey,
                    contact: conv.contact,
                    phone_e164: conv.phone_e164,
                  };
                  
                  return (
                    <button
                      key={conv.conversationKey}
                      onClick={() => setSelectedParticipant(participant)}
                      className={`w-full text-left p-4 border-b hover:bg-gray-50 transition-colors ${
                        selectedParticipant?.conversationKey === conv.conversationKey 
                          ? 'bg-blue-50 border-l-4 border-l-blue-600' 
                          : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900 truncate">
                              {getConversationDisplayName(conv)}
                            </p>
                            {conv.unreadCount > 0 && (
                              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-600 rounded-full">
                                {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 truncate mt-1">
                            {getConversationDisplayPhone(conv)}
                          </p>
                          {conv.latestMessage && (
                            <p className="text-xs text-gray-500 truncate mt-1">
                              {conv.latestMessage.body || 'Message'}
                            </p>
                          )}
                        </div>
                        {conv.latestMessage && (
                          <span className="text-xs text-gray-500 ml-2">
                            {formatTime(conv.latestMessage.created_at)}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Message View */}
          <div className="flex-1 flex flex-col bg-gray-100">
            {selectedParticipant ? (
              <>
                {/* Participant Header */}
                <div className="bg-white border-b p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {selectedParticipant.contact?.full_name || formatPhoneForDisplay(selectedParticipant.phone_e164) || 'Unknown'}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {formatPhoneForDisplay(selectedParticipant.phone_e164)}
                      </p>
                      {!selectedParticipant.contact && (
                        <p className="text-xs text-yellow-600 mt-1">
                          ⚠️ Contact not found - add to contact list
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!selectedParticipant.contact && (
                        <button
                          onClick={() => setShowAddContactModal(true)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Add
                        </button>
                      )}
                      <button
                        onClick={handleOpenEditModal}
                        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm font-medium flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                      {selectedParticipant.contact && (
                        <button
                          onClick={handleClearMessages}
                          disabled={isClearingMessages}
                          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          {isClearingMessages ? 'Clearing...' : 'Clear Messages'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Add Contact Modal */}
                {showAddContactModal && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Add to Contact List</h3>
                      
                      {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                          <p className="text-sm text-red-800">{error}</p>
                        </div>
                      )}

                      {success && (
                        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                          <p className="text-sm text-green-800">{success}</p>
                        </div>
                      )}

                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Phone Number
                        </label>
                        <input
                          type="text"
                          value={formatPhoneForDisplay(selectedParticipant.phone_e164)}
                          disabled
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                        />
                      </div>

                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Full Name (Optional)
                        </label>
                        <input
                          type="text"
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          placeholder="Enter contact name"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-base text-gray-900 bg-white"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleAddContact();
                            }
                          }}
                        />
                      </div>

                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => {
                            setShowAddContactModal(false);
                            setContactName('');
                            setError(null);
                            setSuccess(null);
                          }}
                          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 text-sm font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleAddContact}
                          disabled={isAddingContact}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                        >
                          {isAddingContact ? 'Adding...' : 'Add Contact'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Edit Contact Modal */}
                {showEditModal && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        {selectedParticipant?.contact ? 'Edit Contact' : 'Add to Contact List'}
                      </h3>
                      
                      {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                          <p className="text-sm text-red-800">{error}</p>
                        </div>
                      )}

                      {success && (
                        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                          <p className="text-sm text-green-800">{success}</p>
                        </div>
                      )}

                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Phone Number
                        </label>
                        <input
                          type="text"
                          value={editForm.phone_e164}
                          onChange={(e) => setEditForm({ ...editForm, phone_e164: e.target.value })}
                          placeholder="+85212345678"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-base text-gray-900 bg-white"
                        />
                      </div>

                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={editForm.full_name}
                          onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                          placeholder="Enter contact name"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-base text-gray-900 bg-white"
                        />
                      </div>

                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Date of Birth (Optional)
                        </label>
                        <input
                          type="date"
                          value={editForm.DOB ? (editForm.DOB.includes('T') ? editForm.DOB.split('T')[0] : editForm.DOB) : ''}
                          onChange={(e) => setEditForm({ ...editForm, DOB: e.target.value || '' })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-base text-gray-900 bg-white"
                        />
                      </div>

                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Total Spend
                        </label>
                        <input
                          type="number"
                          value={editForm.total_spend}
                          onChange={(e) => setEditForm({ ...editForm, total_spend: parseFloat(e.target.value) || 0 })}
                          placeholder="0"
                          step="0.01"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-base text-gray-900 bg-white"
                        />
                      </div>

                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Tags (comma-separated)
                        </label>
                        <input
                          type="text"
                          value={editForm.tags.join(', ')}
                          onChange={(e) => {
                            const tags = e.target.value.split(',').map(tag => tag.trim()).filter(Boolean);
                            setEditForm({ ...editForm, tags });
                          }}
                          placeholder="tag1, tag2, tag3"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-base text-gray-900 bg-white"
                        />
                      </div>

                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => {
                            setShowEditModal(false);
                            setError(null);
                            setSuccess(null);
                          }}
                          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 text-sm font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveContact}
                          disabled={isSavingContact}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                        >
                          {isSavingContact ? 'Saving...' : selectedParticipant?.contact ? 'Update Contact' : 'Create Contact'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Messages */}
                <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map((message) => {
                    const isOutbound = message.direction === 'out' || message.direction === 'out (AI reply)';
                    const isAiReply = message.direction === 'out (AI reply)';
                    
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg px-4 py-2 ${
                            isAiReply
                              ? 'bg-green-100 text-gray-900 border border-green-300'
                              : message.direction === 'out'
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-gray-900 border border-gray-200'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {isAiReply && (
                              <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>
                                <circle cx="9.5" cy="10" r="1.5" fill="white"/>
                                <circle cx="14.5" cy="10" r="1.5" fill="white"/>
                                <path d="M9 14h6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                                <path d="M12 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                <path d="M12 20v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                              </svg>
                            )}
                            <p className="text-sm whitespace-pre-wrap flex-1">{message.body || '(No content)'}</p>
                          </div>
                          <p
                            className={`text-xs mt-1 ${
                              isAiReply 
                                ? 'text-green-700' 
                                : message.direction === 'out' 
                                ? 'text-blue-100' 
                                : 'text-gray-500'
                            }`}
                          >
                            {formatTime(message.created_at)}
                            {isOutbound && (
                              <span className="ml-1">
                                {message.status === 'delivered' ? '✓✓' : message.status === 'sent' ? '✓' : ''}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {/* Invisible element at the bottom to scroll to */}
                  <div ref={messagesEndRef} />
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
                      placeholder={selectedParticipant.contact ? "Type a message..." : "Cannot send - contact not found"}
                      className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base text-gray-900 bg-white"
                      disabled={isSending || !selectedParticipant.contact}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={isSending || !messageBody.trim() || !selectedParticipant.contact}
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
