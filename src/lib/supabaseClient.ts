
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Log the environment variables as the application sees them
console.log('[SupabaseClient] Initializing...');
console.log('[SupabaseClient] Attempting to read NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('[SupabaseClient] Attempting to read NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

let supabaseInstance: SupabaseClient | null = null;
let isConfigured = true;

// Check for URL placeholder or missing URL
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === 'YOUR_SUPABASE_URL') {
  // UI in AuthStatus.tsx will guide the user.
  isConfigured = false;
}

// Check for Anon Key placeholder or missing Key
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
  // UI in AuthStatus.tsx will guide the user.
  isConfigured = false;
}

if (isConfigured && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  // Only attempt to create client if all preliminary checks passed and vars are truthy.
  try {
    supabaseInstance = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    console.log('[SupabaseClient] Supabase client potentially configured.');
  } catch (e: any) {
    // This catch is for errors during createClient itself, if URL is syntactically invalid AFTER placeholders might have been replaced,
    // or other unexpected issues with createClient. This is a genuine error that should be logged.
    console.error("[SupabaseClient] Supabase client initialization failed unexpectedly, even after basic environment variable checks. Error: " + e.message);
    isConfigured = false; // Mark as unconfigured if createClient itself fails
  }
} else {
    // This block is reached if isConfigured became false due to the placeholder/missing checks above.
    // supabaseInstance remains null. AuthStatus.tsx will handle the UI notification.
    console.warn('[SupabaseClient] Supabase client not configured due to missing or placeholder URL/Key.');
}

export const supabase = supabaseInstance;
export const supabaseConfigured = isConfigured;
