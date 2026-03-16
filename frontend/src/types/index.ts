// User & Authentication Types
export interface User {
  id: number;
  email: string;
  phone_number?: string;
  first_name?: string;
  last_name?: string;
  country?: string;
  created_at: string;
}

export interface AuthToken {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  expires_in: number;
}

export interface License {
  license_key: string;
  device_id: string;
  tier: 'FREE' | 'BASIC' | 'STANDARD' | 'PREMIUM';
  expires_at: string;
  signature: string;
  is_valid: boolean;
}

// Subscription & Pricing
export interface Subscription {
  user_id: number;
  tier: 'FREE' | 'BASIC' | 'STANDARD' | 'PREMIUM';
  status: 'active' | 'inactive' | 'cancelled' | 'expired';
  next_billing_date?: string;
  auto_renew: boolean;
}

export interface PricingTier {
  name: string;
  tier: 'FREE' | 'BASIC' | 'STANDARD' | 'PREMIUM';
  messages_per_day: number;
  price_inr: number;
  price_usd: number;
  features: string[];
}

// Messages & Conversations
export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  synced: boolean;
  tokens_used?: number;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

// Usage & Limits
export interface DailyUsage {
  date: string;
  messages_used: number;
  messages_limit: number;
  messages_remaining: number;
  tier: string;
}

export interface MessageCheckResponse {
  can_send_message: boolean;
  messages_remaining: number;
  messages_limit: number;
  tier: string;
  reset_time: string;
}

// Payment
export interface PaymentPlan {
  tier: 'BASIC' | 'STANDARD' | 'PREMIUM';
  amount: number;
  currency: 'INR' | 'USD';
  billing_cycle: 'monthly' | 'annual';
}

// Local Storage Types
export interface UserSession {
  user_id: number;
  email: string;
  jwt_token: string;
  refresh_token: string;
  subscription_tier: string;
  device_id: string;
  license_key: string;
  last_synced_at: string;
}

export interface SyncQueue {
  id: string;
  action: 'create_message' | 'update_profile' | 'consume_message';
  payload: any;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  created_at: string;
  synced_at?: string;
}

// API Responses
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ErrorResponse {
  error: string;
  detail?: string;
  status_code: number;
}

// Navigation
export type RootStackParamList = {
  Auth: undefined;
  Chat: undefined;
  Profile: undefined;
  Settings: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  GoogleLogin: undefined;
  PhoneLogin: undefined;
  PhoneOTP: { phone: string };
  Onboarding: undefined;
};

