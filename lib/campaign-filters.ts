/**
 * Campaign filter utilities for applying filters to Supabase queries
 */

import { createClient } from '@/lib/supabase/server';
import { subDays } from 'date-fns';
import { isBirthdayWithinDays } from './birthday';

export interface CampaignFilters {
  minScore?: number;
  purchaseMode?: 'any' | 'never' | 'within' | 'olderThan';
  purchaseDays?: number;
  birthdayWithinDays?: number;
  spendMin?: number;
  spendMax?: number;
  interestTypes?: string[];
  sources?: string[];
  tagsAny?: string[];
  updatedMode?: 'any' | 'within' | 'olderThan';
  updatedDays?: number;
}

/**
 * Apply filters to get contact IDs matching segment and filters
 * Returns contact IDs that match all criteria
 */
export async function applyCampaignFilters(
  segment: 'hot' | 'warm' | 'cold',
  filters: CampaignFilters
): Promise<string[]> {
  const supabase = createClient();

  // Start from scores table by segment
  let scoresQuery = supabase
    .from('scores')
    .select('contact_id, score')
    .eq('segment', segment);

  // Apply minScore filter if exists
  if (filters.minScore !== undefined && filters.minScore !== null) {
    scoresQuery = scoresQuery.gte('score', filters.minScore);
  }

  const { data: scores, error: scoresError } = await scoresQuery;

  if (scoresError || !scores || scores.length === 0) {
    return [];
  }

  const contactIds = scores.map(s => s.contact_id);

  // Fetch contacts with all needed fields
  let contactsQuery = supabase
    .from('contacts')
    .select('id, last_purchase_at, total_spend, interest_type, source, tags, DOB, updated_at, opt_in_status')
    .in('id', contactIds);

  const { data: contacts, error: contactsError } = await contactsQuery;

  if (contactsError || !contacts) {
    return [];
  }

  // Apply filters in memory (for complex filters like birthday)
  let filteredContacts = contacts;

  // Apply purchase filters
  if (filters.purchaseMode && filters.purchaseMode !== 'any') {
    const now = new Date();
    
    if (filters.purchaseMode === 'never') {
      filteredContacts = filteredContacts.filter(c => !c.last_purchase_at || c.last_purchase_at.trim() === '');
    } else if (filters.purchaseMode === 'within' && filters.purchaseDays !== undefined) {
      const cutoffDate = subDays(now, filters.purchaseDays);
      filteredContacts = filteredContacts.filter(c => {
        if (!c.last_purchase_at || !c.last_purchase_at.trim()) return false;
        const purchaseDate = new Date(c.last_purchase_at);
        if (isNaN(purchaseDate.getTime())) return false; // Invalid date
        return purchaseDate >= cutoffDate;
      });
    } else if (filters.purchaseMode === 'olderThan' && filters.purchaseDays !== undefined) {
      const cutoffDate = subDays(now, filters.purchaseDays);
      filteredContacts = filteredContacts.filter(c => {
        if (!c.last_purchase_at || !c.last_purchase_at.trim()) return true; // Never purchased counts as older
        const purchaseDate = new Date(c.last_purchase_at);
        if (isNaN(purchaseDate.getTime())) return true; // Invalid date counts as older
        return purchaseDate < cutoffDate;
      });
    }
  }

  // Apply birthday filter
  if (filters.birthdayWithinDays !== undefined) {
    filteredContacts = filteredContacts.filter(c => {
      return isBirthdayWithinDays(c.DOB, filters.birthdayWithinDays!);
    });
  }

  // Apply spend range
  if (filters.spendMin !== undefined) {
    filteredContacts = filteredContacts.filter(c => {
      const spend = Number(c.total_spend) || 0;
      return spend >= filters.spendMin!;
    });
  }
  if (filters.spendMax !== undefined) {
    filteredContacts = filteredContacts.filter(c => {
      const spend = Number(c.total_spend) || 0;
      return spend <= filters.spendMax!;
    });
  }

  // Apply interest types
  if (filters.interestTypes && filters.interestTypes.length > 0) {
    filteredContacts = filteredContacts.filter(c => {
      if (!c.interest_type) return filters.interestTypes!.includes('unknown');
      const normalized = c.interest_type.toLowerCase();
      return filters.interestTypes!.some(type => {
        const normalizedType = type.toLowerCase();
        if (normalizedType === 'fashion/other') {
          return normalized === 'fashion' || normalized === 'other';
        }
        return normalized === normalizedType;
      });
    });
  }

  // Apply sources
  if (filters.sources && filters.sources.length > 0) {
    filteredContacts = filteredContacts.filter(c => {
      return c.source && filters.sources!.includes(c.source);
    });
  }

  // Apply tags (overlaps)
  if (filters.tagsAny && filters.tagsAny.length > 0) {
    filteredContacts = filteredContacts.filter(c => {
      if (!c.tags || c.tags.length === 0) return false;
      return filters.tagsAny!.some(tag => c.tags.includes(tag));
    });
  }

  // Apply updated_at recency filters
  if (filters.updatedMode && filters.updatedMode !== 'any') {
    const now = new Date();
    
    if (filters.updatedMode === 'within' && filters.updatedDays !== undefined) {
      const cutoffDate = subDays(now, filters.updatedDays);
      filteredContacts = filteredContacts.filter(c => {
        if (!c.updated_at) return false;
        return new Date(c.updated_at) >= cutoffDate;
      });
    } else if (filters.updatedMode === 'olderThan' && filters.updatedDays !== undefined) {
      const cutoffDate = subDays(now, filters.updatedDays);
      filteredContacts = filteredContacts.filter(c => {
        if (!c.updated_at) return true;
        return new Date(c.updated_at) < cutoffDate;
      });
    }
  }

  // Exclude recent buyers from Hot campaigns (60 days)
  // Only apply this if purchaseMode is 'any' (not explicitly filtered)
  if (segment === 'hot' && (!filters.purchaseMode || filters.purchaseMode === 'any')) {
    const sixtyDaysAgo = subDays(new Date(), 60);
    filteredContacts = filteredContacts.filter(c => {
      if (!c.last_purchase_at || !c.last_purchase_at.trim()) return true;
      const purchaseDate = new Date(c.last_purchase_at);
      if (isNaN(purchaseDate.getTime())) return true; // Invalid date, allow through
      return purchaseDate < sixtyDaysAgo;
    });
  }

  // Opt-in requirement removed - all contacts are treated as opted-in
  // filteredContacts = filteredContacts.filter(c => c.opt_in_status === true);

  return filteredContacts.map(c => c.id);
}

/**
 * Get counts for segment and filters
 */
export async function getCampaignCounts(
  segment: 'hot' | 'warm' | 'cold',
  filters: CampaignFilters
): Promise<{ segmentTotal: number; afterFilters: number; sendable: number }> {
  const supabase = createClient();

  // Get total contacts in segment (opted-in)
  const { data: scores } = await supabase
    .from('scores')
    .select('contact_id')
    .eq('segment', segment);

  if (!scores || scores.length === 0) {
    return { segmentTotal: 0, afterFilters: 0, sendable: 0 };
  }

  const contactIds = scores.map(s => s.contact_id);

  // Count total contacts in segment (opt-in requirement removed)
  const { count: segmentTotal } = await supabase
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .in('id', contactIds);

  // Apply filters to get filtered contact IDs
  const filteredContactIds = await applyCampaignFilters(segment, filters);

  // Sendable count is the same as afterFilters (opt-in requirement removed)
  return {
    segmentTotal: segmentTotal || 0,
    afterFilters: filteredContactIds.length,
    sendable: filteredContactIds.length,
  };
}


