'use server';
/**
 * @fileOverview Fetches web search results for a user's query using a dedicated search tool.
 *
 * - generateSearchResults - A function that uses the performWebSearch tool to get search results.
 */

import {
  performWebSearch as fetchRealSearchResults,
  type PerformWebSearchInput, // TypeScript type for function parameters/return types
  type PerformWebSearchOutput, // TypeScript type for function parameters/return types
} from '@/ai/tools/perform-web-search';
// Removed import of Zod schemas (PerformWebSearchInputSchema, PerformWebSearchOutputSchema)
// as they are not needed for this direct wrapper and caused "use server" export issues.

/**
 * Fetches real search results by directly calling the search tool's wrapper function.
 */
export async function generateSearchResults(input: PerformWebSearchInput): Promise<PerformWebSearchOutput> {
  // Directly call the search tool's logic.
  return fetchRealSearchResults(input);
}

// Note: If this were to be a Genkit flow defined with ai.defineFlow,
// it would need its own local Zod schema definitions for input and output,
// or import them from a shared, non-'use server' module.
// For the current direct-call approach, this is not necessary.
