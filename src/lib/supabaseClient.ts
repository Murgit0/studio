
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;
let isConfigured = true;

// Check for URL placeholder or missing URL
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === 'YOUR_SUPABASE_URL') {
  // UI in AuthStatus.tsx will guide the user. Console error for this specific case removed.
  isConfigured = false;
}

// Check for Anon Key placeholder or missing Key
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
  // UI in AuthStatus.tsx will guide the user. Console error for this specific case removed.
  isConfigured = false;
}

if (isConfigured && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  // Only attempt to create client if all preliminary checks passed and vars are truthy.
  try {
    supabaseInstance = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  } catch (e: any) {
    // This catch is for errors during createClient itself, if URL is syntactically invalid AFTER placeholders might have been replaced,
    // or other unexpected issues with createClient. This is a genuine error that should be logged.
    console.error("Supabase client initialization failed unexpectedly, even after basic environment variable checks. Error: " + e.message);
    isConfigured = false; // Mark as unconfigured if createClient itself fails
  }
} else {
    // This block is reached if isConfigured became false due to the placeholder/missing checks above.
    // supabaseInstance remains null. AuthStatus.tsx will handle the UI notification.
}

export const supabase = supabaseInstance;
export const supabaseConfigured = isConfigured;
