'use client';

import { useState, useEffect, useCallback } from 'react';
import { ContactsTable } from '@/components/contacts-table';
import { SegmentTabs } from '@/components/segment-tabs';
import { Navbar } from '@/components/navbar';
import { Contact } from '@/lib/types/database';
import Link from 'next/link';
import { format } from 'date-fns';

type SortField = 'name' | 'tags' | 'total_spend' | 'score' | null;
type SortDirection = 'asc' | 'desc';

interface ContactWithScore extends Contact {
  score?: number | null;
  segment?: string | null;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<ContactWithScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSegment, setActiveSegment] = useState<'hot' | 'warm' | 'cold' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [sources, setSources] = useState<string[]>([]);
  const [isComputing, setIsComputing] = useState(false);
  const [lastComputedAt, setLastComputedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const fetchContacts = useCallback(async () => {
    setIsLoading(true);
    try {
      let url = '/api/contacts?';
      if (activeSegment !== 'all') {
        url += `segment=${activeSegment}&`;
      }
      if (searchQuery) {
        url += `search=${encodeURIComponent(searchQuery)}&`;
      }
      if (sourceFilter) {
        url += `source=${encodeURIComponent(sourceFilter)}&`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch contacts');
      }

      const data = await response.json();
      setContacts(data.contacts || []);
      setSources(data.sources || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activeSegment, searchQuery, sourceFilter]);

  const fetchLastComputedTime = useCallback(async () => {
    try {
      const response = await fetch('/api/scoring/last-computed');
      if (response.ok) {
        const data = await response.json();
        setLastComputedAt(data.last_computed_at);
      }
    } catch (error) {
      console.error('Error fetching last computed time:', error);
    }
  }, []);

  const handleComputeAllScores = useCallback(async () => {
    setIsComputing(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/scoring/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // Empty body means compute for all contacts
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to compute scores');
      }

      const data = await response.json();
      setSuccess(`Successfully computed scores for ${data.scored} contacts`);
      
      // Refresh contacts and last computed time
      await fetchContacts();
      await fetchLastComputedTime();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compute scores');
    } finally {
      setIsComputing(false);
    }
  }, [fetchContacts, fetchLastComputedTime]);

  useEffect(() => {
    fetchContacts();
    fetchLastComputedTime();
  }, [fetchContacts, fetchLastComputedTime]);

  // Auto-dismiss success/error messages after 5 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  // Sort contacts
  const sortedContacts = [...contacts].sort((a, b) => {
    if (!sortField) return 0;

    let comparison = 0;

    switch (sortField) {
      case 'name':
        const nameA = (a.full_name || '').toLowerCase();
        const nameB = (b.full_name || '').toLowerCase();
        comparison = nameA.localeCompare(nameB);
        break;
      
      case 'tags':
        const tagsA = (a.tags || []).join(',').toLowerCase();
        const tagsB = (b.tags || []).join(',').toLowerCase();
        comparison = tagsA.localeCompare(tagsB);
        break;
      
      case 'total_spend':
        comparison = Number(a.total_spend || 0) - Number(b.total_spend || 0);
        break;
      
      case 'score':
        comparison = (a.score ?? 0) - (b.score ?? 0);
        break;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  function handleSort(field: SortField) {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, start with ascending
      setSortField(field);
      setSortDirection('asc');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Contacts</h2>
              <div className="flex flex-col items-end gap-2">
                <button
                  onClick={handleComputeAllScores}
                  disabled={isComputing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {isComputing ? 'Computing...' : 'Compute All Scores'}
                </button>
                {lastComputedAt && (
                  <span className="text-xs text-gray-500">
                    Last computed: {format(new Date(lastComputedAt), 'PPp')}
                  </span>
                )}
              </div>
            </div>

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
            
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <input
                type="text"
                placeholder="Search by name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-base text-gray-900 bg-white"
              />
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-base text-gray-900 bg-white"
              >
                <option value="">All Sources</option>
                {sources.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </div>

            <SegmentTabs activeSegment={activeSegment} onSegmentChange={setActiveSegment} />
          </div>

          <div className="p-6">
            <ContactsTable 
              contacts={sortedContacts} 
              isLoading={isLoading}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
          </div>
        </div>
      </main>
    </div>
  );
}


