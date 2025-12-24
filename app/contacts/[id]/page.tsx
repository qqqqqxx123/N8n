'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20">
            <div className="flex items-center space-x-8">
              <Link href="/" className="text-2xl font-semibold text-gray-900">
                Ring CRM
              </Link>
              <div className="flex space-x-6">
                <Link href="/upload" className="text-gray-900 hover:text-blue-600 px-4 py-3 rounded-md text-base font-medium">
                  Upload
                </Link>
                <Link href="/contacts" className="text-blue-600 hover:text-blue-700 px-4 py-3 rounded-md text-base font-medium">
                  Contacts
                </Link>
                <Link href="/campaigns" className="text-gray-900 hover:text-blue-600 px-4 py-3 rounded-md text-base font-medium">
                  Campaigns
                </Link>
                <Link href="/settings" className="text-gray-900 hover:text-blue-600 px-4 py-3 rounded-md text-base font-medium">
                  Settings
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

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
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Contact Information</h2>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Full Name</dt>
                  <dd className="mt-1 text-sm text-gray-900">{contact.full_name || 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Phone</dt>
                  <dd className="mt-1 text-sm text-gray-900">{contact.phone_e164}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Source</dt>
                  <dd className="mt-1 text-sm text-gray-900">{contact.source || 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Interest Type</dt>
                  <dd className="mt-1 text-sm text-gray-900">{contact.interest_type || 'N/A'}</dd>
                </div>
                {contact.DOB && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Date of Birth</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {contact.DOB.includes('T') 
                        ? format(new Date(contact.DOB), 'PPP')
                        : contact.DOB}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-medium text-gray-500">Total Spend</dt>
                  <dd className="mt-1 text-sm text-gray-900">${Number(contact.total_spend).toLocaleString()}</dd>
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

              {contact.tags.length > 0 && (
                <div className="mt-4">
                  <dt className="text-sm font-medium text-gray-500 mb-2">Tags</dt>
                  <div className="flex flex-wrap gap-2">
                    {contact.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
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


