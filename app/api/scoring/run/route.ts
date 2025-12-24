import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { computeScore } from '@/lib/scoring';

const ScoringRequestSchema = z.object({
  contact_ids: z.array(z.string().uuid()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contact_ids } = ScoringRequestSchema.parse(body);

    const supabase = createClient();

    // Build query for contacts to score
    let contactsQuery = supabase.from('contacts').select('*');
    if (contact_ids && contact_ids.length > 0) {
      contactsQuery = contactsQuery.in('id', contact_ids);
    }

    const { data: contacts, error: contactsError } = await contactsQuery;

    if (contactsError) {
      console.error('Error fetching contacts:', contactsError);
      return NextResponse.json(
        { error: 'Failed to fetch contacts', details: contactsError.message },
        { status: 500 }
      );
    }

    if (!contacts || contacts.length === 0) {
      return NextResponse.json(
        { error: 'No contacts found to score' },
        { status: 400 }
      );
    }

    const scoresToInsert = [];

    for (const contact of contacts) {
      try {
        // Use the new computeScore function
        const result = computeScore({
          tags: contact.tags || [],
          updated_at: contact.updated_at || null,
          interest_type: contact.interest_type || null,
          total_spend: contact.total_spend || 0,
          source: contact.source || null,
          last_purchase_at: contact.last_purchase_at || null,
        });

        scoresToInsert.push({
          contact_id: contact.id,
          score: result.score,
          segment: result.segment,
          reasons: result.reasons,
          computed_at: new Date().toISOString(),
        });
      } catch (contactError) {
        console.error(`Error computing score for contact ${contact.id}:`, contactError);
        // Continue with other contacts even if one fails
        continue;
      }
    }

    // Upsert scores
    if (scoresToInsert.length > 0) {
      // Try to upsert with reasons first
      let scoresToInsertWithReasons = scoresToInsert.map(({ reasons, ...rest }) => ({
        ...rest,
        ...(reasons && reasons.length > 0 ? { reasons } : {}),
      }));

      let { error: scoresError } = await supabase
        .from('scores')
        .upsert(scoresToInsertWithReasons, {
          onConflict: 'contact_id',
        });

      // If the error is about missing 'reasons' column, retry without it
      if (scoresError && scoresError.message?.includes("Could not find the 'reasons' column")) {
        console.warn('reasons column not found, saving scores without reasons');
        const scoresWithoutReasons = scoresToInsert.map(({ reasons, ...rest }) => rest);
        const { error: retryError } = await supabase
          .from('scores')
          .upsert(scoresWithoutReasons, {
            onConflict: 'contact_id',
          });
        
        if (retryError) {
          console.error('Error saving scores (without reasons):', retryError);
          return NextResponse.json(
            { error: 'Failed to save scores', details: retryError.message },
            { status: 500 }
          );
        }
      } else if (scoresError) {
        console.error('Error saving scores:', scoresError);
        return NextResponse.json(
          { error: 'Failed to save scores', details: scoresError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      scored: scoresToInsert.length,
      scores: scoresToInsert,
    });
  } catch (error) {
    console.error('Scoring error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to compute scores',
        details: error instanceof Error ? error.stack : String(error)
      },
      { status: 500 }
    );
  }
}


