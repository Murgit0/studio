'use server';
/**
 * @fileOverview Fetches advanced web search results for a user's query using a dedicated search tool.
 *
 * - generateAdvancedSearchResults - A function that uses the performAdvancedSearch tool.
 */

import {
  performAdvancedSearch as fetchAdvancedSearchResults,
  type PerformAdvancedSearchInput,
  type PerformAdvancedSearchOutput,
} from '@/ai/tools/perform-advanced-search';


/**
 * Fetches advanced search results by directly calling the tool's wrapper function.
 */
export async function generateAdvancedSearchResults(input: PerformAdvancedSearchInput): Promise<PerformAdvancedSearchOutput> {
  if (input.verbose) {
    console.log(`[VERBOSE FLOW - generateAdvancedSearchResults] Input:`, JSON.stringify(input, null, 2));
  }
  
  const results = await fetchAdvancedSearchResults(input);
  
  if (input.verbose) {
    console.log(`[VERBOSE FLOW - generateAdvancedSearchResults] Output:`, JSON.stringify(results, null, 2));
  }
  
  return results;
}
