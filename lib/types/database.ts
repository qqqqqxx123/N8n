export interface Contact {
  id: string;
  full_name: string | null;
  phone_e164: string;
  source: string | null;
  tags: string[];
  DOB: string | null; // Uppercase to match database column
  opt_in_status: boolean;
  opt_in_timestamp: string | null;
  opt_in_source: string | null;
  last_purchase_at: string | null;
  total_spend: number;
  interest_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  contact_id: string;
  type: 'csv_import' | 'purchase' | 'inquiry' | 'whatsapp_inbound' | 'whatsapp_outbound';
  meta: Record<string, any>;
  created_at: string;
}

export interface Score {
  contact_id: string;
  score: number;
  segment: 'hot' | 'warm' | 'cold';
  reasons: string[];
  computed_at: string;
}

export interface Message {
  id: string;
  contact_id: string;
  direction: 'in' | 'out';
  template_name: string | null;
  status: 'sent' | 'delivered' | 'failed' | 'read';
  provider_message_id: string | null;
  created_at: string;
}

export interface Settings {
  key: string;
  value: Record<string, any>;
  updated_at: string;
}


