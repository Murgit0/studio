
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
  imageUrl: z.string().url().optional().describe('Optional URL of a relevant image for the search result.'),
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
  const searchEngineId = process.env.SEARCH_ENGINE_ID; 

  if (!apiKey) {
    console.warn('SEARCH_API_KEY environment variable is not set. For production environments like Netlify, this must be configured in your site settings. Returning mock search results.');
    return getMockSearchResults(input.query);
  }

  if (!searchEngineId || searchEngineId === 'YOUR_SEARCH_ENGINE_ID') {
    let warningMessage = 'SEARCH_ENGINE_ID environment variable is not set.';
    if (searchEngineId === 'YOUR_SEARCH_ENGINE_ID') {
      warningMessage = 'SEARCH_ENGINE_ID environment variable is using a placeholder value "YOUR_SEARCH_ENGINE_ID".';
    }
    console.warn(`${warningMessage} For production environments like Netlify, a valid Search Engine ID must be configured in your site settings. Returning mock search results.`);
    return getMockSearchResults(input.query);
  }

  try {
    // When using Google Custom Search API, you can add &searchType=image to the query for image results
    // or parse item.pagemap?.cse_image?.[0]?.src for images associated with web results.
    // For now, this example primarily fetches web results.
    // You'll need to adapt this to include image URLs from your chosen API's response structure.
    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(input.query)}`
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Search API request failed with status ${response.status}: ${errorData}`);
      throw new Error(`Search API request failed with status ${response.status}. Check server logs for details. Ensure your SEARCH_API_KEY and SEARCH_ENGINE_ID are correct and the Custom Search API is enabled for your project.`);
    }

    const data = await response.json();
    const results: WebSearchResultItem[] = data.items?.map((item: any) => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet,
      // Example for Google Custom Search API: item.pagemap?.cse_image?.[0]?.src
      // You will need to adjust this based on your chosen Search API's response for images.
      // For now, we'll use a placeholder if the API doesn't directly provide an obvious image URL
      // in a simple way for this basic fetch.
      imageUrl: item.pagemap?.cse_thumbnail?.[0]?.src || item.pagemap?.cse_image?.[0]?.src || `https://placehold.co/150x100.png?text=${encodeURIComponent(item.title.substring(0,10))}`,
    })) || [];
    
    return { results };

  } catch (error) {
    console.error('Error fetching real search results:', error);
    console.warn('Falling back to mock search results due to an error during API call.');
    return getMockSearchResults(input.query);
  }
}

function getMockSearchResults(query: string): PerformWebSearchOutput {
  const encodedQuery = encodeURIComponent(query);
  return {
    results: [
      {
        title: 'Mock Result 1 for: ' + query,
        link: `https://example.com/mock1?q=${encodedQuery}`,
        snippet: 'This is a mock search result snippet. Configure your Search API (SEARCH_API_KEY and SEARCH_ENGINE_ID in environment variables) for real results.',
        imageUrl: `https://placehold.co/150x100.png?text=Mock1`,
      },
      {
        title: 'Mock Result 2 for: ' + query,
        link: `https://example.com/mock2?q=${encodedQuery}`,
        snippet: 'Another mock snippet. Ensure environment variables are set for your chosen Search API.',
        imageUrl: `https://placehold.co/150x100.png?text=Mock2`,
      },
      {
        title: `More about "${query}" (Mock)`,
        link: `https://en.wikipedia.org/wiki/${encodeURIComponent(query.replace(/\s+/g, '_'))}`,
        snippet: `This is a mock Wikipedia link for ${query}. Real results require proper API configuration via environment variables.`,
        imageUrl: `https://placehold.co/150x100.png?text=Wiki`,
      }
    ],
  };
}


export const performWebSearchTool = ai.defineTool(
  {
    name: 'performWebSearch',
    description: 'Performs a web search for the given query and returns a list of results including title, link, snippet, and optionally an image URL.',
    inputSchema: PerformWebSearchInputSchema, 
    outputSchema: PerformWebSearchOutputSchema, 
  },
  performWebSearchToolHandler
);

