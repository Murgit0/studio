
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;
let isConfigured = true;

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === 'YOUR_SUPABASE_URL') {
  console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL is missing or set to the placeholder 'YOUR_SUPABASE_URL'. Please update your .env file. After saving the .env file, you MUST restart your Next.js development server. Ensure this is also set in your Netlify deployment.");
  isConfigured = false;
}

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
  console.error("ERROR: NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or set to the placeholder 'YOUR_SUPABASE_ANON_KEY'. Please update your .env file. After saving the .env file, you MUST restart your Next.js development server. Ensure this is also set in your Netlify deployment.");
  isConfigured = false;
}

if (isConfigured && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  // Only attempt to create client if both seem correctly configured (i.e., not placeholders and not missing)
  try {
    supabaseInstance = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  } catch (e: any) {
    // This catch is for errors during createClient itself, e.g., if the URL is syntactically invalid AFTER placeholders are replaced.
    console.error("Failed to create Supabase client. This might be due to an invalid URL format or an issue with the provided credentials, even if they are not placeholders. Error: " + e.message);
    isConfigured = false; // Mark as unconfigured if createClient itself fails
  }
} else {
    // This else block ensures supabaseInstance remains null if isConfigured is false due to placeholder checks.
    if (!isConfigured) { 
        // Log this general message only if specific placeholder errors were already logged by the checks above.
        console.warn("Supabase client not created due to configuration issues (see previous console errors for details). Authentication will not function.");
    }
}

export const supabase = supabaseInstance;
export const supabaseConfigured = isConfigured;
