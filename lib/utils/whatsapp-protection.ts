/**
 * WhatsApp Account Protection Utilities
 * Prevents Meta from banning the WhatsApp account by enforcing:
 * - Rate limits (daily/hourly quotas)
 * - 24-hour window compliance
 * - Per-contact frequency limits
 * - Message spacing/delays
 * - Error handling and backoff
 */

import { createClient } from '@/lib/supabase/server';
import { subHours, subDays } from 'date-fns';

export interface ProtectionConfig {
  // Daily limits
  maxMessagesPerDay: number; // Default: 1000 for new accounts, 10000+ for verified
  maxMessagesPerHour: number; // Default: 100
  
  // Per-contact limits
  minHoursBetweenMessages: number; // Minimum hours between messages to same contact
  maxMessagesPerContactPerDay: number; // Max messages to same contact per day
  
  // Message spacing
  minDelayBetweenMessages: number; // Minimum milliseconds between messages
  
  // 24-hour window
  enforce24HourWindow: boolean; // Enforce Meta's 24-hour messaging window
}

export const DEFAULT_PROTECTION_CONFIG: ProtectionConfig = {
  maxMessagesPerDay: 1000, // Conservative limit for new accounts
  maxMessagesPerHour: 100,
  minHoursBetweenMessages: 0, // No minimum delay between messages to same contact (disabled)
  maxMessagesPerContactPerDay: 999999, // Effectively unlimited messages per contact per day (disabled)
  minDelayBetweenMessages: 2000, // 2 seconds between messages (60 messages/min max)
  enforce24HourWindow: false, // Disabled - can send messages anytime
};

/**
 * Check if we can send a message today (daily quota)
 */
export async function checkDailyQuota(config: ProtectionConfig = DEFAULT_PROTECTION_CONFIG): Promise<{
  allowed: boolean;
  sentToday: number;
  remaining: number;
  resetAt: Date;
}> {
  const supabase = createClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Count messages sent today
  const { count: sentToday, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('direction', 'out')
    .gte('created_at', today.toISOString())
    .lt('created_at', tomorrow.toISOString());

  if (error) {
    console.error('Error checking daily quota:', error);
    // Fail open - allow sending if we can't check
    return {
      allowed: true,
      sentToday: 0,
      remaining: config.maxMessagesPerDay,
      resetAt: tomorrow,
    };
  }

  const remaining = config.maxMessagesPerDay - (sentToday || 0);
  const allowed = remaining > 0;

  return {
    allowed,
    sentToday: sentToday || 0,
    remaining: Math.max(0, remaining),
    resetAt: tomorrow,
  };
}

/**
 * Check if we can send a message this hour (hourly quota)
 */
export async function checkHourlyQuota(config: ProtectionConfig = DEFAULT_PROTECTION_CONFIG): Promise<{
  allowed: boolean;
  sentThisHour: number;
  remaining: number;
  resetAt: Date;
}> {
  const supabase = createClient();
  const now = new Date();
  const hourStart = new Date(now);
  hourStart.setMinutes(0, 0, 0);
  const hourEnd = new Date(hourStart);
  hourEnd.setHours(hourEnd.getHours() + 1);

  // Count messages sent this hour
  const { count: sentThisHour, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('direction', 'out')
    .gte('created_at', hourStart.toISOString())
    .lt('created_at', hourEnd.toISOString());

  if (error) {
    console.error('Error checking hourly quota:', error);
    return {
      allowed: true,
      sentThisHour: 0,
      remaining: config.maxMessagesPerHour,
      resetAt: hourEnd,
    };
  }

  const remaining = config.maxMessagesPerHour - (sentThisHour || 0);
  const allowed = remaining > 0;

  return {
    allowed,
    sentThisHour: sentThisHour || 0,
    remaining: Math.max(0, remaining),
    resetAt: hourEnd,
  };
}

/**
 * Check if we can send to a specific contact (frequency limits)
 */
export async function checkContactFrequency(
  contactId: string,
  config: ProtectionConfig = DEFAULT_PROTECTION_CONFIG
): Promise<{
  allowed: boolean;
  lastMessageAt: Date | null;
  hoursSinceLastMessage: number | null;
  messagesToday: number;
  reason?: string;
}> {
  const supabase = createClient();
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // Get last message to this contact
  const { data: lastMessage, error: lastMessageError } = await supabase
    .from('messages')
    .select('created_at')
    .eq('contact_id', contactId)
    .eq('direction', 'out')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Count messages to this contact today
  const { count: messagesToday, error: countError } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('contact_id', contactId)
    .eq('direction', 'out')
    .gte('created_at', today.toISOString());

  if (lastMessageError || countError) {
    console.error('Error checking contact frequency:', lastMessageError || countError);
    // Fail open
    return {
      allowed: true,
      lastMessageAt: null,
      hoursSinceLastMessage: null,
      messagesToday: 0,
    };
  }

  const lastMessageAt = lastMessage ? new Date(lastMessage.created_at) : null;
  const hoursSinceLastMessage = lastMessageAt
    ? (now.getTime() - lastMessageAt.getTime()) / (1000 * 60 * 60)
    : null;

  // Check per-contact daily limit (only if limit is set and not effectively unlimited)
  if (config.maxMessagesPerContactPerDay < 999999 && (messagesToday || 0) >= config.maxMessagesPerContactPerDay) {
    return {
      allowed: false,
      lastMessageAt,
      hoursSinceLastMessage,
      messagesToday: messagesToday || 0,
      reason: `Maximum ${config.maxMessagesPerContactPerDay} messages per contact per day exceeded`,
    };
  }

  // Check minimum hours between messages (only if limit is set and greater than 0)
  if (config.minHoursBetweenMessages > 0 && lastMessageAt && hoursSinceLastMessage !== null && hoursSinceLastMessage < config.minHoursBetweenMessages) {
    return {
      allowed: false,
      lastMessageAt,
      hoursSinceLastMessage,
      messagesToday: messagesToday || 0,
      reason: `Minimum ${config.minHoursBetweenMessages} hours between messages not met (${hoursSinceLastMessage.toFixed(1)} hours since last message)`,
    };
  }

  return {
    allowed: true,
    lastMessageAt,
    hoursSinceLastMessage,
    messagesToday: messagesToday || 0,
  };
}

/**
 * Check 24-hour window compliance (Meta requirement)
 * Can only send template messages outside 24-hour window
 */
export async function check24HourWindow(contactId: string): Promise<{
  inWindow: boolean;
  lastInboundAt: Date | null;
  hoursSinceInbound: number | null;
  canSendTemplate: boolean;
  canSendFreeForm: boolean;
}> {
  const supabase = createClient();
  const twentyFourHoursAgo = subHours(new Date(), 24);

  // Check for inbound messages in last 24 hours
  const { data: recentInbound, error } = await supabase
    .from('messages')
    .select('created_at')
    .eq('contact_id', contactId)
    .eq('direction', 'in')
    .gte('created_at', twentyFourHoursAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error checking 24-hour window:', error);
    // Fail open - assume we can send
    return {
      inWindow: false,
      lastInboundAt: null,
      hoursSinceInbound: null,
      canSendTemplate: true,
      canSendFreeForm: true,
    };
  }

  const inWindow = !!recentInbound;
  const lastInboundAt = recentInbound ? new Date(recentInbound.created_at) : null;
  const hoursSinceInbound = lastInboundAt
    ? (new Date().getTime() - lastInboundAt.getTime()) / (1000 * 60 * 60)
    : null;

  // Meta rules:
  // - Outside 24h window: Can send template messages only
  // - Inside 24h window: Can send free-form messages (no template needed)
  return {
    inWindow,
    lastInboundAt,
    hoursSinceInbound,
    canSendTemplate: true, // Templates always allowed
    canSendFreeForm: inWindow, // Free-form only in 24h window
  };
}

/**
 * Comprehensive check before sending a message
 */
export async function canSendMessage(
  contactId: string,
  isTemplate: boolean = true,
  config: ProtectionConfig = DEFAULT_PROTECTION_CONFIG
): Promise<{
  allowed: boolean;
  reasons: string[];
  dailyQuota: Awaited<ReturnType<typeof checkDailyQuota>>;
  hourlyQuota: Awaited<ReturnType<typeof checkHourlyQuota>>;
  contactFrequency: Awaited<ReturnType<typeof checkContactFrequency>>;
  window24h: Awaited<ReturnType<typeof check24HourWindow>>;
}> {
  const reasons: string[] = [];

  // Check daily quota
  const dailyQuota = await checkDailyQuota(config);
  if (!dailyQuota.allowed) {
    reasons.push(`Daily quota exceeded (${dailyQuota.sentToday}/${config.maxMessagesPerDay})`);
  }

  // Check hourly quota
  const hourlyQuota = await checkHourlyQuota(config);
  if (!hourlyQuota.allowed) {
    reasons.push(`Hourly quota exceeded (${hourlyQuota.sentThisHour}/${config.maxMessagesPerHour})`);
  }

  // Check contact frequency
  const contactFrequency = await checkContactFrequency(contactId, config);
  if (!contactFrequency.allowed) {
    reasons.push(contactFrequency.reason || 'Contact frequency limit exceeded');
  }

  // Check 24-hour window (only if enforcement is enabled)
  const window24h = await check24HourWindow(contactId);
  if (config.enforce24HourWindow && !isTemplate && !window24h.canSendFreeForm) {
    reasons.push('Free-form messages only allowed within 24-hour window');
  }

  const allowed = reasons.length === 0;

  return {
    allowed,
    reasons,
    dailyQuota,
    hourlyQuota,
    contactFrequency,
    window24h,
  };
}

/**
 * Calculate delay needed before sending next message
 */
export function calculateMessageDelay(
  lastMessageSentAt: Date | null,
  config: ProtectionConfig = DEFAULT_PROTECTION_CONFIG
): number {
  if (!lastMessageSentAt) {
    return config.minDelayBetweenMessages;
  }

  const now = Date.now();
  const timeSinceLastMessage = now - lastMessageSentAt.getTime();
  const requiredDelay = config.minDelayBetweenMessages;

  if (timeSinceLastMessage >= requiredDelay) {
    return 0; // No delay needed
  }

  return requiredDelay - timeSinceLastMessage;
}

/**
 * Handle Meta API errors and determine if we should back off
 */
export function handleMetaError(error: any): {
  shouldBackoff: boolean;
  backoffSeconds: number;
  isRateLimit: boolean;
  isBanWarning: boolean;
  message: string;
} {
  const errorMessage = error?.message || String(error);
  const errorCode = error?.code || error?.error?.code;
  const statusCode = error?.status || error?.response?.status;

  // Rate limit errors (429)
  if (statusCode === 429 || errorCode === 'RATE_LIMIT' || errorMessage.includes('rate limit')) {
    return {
      shouldBackoff: true,
      backoffSeconds: 60, // Back off for 1 minute on rate limit
      isRateLimit: true,
      isBanWarning: false,
      message: 'Rate limit exceeded - backing off',
    };
  }

  // Ban warnings
  if (
    errorCode === 'ACCOUNT_BANNED' ||
    errorCode === 'ACCOUNT_RESTRICTED' ||
    errorMessage.includes('banned') ||
    errorMessage.includes('restricted') ||
    errorMessage.includes('suspended')
  ) {
    return {
      shouldBackoff: true,
      backoffSeconds: 3600, // Back off for 1 hour on ban warning
      isRateLimit: false,
      isBanWarning: true,
      message: 'Account ban warning - immediate backoff required',
    };
  }

  // Template errors (400)
  if (statusCode === 400 && (errorMessage.includes('template') || errorCode === 'INVALID_TEMPLATE')) {
    return {
      shouldBackoff: false,
      backoffSeconds: 0,
      isRateLimit: false,
      isBanWarning: false,
      message: 'Template validation error',
    };
  }

  // Other errors - moderate backoff
  if (statusCode >= 500) {
    return {
      shouldBackoff: true,
      backoffSeconds: 30,
      isRateLimit: false,
      isBanWarning: false,
      message: 'Server error - backing off',
    };
  }

  return {
    shouldBackoff: false,
    backoffSeconds: 0,
    isRateLimit: false,
    isBanWarning: false,
    message: 'Unknown error',
  };
}

