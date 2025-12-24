import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCampaignCounts } from '@/lib/campaign-filters';

const EligibleCountSchema = z.object({
  segment: z.enum(['hot', 'warm', 'cold']),
  filters: z.object({
    minScore: z.number().optional(),
    purchaseMode: z.enum(['any', 'never', 'within', 'olderThan']).optional(),
    purchaseDays: z.number().optional(),
    birthdayWithinDays: z.number().optional(),
    spendMin: z.number().optional(),
    spendMax: z.number().optional(),
    interestTypes: z.array(z.string()).optional(),
    sources: z.array(z.string()).optional(),
    tagsAny: z.array(z.string()).optional(),
    updatedMode: z.enum(['any', 'within', 'olderThan']).optional(),
    updatedDays: z.number().optional(),
  }).optional(),
});

// Support both GET (for backward compatibility) and POST (for filters)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const segment = searchParams.get('segment');

    if (!segment || !['hot', 'warm', 'cold'].includes(segment)) {
      return NextResponse.json(
        { error: 'Invalid segment' },
        { status: 400 }
      );
    }

    const counts = await getCampaignCounts(segment as 'hot' | 'warm' | 'cold', {});
    
    return NextResponse.json({ 
      count: counts.sendable,
      segmentTotal: counts.segmentTotal,
      afterFilters: counts.afterFilters,
      sendable: counts.sendable,
    });
  } catch (error) {
    console.error('Eligible count error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get eligible count' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { segment, filters = {} } = EligibleCountSchema.parse(body);

    const counts = await getCampaignCounts(segment, filters);

    return NextResponse.json({
      segmentTotal: counts.segmentTotal,
      afterFilters: counts.afterFilters,
      sendable: counts.sendable,
    });
  } catch (error) {
    console.error('Eligible count error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get eligible count' },
      { status: 500 }
    );
  }
}
