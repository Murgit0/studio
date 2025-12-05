
'use server';
/**
 * @fileOverview Fetches news articles for a user's query using a dedicated news search tool.
 *
 * - generateNewsResults - A function that uses the performNewsSearch tool to get news articles.
 */
import {
  performNewsSearch as fetchNewsArticles,
  type PerformNewsSearchInput,
  type PerformNewsSearchOutput,
} from '@/ai/tools/perform-news-search';

export type { PerformNewsSearchInput, PerformNewsSearchOutput };

/**
 * Fetches news articles by directly calling the news search tool's wrapper function.
 * Includes a verbose flag to pass down.
 */
export async function generateNewsResults(input: PerformNewsSearchInput): Promise<PerformNewsSearchOutput> {
  if (input.verbose) {
    console.log(`[VERBOSE FLOW - generateNewsResults] Input:`, JSON.stringify(input, null, 2));
  }
  // Directly call the news search tool's logic.
  const results = await fetchNewsArticles(input);
  if (input.verbose) {
    console.log(`[VERBOSE FLOW - generateNewsResults] Output:`, JSON.stringify(results, null, 2));
  }
  return results;
}
