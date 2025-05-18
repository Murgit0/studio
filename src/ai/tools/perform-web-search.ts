
'use server';
/**
 * @fileOverview A tool for performing web searches and fetching related images.
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
  imagePhotographerName: z.string().optional().describe("The name of the image's photographer for attribution."),
  imagePhotographerUrl: z.string().url().optional().describe("A URL to the photographer's profile or source for attribution."),
  imageSourcePlatform: z.string().optional().describe("The platform the image was sourced from (e.g., Unsplash, Pexels, Google Images)."),
  imageSourceUrl: z.string().url().optional().describe("A URL to the image's page on the source platform for attribution."),
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
  const pexelsApiKey = process.env.PEXELS_API_KEY;
  const unsplashApiKey = process.env.UNSPLASH_API_KEY; // Keep for potential future use


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

    const results: WebSearchResultItem[] = await Promise.all(data.items?.map(async (item: any): Promise<WebSearchResultItem> => {
      let imageUrl: string | undefined;
      let imagePhotographerName: string | undefined;
      let imagePhotographerUrl: string | undefined;
      let imageSourcePlatform: string | undefined;
      let imageSourceUrl: string | undefined;

      // --- Primary Image Fetch: Pexels ---
      if (pexelsApiKey) {
        try {
          console.log(`Attempting to fetch image from Pexels for "${item.title}" as primary source.`);
          const pexelsResponse = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(item.title)}&per_page=1`, { 
            headers: { Authorization: pexelsApiKey }
          });
          if (pexelsResponse.ok) {
            const pexelsData = await pexelsResponse.json();
            if (pexelsData.photos && pexelsData.photos.length > 0) {
              const photo = pexelsData.photos[0];
              imageUrl = photo.src.medium; // or other sizes like .large, .original
              imagePhotographerName = photo.photographer;
              imagePhotographerUrl = photo.photographer_url;
              imageSourcePlatform = "Pexels";
              imageSourceUrl = photo.url;
              console.log(`Found image on Pexels for "${item.title}": ${imageUrl}`);
            } else {
              console.log(`No image found on Pexels for "${item.title}".`);
            }
          } else {
            const pexelsError = await pexelsResponse.text();
            console.error(`Pexels API request failed for "${item.title}" with status ${pexelsResponse.status}: ${pexelsError}`);
          }
        } catch (e) { 
          console.error(`Error fetching from Pexels for "${item.title}":`, e); 
        }
      } else {
        console.warn("PEXELS_API_KEY not set. Skipping Pexels image search for item:", item.title);
      }

      // --- Fallback Image Fetch: Google Custom Search pagemap ---
      if (!imageUrl) { // Only if Pexels didn't provide an image
        const googleImageUrl = item.pagemap?.cse_thumbnail?.[0]?.src || item.pagemap?.cse_image?.[0]?.src;
        if (googleImageUrl) {
          imageUrl = googleImageUrl;
          imageSourcePlatform = "Google Images"; // Default attribution if from Google
          imageSourceUrl = item.link; // Default attribution if from Google
          // Note: Google images often lack direct photographer attribution.
          console.log(`Using image from Google pagemap for "${item.title}" as Pexels fallback.`);
        }
      }
      
      // --- Conceptual Fallback: Unsplash (if Pexels and Google fail) ---
      // if (!imageUrl && unsplashApiKey) {
      //   try {
      //     console.log(`Conceptual: Attempting to fetch image from Unsplash for "${item.title}" as further fallback.`);
      //     const unsplashQuery = item.title; // Or input.query for broader search
      //     const unsplashResponse = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(unsplashQuery)}&per_page=1&client_id=${unsplashApiKey}`);
      //     if (unsplashResponse.ok) {
      //       const unsplashData = await unsplashResponse.json();
      //       if (unsplashData.results && unsplashData.results.length > 0) {
      //         const photo = unsplashData.results[0];
      //         imageUrl = photo.urls.regular; // Or .small, .thumb
      //         imagePhotographerName = photo.user.name;
      //         imagePhotographerUrl = photo.user.links.html;
      //         imageSourcePlatform = "Unsplash";
      //         imageSourceUrl = photo.links.html;
      //         // Important: Unsplash requires triggering a download endpoint if the image is "used": photo.links.download_location
      //         // This is not implemented here as "use" is not defined in this context.
      //         console.log(`Found image on Unsplash for "${item.title}": ${imageUrl}`);
      //       } else {
      //         console.log(`No image found on Unsplash for "${item.title}".`);
      //       }
      //     } else {
      //       const unsplashError = await unsplashResponse.text();
      //       console.error(`Unsplash API request failed for "${item.title}" with status ${unsplashResponse.status}: ${unsplashError}`);
      //     }
      //   } catch (e) { 
      //     console.error(`Error fetching from Unsplash for "${item.title}":`, e);
      //   }
      // }
      
      return {
        title: item.title,
        link: item.link,
        snippet: item.snippet,
        imageUrl: imageUrl || `https://placehold.co/150x100.png?text=${encodeURIComponent(item.title.substring(0,10))}`, // Fallback to placeholder
        imagePhotographerName,
        imagePhotographerUrl,
        imageSourcePlatform: imageUrl ? (imageSourcePlatform || "Source") : undefined,
        imageSourceUrl,
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
        imagePhotographerName: "Mock Artist 1",
        imagePhotographerUrl: "https://example.com/artist1",
        imageSourcePlatform: "MockPlatform",
        imageSourceUrl: "https://example.com/mock1/image_source",
      },
      {
        title: `Mock Result 2 for: ${query}${hint}`,
        link: `https://example.com/mock2?q=${encodedQuery}`,
        snippet: `Another mock snippet. Ensure environment variables are set for your chosen Search API. ${hint}`,
        imageUrl: `https://placehold.co/150x100.png?text=Mock2`,
        imagePhotographerName: "Mock Artist 2",
        imagePhotographerUrl: "https://example.com/artist2",
        imageSourcePlatform: "MockPlatform",
        imageSourceUrl: "https://example.com/mock2/image_source",
      },
      {
        title: `More about "${query}" (Mock)${hint}`,
        link: `https://en.wikipedia.org/wiki/${encodeURIComponent(query.replace(/\s+/g, '_'))}`,
        snippet: `This is a mock Wikipedia link for ${query}. Real results require proper API configuration via environment variables. ${hint}`,
        // No image for this one to test conditional rendering
      }
    ],
  };
}


export const performWebSearchTool = ai.defineTool(
  {
    name: 'performWebSearch',
    description: 'Performs a web search for the given query and returns a list of results including title, link, snippet, and an image URL (primarily from Pexels if available) with attribution.',
    inputSchema: PerformWebSearchInputSchema, 
    outputSchema: PerformWebSearchOutputSchema, 
  },
  performWebSearchToolHandler
);

