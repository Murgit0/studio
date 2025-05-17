
'use server';
/**
 * @fileOverview A tool for performing web searches.
 *
 * - performWebSearch - A function that wraps the tool to fetch search results.
 * - PerformWebSearchInput - The input type for the performWebSearch function.
 * - PerformWebSearchOutput - The return type for the performWebSearch function.
 * - performWebSearchTool - The Genkit tool definition.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Schema for the tool's input - internal to this module or used by the tool definition
const PerformWebSearchInputSchema = z.object({
  query: z.string().describe('The search query.'),
});
export type PerformWebSearchInput = z.infer<typeof PerformWebSearchInputSchema>;

// Schema for a single search result item - internal
const WebSearchResultItemSchema = z.object({
  title: z.string().describe('The title of the search result.'),
  link: z.string().describe('The URL of the search result.'),
  snippet: z.string().describe('A brief snippet or description of the search result.'),
});
// Type for internal use, not exported from 'use server' module
type WebSearchResultItem = z.infer<typeof WebSearchResultItemSchema>;


// Schema for the tool's output - internal
const PerformWebSearchOutputSchema = z.object({
  results: z.array(WebSearchResultItemSchema).describe('An array of web search results.'),
});
export type PerformWebSearchOutput = z.infer<typeof PerformWebSearchOutputSchema>;

/**
 * Wrapper function to call the performWebSearchTool's logic.
 * This is what your flows will typically interact with.
 */
export async function performWebSearch(input: PerformWebSearchInput): Promise<PerformWebSearchOutput> {
  return performWebSearchToolHandler(input);
}

// This is the handler function that the Genkit tool will execute.
// It contains the core logic for fetching search results.
async function performWebSearchToolHandler(input: PerformWebSearchInput): Promise<PerformWebSearchOutput> {
  const apiKey = process.env.SEARCH_API_KEY;
  const searchEngineId = process.env.SEARCH_ENGINE_ID || 'YOUR_SEARCH_ENGINE_ID'; // You MUST replace YOUR_SEARCH_ENGINE_ID or set SEARCH_ENGINE_ID env var

  if (!apiKey) {
    console.warn('SEARCH_API_KEY is not set. Returning mock search results.');
    return getMockSearchResults(input.query);
  }

  if (searchEngineId === 'YOUR_SEARCH_ENGINE_ID') {
    console.warn('Search Engine ID (cx) is not configured. Please set YOUR_SEARCH_ENGINE_ID in the code or SEARCH_ENGINE_ID environment variable. Returning mock search results.');
    return getMockSearchResults(input.query);
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(input.query)}`
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Search API request failed with status ${response.status}: ${errorData}`);
      throw new Error(`Search API request failed with status ${response.status}. Check server logs for details.`);
    }

    const data = await response.json();
    const results: WebSearchResultItem[] = data.items?.map((item: any) => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet,
    })) || [];
    
    return { results };

  } catch (error) {
    console.error('Error fetching real search results:', error);
    // Fallback to mock data on error
    console.warn('Falling back to mock search results due to an error.');
    return getMockSearchResults(input.query);
  }
}

function getMockSearchResults(query: string): PerformWebSearchOutput {
  // Fallback to mock data if API key is missing or API call fails
  return {
    results: [
      {
        title: 'Mock Result 1 for: ' + query,
        link: 'https://example.com/mock1',
        snippet: 'This is a mock search result snippet. Configure your Search API for real results.',
      },
      {
        title: 'Mock Result 2 for: ' + query,
        link: 'https://example.com/mock2',
        snippet: 'Another mock snippet. Implement your chosen Search API here.',
      },
      {
        title: `More about "${query}"`,
        link: `https://en.wikipedia.org/wiki/${encodeURIComponent(query.replace(/\s+/g, '_'))}`,
        snippet: `This is a mock Wikipedia link for ${query}. Real results require API configuration.`,
      }
    ],
  };
}


export const performWebSearchTool = ai.defineTool(
  {
    name: 'performWebSearch',
    description: 'Performs a web search for the given query and returns a list of results including title, link, and snippet.',
    inputSchema: PerformWebSearchInputSchema, // Uses internal schema
    outputSchema: PerformWebSearchOutputSchema, // Uses internal schema
  },
  performWebSearchToolHandler
);
