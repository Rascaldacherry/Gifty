export interface User {
  id: string;
  name: string;
  email: string;
  is_demo: boolean;
  onboarding_completed: boolean;
  external_ai_consent: boolean;
  speech_consent: boolean;
  reminders_enabled: boolean;
  weights: Record<string, number>;
  created_at: string;
}
export interface Interest {
  id?: string;
  name: string;
  weight: number;
  origin: "user" | "inferred";
  source: string;
  confirmed: boolean;
}
export interface Recipient {
  id: string;
  name: string;
  relationship_type: string;
  avatar: string;
  age: number | null;
  age_group: string;
  birthday: string | null;
  favorite_categories: string[];
  favorite_brands: string[];
  excluded_categories: string[];
  notes: string;
  data_basis: string;
  interests: Interest[];
  created_at: string;
}
export interface Product {
  id: string;
  title: string;
  description: string;
  price_rub: number;
  image_url: string;
  marketplace: string;
  product_url: string | null;
  category: string;
  availability: string;
  source: string;
  last_updated: string;
  tags: string[];
  search_url: string;
}
export interface Recommendation {
  id: string;
  product: Product;
  score: number;
  reason: string;
  breakdown: Record<string, number>;
}
export interface GiftRequest {
  id: string;
  recipient_id: string | null;
  recipient_name: string;
  budget: number;
  occasion: string;
  prompt: string;
  city: string;
  mode: "quick" | "smart";
  provider: string;
  messages: { role: "user" | "assistant"; content: string }[];
  analysis: Record<string, unknown>;
  created_at: string;
  recommendations: Recommendation[];
}
export interface Favorite {
  id: string;
  product: Product;
}
export interface GiftEvent {
  id: string;
  recipient_id: string | null;
  title: string;
  event_date: string;
  kind: string;
  recurring: boolean;
  reminder_days: number;
  next_date: string;
  days_until: number;
}
export interface Collection {
  id: string;
  title: string;
  recipient_id: string | null;
  budget: number;
  saved: boolean;
  total: number;
  created_at: string;
  items: { id: string; product: Product }[];
}
export interface Integrations {
  ai_provider: string;
  external_processing_enabled: boolean;
  ai_connected: boolean;
  speech_connected: boolean;
  speech_webm_supported: boolean;
  catalogs: Record<string, boolean>;
  social_connected: boolean;
  demo_catalog: boolean;
}
export interface GiftHistory {
  id: string;
  recipient_id: string;
  product_id: string | null;
  title: string;
  given_on: string;
  notes: string;
  created_at: string;
}
export interface SocialImport {
  id: string;
  source_label: string;
  source_url: string;
  text: string;
  created_at: string;
}
export interface Question {
  id: string;
  question: string;
  options: string[];
}
