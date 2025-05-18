
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
  const googleApiKey = process.env.SEARCH_API_KEY;
  const googleSearchEngineId = process.env.SEARCH_ENGINE_ID;
  // API Keys for other image services - to be set in environment variables
  // const unsplashApiKey = process.env.UNSPLASH_API_KEY;
  // const pexelsApiKey = process.env.PEXELS_API_KEY;
  // const bingImageApiKey = process.env.BING_SEARCH_API_KEY; // Or use a general Bing Search API key

  if (!googleApiKey) {
    console.warn('SEARCH_API_KEY (for Google Custom Search) environment variable is not set. For production environments like Netlify, this must be configured in your site settings. Returning mock search results.');
    return getMockSearchResults(input.query);
  }

  if (!googleSearchEngineId || googleSearchEngineId === 'YOUR_SEARCH_ENGINE_ID') {
    let warningMessage = 'SEARCH_ENGINE_ID (for Google Custom Search) environment variable is not set.';
    if (googleSearchEngineId === 'YOUR_SEARCH_ENGINE_ID') {
      warningMessage = 'SEARCH_ENGINE_ID environment variable is using a placeholder value "YOUR_SEARCH_ENGINE_ID".';
    }
    console.warn(`${warningMessage} For production environments like Netlify, a valid Search Engine ID must be configured in your site settings. Returning mock search results.`);
    return getMockSearchResults(input.query);
  }

  try {
    // Fetch web results using Google Custom Search API
    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleSearchEngineId}&q=${encodeURIComponent(input.query)}`
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Google Search API request failed with status ${response.status}: ${errorData}`);
      throw new Error(`Google Search API request failed with status ${response.status}. Check server logs for details. Ensure your SEARCH_API_KEY and SEARCH_ENGINE_ID are correct and the Custom Search API is enabled for your project.`);
    }

    const data = await response.json();

    const results: WebSearchResultItem[] = await Promise.all(data.items?.map(async (item: any) => {
      let imageUrl = item.pagemap?.cse_thumbnail?.[0]?.src || item.pagemap?.cse_image?.[0]?.src;

      // Conceptual: If no image from Google, or to use an alternative provider for images:
      // You would implement helper functions like fetchImageFromUnsplash, fetchImageFromPexels, etc.
      // These functions would take item.title or input.query and the respective API key.

      // if (!imageUrl && unsplashApiKey) {
      //   try {
      //     // Example: const unsplashImage = await fetchImageFromUnsplash(item.title, unsplashApiKey);
      //     // if (unsplashImage) imageUrl = unsplashImage.urls.small;
      //     console.log(`Conceptual: Would fetch from Unsplash for "${item.title}"`);
      //   } catch (e) { console.error("Error fetching from Unsplash:", e); }
      // }
      // if (!imageUrl && pexelsApiKey) {
      //   try {
      //     // Example: const pexelsImage = await fetchImageFromPexels(item.title, pexelsApiKey);
      //     // if (pexelsImage) imageUrl = pexelsImage.src.medium;
      //     console.log(`Conceptual: Would fetch from Pexels for "${item.title}"`);
      //   } catch (e) { console.error("Error fetching from Pexels:", e); }
      // }
      // if (!imageUrl && bingImageApiKey) {
      //   try {
      //     // Example: const bingImage = await fetchImageFromBing(item.title, bingImageApiKey);
      //     // if (bingImage) imageUrl = bingImage.thumbnailUrl; // Or similar field
      //     console.log(`Conceptual: Would fetch from Bing Images for "${item.title}"`);
      //   } catch (e) { console.error("Error fetching from Bing Images:", e); }
      // }
      
      return {
        title: item.title,
        link: item.link,
        snippet: item.snippet,
        imageUrl: imageUrl || `https://placehold.co/150x100.png?text=${encodeURIComponent(item.title.substring(0,10))}`,
      };
    }) || []);
    
    return { results };

  } catch (error) {
    console.error('Error fetching real search results:', error);
    console.warn('Falling back to mock search results due to an error during API call.');
    return getMockSearchResults(input.query);
  }
}

function getMockSearchResults(query: string, providerHint?: string): PerformWebSearchOutput {
  const encodedQuery = encodeURIComponent(query);
  const hint = providerHint ? ` (${providerHint})` : '';
  return {
    results: [
      {
        title: `Mock Result 1 for: ${query}${hint}`,
        link: `https://example.com/mock1?q=${encodedQuery}`,
        snippet: `This is a mock search result snippet. Configure your Search API (SEARCH_API_KEY and SEARCH_ENGINE_ID in environment variables) for real results. ${hint}`,
        imageUrl: `https://placehold.co/150x100.png?text=Mock1`,
      },
      {
        title: `Mock Result 2 for: ${query}${hint}`,
        link: `https://example.com/mock2?q=${encodedQuery}`,
        snippet: `Another mock snippet. Ensure environment variables are set for your chosen Search API. ${hint}`,
        imageUrl: `https://placehold.co/150x100.png?text=Mock2`,
      },
      {
        title: `More about "${query}" (Mock)${hint}`,
        link: `https://en.wikipedia.org/wiki/${encodeURIComponent(query.replace(/\s+/g, '_'))}`,
        snippet: `This is a mock Wikipedia link for ${query}. Real results require proper API configuration via environment variables. ${hint}`,
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

