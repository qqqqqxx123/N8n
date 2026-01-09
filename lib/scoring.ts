type Segment = "hot" | "warm" | "cold";

export interface ContactForScoring {
  tags?: string[] | null;
  updated_at?: string | null;
  interest_type?: string | null;
  total_spend?: number | string | null;
  source?: string | null;
  last_purchase_at?: string | null;
}

export interface ScoreResult {
  score: number;
  segment: Segment;
  reasons: string[];
}

export function computeScore(c: ContactForScoring): ScoreResult {
  const tags: string[] = c.tags ?? [];

  const now = new Date();

  let score = 0;

  const reasons: string[] = [];

  // Recent interaction (tags first, else updated_at)
  if (tags.includes("inquiry_7d") || tags.includes("visited_7d")) {
    score += 35;
    reasons.push("Recent inquiry/visit (7d)");
  } else if (tags.includes("inquiry_30d") || tags.includes("visited_30d")) {
    score += 20;
    reasons.push("Recent inquiry/visit (30d)");
  } else if (c.updated_at) {
    const updatedAt = new Date(c.updated_at);
    // Validate the date is valid before using it
    if (!isNaN(updatedAt.getTime())) {
      const days = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);

      if (days <= 7) {
        score += 25;
        reasons.push("Recently updated (7d)");
      } else if (days <= 30) {
        score += 12;
        reasons.push("Recently updated (30d)");
      }
    }
  }

  // Interest type
  const interest = (c.interest_type || "").toLowerCase();
  if (interest === "engagement") {
    score += 25;
    reasons.push("Engagement interest");
  } else if (interest === "wedding") {
    score += 20;
    reasons.push("Wedding interest");
  } else if (interest) {
    score += 10;
    reasons.push("Other ring interest");
  }

  // Last purchase date (recency matters)
  if (c.last_purchase_at) {
    const lastPurchase = new Date(c.last_purchase_at);
    if (!isNaN(lastPurchase.getTime())) {
      const daysSincePurchase = (now.getTime() - lastPurchase.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSincePurchase <= 30) {
        score += 15;
        reasons.push("Recent purchase (30d)");
      } else if (daysSincePurchase <= 90) {
        score += 10;
        reasons.push("Recent purchase (90d)");
      } else if (daysSincePurchase <= 180) {
        score += 5;
        reasons.push("Recent purchase (180d)");
      }
    }
  }

  // Spend tier (more granular tiers)
  const spend = typeof c.total_spend === 'number' 
    ? c.total_spend 
    : Number(c.total_spend) || 0;
  if (!isNaN(spend)) {
    if (spend >= 20000) {
      score += 25;
      reasons.push("Very high spend >= 20k");
    } else if (spend >= 10000) {
      score += 20;
      reasons.push("High spend >= 10k");
    } else if (spend >= 7500) {
      score += 15;
      reasons.push("Mid-high spend 7.5k-10k");
    } else if (spend >= 5000) {
      score += 12;
      reasons.push("Mid spend 5k-7.5k");
    } else if (spend >= 2500) {
      score += 8;
      reasons.push("Low-mid spend 2.5k-5k");
    } else if (spend > 0) {
      score += 6;
      reasons.push("Low spend > 0");
    }
  }

  // Source
  const source = (c.source || "").toLowerCase();
  if (["referral", "vip", "repeat"].includes(source)) {
    score += 10;
    reasons.push("High-intent source");
  } else if (["website", "instagram", "walkin"].includes(source)) {
    score += 5;
    reasons.push("Normal-intent source");
  }

  // High intent tags
  if (tags.includes("ring_size_known")) {
    score += 10;
    reasons.push("Ring size known");
  }

  if (tags.includes("requested_catalog") || tags.includes("followed_up")) {
    score += 8;
    reasons.push("Requested catalog / follow-up");
  }

  if (tags.includes("appointment_booked")) {
    score += 12;
    reasons.push("Appointment booked");
  }

  let segment: Segment = "cold";

  if (score >= 60) segment = "hot";
  else if (score >= 35) segment = "warm";

  return { score, segment, reasons };
}



