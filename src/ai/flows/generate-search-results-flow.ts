
'use server';
/**
 * @fileOverview Fetches web search results for a user's query using a dedicated search tool.
 *
 * - generateSearchResults - A function that uses the performWebSearch tool to get search results.
 */

import {
  performWebSearch as fetchRealSearchResults,
  type PerformWebSearchInput, 
  type PerformWebSearchOutput, 
} from '@/ai/tools/perform-web-search';


/**
 * Fetches real search results by directly calling the search tool's wrapper function.
 * Now includes a verbose flag to pass down.
 */
export async function generateSearchResults(input: PerformWebSearchInput): Promise<PerformWebSearchOutput> {
  if (input.verbose) {
    console.log(`[VERBOSE FLOW - generateSearchResults] Input:`, JSON.stringify(input, null, 2));
  }
  // Directly call the search tool's logic.
  const results = await fetchRealSearchResults(input);
  if (input.verbose) {
    console.log(`[VERBOSE FLOW - generateSearchResults] Output:`, JSON.stringify(results, null, 2));
  }
  return results;
}

