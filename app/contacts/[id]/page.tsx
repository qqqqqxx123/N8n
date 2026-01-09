'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import { Contact, Event, Message, Score } from '@/lib/types/database';
import { format, isValid } from 'date-fns';

export default function ContactDetailPage() {
  const params = useParams();
  const contactId = params.id as string;

  const [contact, setContact] = useState<Contact | null>(null);
  const [score, setScore] = useState<Score | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecomputing, setIsRecomputing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone_e164: '',
    tags: [] as string[],
    total_spend: 0,
    DOB: '',
  });

  const fetchContactData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [contactRes, scoreRes, eventsRes, messagesRes] = await Promise.all([
        fetch(`/api/contacts/${contactId}`),
        fetch(`/api/contacts/${contactId}/score`),
        fetch(`/api/contacts/${contactId}/events`),
        fetch(`/api/contacts/${contactId}/messages`),
      ]);

      if (!contactRes.ok) {
        throw new Error('Failed to fetch contact');
      }

      const contactData = await contactRes.json();
      setContact(contactData.contact);
      // Initialize edit form with contact data
      setEditForm({
        full_name: contactData.contact.full_name || '',
        phone_e164: contactData.contact.phone_e164 || '',
        tags: contactData.contact.tags || [],
        total_spend: Number(contactData.contact.total_spend) || 0,
        DOB: contactData.contact.DOB || '',
      });

      if (scoreRes.ok) {
        const scoreData = await scoreRes.json();
        setScore(scoreData.score);
      }

      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setEvents(eventsData.events || []);
      }

      if (messagesRes.ok) {
        const messagesData = await messagesRes.json();
        setMessages(messagesData.messages || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contact');
    } finally {
      setIsLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    fetchContactData();
  }, [fetchContactData]);

  async function handleRecomputeScore() {
    setIsRecomputing(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/scoring/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_ids: [contactId] }),
      });

      if (!response.ok) {
        throw new Error('Failed to recompute score');
      }

      setSuccess('Score recomputed successfully');
      // Refresh score
      const scoreRes = await fetch(`/api/contacts/${contactId}/score`);
      if (scoreRes.ok) {
        const scoreData = await scoreRes.json();
        setScore(scoreData.score);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to recompute score');
    } finally {
      setIsRecomputing(false);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: editForm.full_name,
          phone_e164: editForm.phone_e164,
          tags: editForm.tags,
          total_spend: editForm.total_spend,
          DOB: editForm.DOB || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update contact');
      }

      const data = await response.json();
      setContact(data.contact);
      setIsEditing(false);
      setSuccess('Contact updated successfully');
      
      // Refresh contact data
      await fetchContactData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update contact');
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    if (contact) {
      setEditForm({
        full_name: contact.full_name || '',
        phone_e164: contact.phone_e164 || '',
        tags: contact.tags || [],
        total_spend: Number(contact.total_spend) || 0,
        DOB: contact.DOB || '',
      });
    }
    setIsEditing(false);
  }

  function handleTagChange(tagIndex: number, value: string) {
    const newTags = [...editForm.tags];
    newTags[tagIndex] = value;
    setEditForm({ ...editForm, tags: newTags });
  }

  function handleAddTag() {
    setEditForm({ ...editForm, tags: [...editForm.tags, ''] });
  }

  function handleRemoveTag(index: number) {
    const newTags = editForm.tags.filter((_, i) => i !== index);
    setEditForm({ ...editForm, tags: newTags });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading contact...</p>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Contact not found</p>
      </div>
    );
  }

  // Combine events and messages for timeline
  const timelineItems = [
    ...events.map(e => ({ type: 'event' as const, data: e, date: e.created_at })),
    ...messages.map(m => ({ type: 'message' as const, data: m, date: m.created_at })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-4">
          <Link href="/contacts" className="text-blue-600 hover:text-blue-900">
            ← Back to Contacts
          </Link>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Contact Information</h2>
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                  >
                    Edit
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleCancel}
                      className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 text-sm font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Full Name</dt>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.full_name}
                      onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm text-gray-900 bg-white"
                    />
                  ) : (
                    <dd className="mt-1 text-sm text-gray-900">{contact.full_name || 'N/A'}</dd>
                  )}
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Phone</dt>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.phone_e164}
                      onChange={(e) => setEditForm({ ...editForm, phone_e164: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm text-gray-900 bg-white"
                    />
                  ) : (
                    <dd className="mt-1 text-sm text-gray-900">{contact.phone_e164}</dd>
                  )}
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Source</dt>
                  <dd className="mt-1 text-sm text-gray-900">{contact.source || 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Interest Type</dt>
                  <dd className="mt-1 text-sm text-gray-900">{contact.interest_type || 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Date of Birth</dt>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editForm.DOB ? (editForm.DOB.includes('T') ? editForm.DOB.split('T')[0] : editForm.DOB) : ''}
                      onChange={(e) => setEditForm({ ...editForm, DOB: e.target.value || '' })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm text-gray-900 bg-white"
                    />
                  ) : (
                    <dd className="mt-1 text-sm text-gray-900">
                      {contact.DOB 
                        ? (contact.DOB.includes('T') 
                          ? contact.DOB.split('T')[0]
                          : contact.DOB)
                        : 'N/A'}
                    </dd>
                  )}
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Total Spend</dt>
                  {isEditing ? (
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.total_spend}
                      onChange={(e) => setEditForm({ ...editForm, total_spend: parseFloat(e.target.value) || 0 })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm text-gray-900 bg-white"
                    />
                  ) : (
                    <dd className="mt-1 text-sm text-gray-900">${Number(contact.total_spend).toLocaleString()}</dd>
                  )}
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Last Purchase</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {contact.last_purchase_at ? (() => {
                      const date = new Date(contact.last_purchase_at);
                      return isValid(date) 
                        ? format(date, 'PPp') 
                        : contact.last_purchase_at; // Display as-is if not a valid date
                    })() : 'N/A'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Opt-In Status</dt>
                  <dd className="mt-1">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        contact.opt_in_status
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {contact.opt_in_status ? 'Opted In' : 'Opted Out'}
                    </span>
                  </dd>
                </div>
                {contact.opt_in_timestamp && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Opt-In Date</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {format(new Date(contact.opt_in_timestamp), 'PPp')}
                    </dd>
                  </div>
                )}
              </dl>

              <div className="mt-4">
                <dt className="text-sm font-medium text-gray-500 mb-2">Tags</dt>
                {isEditing ? (
                  <div className="space-y-2">
                    {editForm.tags.map((tag, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={tag}
                          onChange={(e) => handleTagChange(index, e.target.value)}
                          className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm text-gray-900 bg-white"
                          placeholder="Tag name"
                        />
                        <button
                          onClick={() => handleRemoveTag(index)}
                          className="px-3 py-1 bg-red-100 text-red-800 rounded-md hover:bg-red-200 text-sm font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={handleAddTag}
                      className="px-3 py-1 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 text-sm font-medium"
                    >
                      + Add Tag
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {contact.tags && contact.tags.length > 0 ? (
                      contact.tags.map((tag) => {
                        const tagLower = tag.toLowerCase();
                        let tagClasses = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ';
                        
                        if (tagLower === 'vip') {
                          tagClasses += 'bg-yellow-100 text-yellow-800';
                        } else if (tagLower === 'regular') {
                          tagClasses += 'bg-blue-100 text-blue-800';
                        } else if (tagLower === 'new') {
                          tagClasses += 'bg-red-100 text-red-800';
                        } else {
                          tagClasses += 'bg-blue-100 text-blue-800';
                        }
                        
                        return (
                          <span key={tag} className={tagClasses}>
                            {tag}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-sm text-gray-500">No tags</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Timeline</h2>
              <div className="space-y-4">
                {timelineItems.length === 0 ? (
                  <p className="text-gray-500 text-sm">No timeline events</p>
                ) : (
                  timelineItems.map((item, index) => (
                    <div key={index} className="border-l-2 border-gray-200 pl-4 pb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {item.type === 'event' ? item.data.type : `${item.data.direction} message`}
                          </p>
                          {item.type === 'message' && (
                            <p className="text-xs text-gray-500">
                              Status: {item.data.status} {item.data.template_name && `• Template: ${item.data.template_name}`}
                            </p>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          {format(new Date(item.date), 'PPp')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Lead Score</h3>
              {score ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Score</span>
                      <span className="text-2xl font-bold text-gray-900">{score.score}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          score.segment === 'hot'
                            ? 'bg-red-500'
                            : score.segment === 'warm'
                            ? 'bg-yellow-500'
                            : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min(100, (score.score / 100) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Segment</span>
                    <span
                      className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        score.segment === 'hot'
                          ? 'bg-red-100 text-red-800'
                          : score.segment === 'warm'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {score.segment.toUpperCase()}
                    </span>
                  </div>
                  {score.reasons && score.reasons.length > 0 && (
                    <div>
                      <span className="text-sm text-gray-600 block mb-2">Score Reasons</span>
                      <ul className="list-disc list-inside space-y-1">
                        {score.reasons.map((reason, index) => (
                          <li key={index} className="text-xs text-gray-700">
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="text-xs text-gray-500">
                    Last computed: {format(new Date(score.computed_at), 'PPp')}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No score computed yet</p>
              )}
              <button
                onClick={handleRecomputeScore}
                disabled={isRecomputing}
                className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRecomputing ? 'Recomputing...' : 'Recompute Score'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}


