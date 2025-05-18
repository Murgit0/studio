
'use server';
/**
 * @fileOverview A tool for performing web searches and fetching related images.
 *
 * - performWebSearch - A function that wraps the tool to fetch search results and images.
 * - PerformWebSearchInput - The input type for the performWebSearch function.
 * - PerformWebSearchOutput - The return type for the performWebSearch function.
 * - performWebSearchTool - The Genkit tool definition.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Schema for the tool's input
const PerformWebSearchInputSchema = z.object({
  query: z.string().describe('The search query.'),
});
export type PerformWebSearchInput = z.infer<typeof PerformWebSearchInputSchema>;

// Schema for a single web search result item (text-focused)
const WebSearchResultItemSchema = z.object({
  title: z.string().describe('The title of the search result.'),
  link: z.string().describe('The URL of the search result.'),
  snippet: z.string().describe('A brief snippet or description of the search result.'),
});
type WebSearchResultItem = z.infer<typeof WebSearchResultItemSchema>;

// Schema for a single image result item
const ImageResultItemSchema = z.object({
  imageUrl: z.string().url().describe('URL of the image.'),
  altText: z.string().optional().describe('Alt text for the image.'),
  photographerName: z.string().optional().describe("The name of the image's photographer for attribution."),
  photographerUrl: z.string().url().optional().describe("A URL to the photographer's profile or source for attribution."),
  sourcePlatform: z.string().optional().describe("The platform the image was sourced from (e.g., Pexels, Unsplash)."),
  sourceUrl: z.string().url().optional().describe("A URL to the image's page on the source platform for attribution."),
});
type ImageResultItem = z.infer<typeof ImageResultItemSchema>;


// Schema for the tool's output
const PerformWebSearchOutputSchema = z.object({
  webResults: z.array(WebSearchResultItemSchema).describe('An array of web search results.'),
  images: z.array(ImageResultItemSchema).optional().describe('An array of image search results, primarily from Pexels or Unsplash.'),
});
export type PerformWebSearchOutput = z.infer<typeof PerformWebSearchOutputSchema>;

/**
 * Wrapper function to call the performWebSearchTool's logic.
 */
export async function performWebSearch(input: PerformWebSearchInput): Promise<PerformWebSearchOutput> {
  return performWebSearchToolHandler(input);
}

// This is the handler function that the Genkit tool will execute.
async function performWebSearchToolHandler(input: PerformWebSearchInput): Promise<PerformWebSearchOutput> {
  const googleApiKey = process.env.SEARCH_API_KEY;
  const googleSearchEngineId = process.env.SEARCH_ENGINE_ID;
  const pexelsApiKey = process.env.PEXELS_API_KEY;
  const unsplashApiKey = process.env.UNSPLASH_API_KEY; // Keep for potential future use

  let webResults: WebSearchResultItem[] = [];
  let images: ImageResultItem[] = [];

  // Fetch web results using Google Custom Search API
  if (!googleApiKey) {
    console.warn('SEARCH_API_KEY (for Google Custom Search) environment variable is not set. For production environments like Netlify, this must be configured in your site settings. Returning mock web results.');
    return getMockSearchResults(input.query); // Returns mock for both web and images
  }
  if (!googleSearchEngineId || googleSearchEngineId === 'YOUR_SEARCH_ENGINE_ID') {
    let warningMessage = 'SEARCH_ENGINE_ID (for Google Custom Search) environment variable is not set.';
    if (googleSearchEngineId === 'YOUR_SEARCH_ENGINE_ID') {
      warningMessage = 'SEARCH_ENGINE_ID environment variable is using a placeholder value "YOUR_SEARCH_ENGINE_ID".';
    }
    console.warn(`${warningMessage} For production environments like Netlify, a valid Search Engine ID must be configured in your site settings. Returning mock web results.`);
    return getMockSearchResults(input.query); // Returns mock for both web and images
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleSearchEngineId}&q=${encodeURIComponent(input.query)}`
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Google Search API request failed with status ${response.status}: ${errorData}`);
      throw new Error(`Google Search API request failed with status ${response.status}. Check server logs for details. Ensure your SEARCH_API_KEY and SEARCH_ENGINE_ID are correct and the Custom Search API is enabled for your project.`);
    }
    const data = await response.json();
    webResults = data.items?.map((item: any): WebSearchResultItem => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet,
    })) || [];

  } catch (error) {
    console.error('Error fetching real web search results:', error);
    console.warn('Falling back to mock search results due to an error during web API call.');
    return getMockSearchResults(input.query); // Returns mock for both web and images
  }

  // Fetch images from Pexels based on the main query
  if (pexelsApiKey && pexelsApiKey !== "YOUR_PEXELS_API_KEY_HERE") {
    try {
      console.log(`Attempting to fetch images from Pexels for query: "${input.query}"`);
      const pexelsResponse = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(input.query)}&per_page=6`, { // Fetch up to 6 images
        headers: { Authorization: pexelsApiKey }
      });
      if (pexelsResponse.ok) {
        const pexelsData = await pexelsResponse.json();
        if (pexelsData.photos && pexelsData.photos.length > 0) {
          images = pexelsData.photos.map((photo: any): ImageResultItem => ({
            imageUrl: photo.src.medium, // Or .large, .original, .landscape, etc.
            altText: photo.alt || `Image related to ${input.query}`,
            photographerName: photo.photographer,
            photographerUrl: photo.photographer_url,
            sourcePlatform: "Pexels",
            sourceUrl: photo.url,
          }));
          console.log(`Found ${images.length} image(s) on Pexels for "${input.query}".`);
        } else {
          console.log(`No images found on Pexels for "${input.query}".`);
        }
      } else {
        const pexelsError = await pexelsResponse.text();
        console.error(`Pexels API request failed for query "${input.query}" with status ${pexelsResponse.status}: ${pexelsError}`);
      }
    } catch (e) {
      console.error(`Error fetching from Pexels for query "${input.query}":`, e);
    }
  } else if (!pexelsApiKey || pexelsApiKey === "YOUR_PEXELS_API_KEY_HERE") {
    console.warn("PEXELS_API_KEY not set or is a placeholder. Skipping Pexels image search. Mock images will be used if web search also fails or returns mocks.");
  }
  
  // Conceptual: Fetch images from Unsplash if Pexels fails or isn't used, and Unsplash key is available
  if (images.length === 0 && unsplashApiKey && unsplashApiKey !== "YOUR_UNSPLASH_API_KEY_HERE") {
    try {
      console.log(`Attempting to fetch images from Unsplash for query: "${input.query}" as Pexels fallback.`);
      const unsplashResponse = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(input.query)}&per_page=6&client_id=${unsplashApiKey}`);
      if (unsplashResponse.ok) {
        const unsplashData = await unsplashResponse.json();
        if (unsplashData.results && unsplashData.results.length > 0) {
          images = unsplashData.results.map((photo: any): ImageResultItem => ({
            imageUrl: photo.urls.regular, // Or .small, .thumb
            altText: photo.alt_description || photo.description || `Image related to ${input.query}`,
            photographerName: photo.user.name,
            photographerUrl: photo.user.links.html,
            sourcePlatform: "Unsplash",
            sourceUrl: photo.links.html,
            // Important: Unsplash requires triggering a download endpoint if the image is "used": photo.links.download_location
            // This is not implemented here as "use" is not defined in this context. Consider for future enhancements.
          }));
          console.log(`Found ${images.length} image(s) on Unsplash for "${input.query}".`);
        } else {
          console.log(`No images found on Unsplash for "${input.query}".`);
        }
      } else {
        const unsplashError = await unsplashResponse.text();
        console.error(`Unsplash API request failed for query "${input.query}" with status ${unsplashResponse.status}: ${unsplashError}`);
      }
    } catch (e) {
      console.error(`Error fetching from Unsplash for query "${input.query}":`, e);
    }
  } else if (images.length === 0 && (!unsplashApiKey || unsplashApiKey === "YOUR_UNSPLASH_API_KEY_HERE")) {
     console.warn("UNSPLASH_API_KEY not set or is a placeholder. Skipping Unsplash image search.");
  }


  // If no real images were fetched and web results are also empty (likely meaning we fell back to mocks earlier),
  // ensure mock images are provided.
  if (webResults.length === 0 && images.length === 0) {
    return getMockSearchResults(input.query);
  }
  
  // If no images were fetched from APIs, but we have web results, provide some placeholder images.
  if (images.length === 0 && webResults.length > 0) {
    console.log("No images fetched from Pexels or Unsplash, providing placeholder images.");
    images = Array.from({ length: Math.min(webResults.length, 3) }).map((_, i) => ({
        imageUrl: `https://placehold.co/300x200.png?text=${encodeURIComponent(input.query.substring(0,10))}-${i+1}`,
        altText: `Placeholder image for ${input.query} ${i+1}`,
        sourcePlatform: "Placeholder",
        sourceUrl: `https://placehold.co/`
    }));
  }


  return { webResults, images };
}

function getMockSearchResults(query: string): PerformWebSearchOutput {
  const encodedQuery = encodeURIComponent(query);
  return {
    webResults: [
      {
        title: `Mock Web Result 1 for: ${query}`,
        link: `https://example.com/mock-web1?q=${encodedQuery}`,
        snippet: `This is a mock web search result snippet. Configure your Search API (SEARCH_API_KEY and SEARCH_ENGINE_ID in environment variables) for real results.`,
      },
      {
        title: `Mock Web Result 2 for: ${query}`,
        link: `https://example.com/mock-web2?q=${encodedQuery}`,
        snippet: `Another mock web snippet. Ensure environment variables are set for your chosen Search API.`,
      }
    ],
    images: [
      {
        imageUrl: `https://placehold.co/300x200.png?text=MockImg1-${encodedQuery.substring(0,5)}`,
        altText: `Mock Image 1 for ${query}`,
        photographerName: "Mock Artist 1",
        photographerUrl: "https://example.com/artist1",
        sourcePlatform: "MockPlatform",
        sourceUrl: "https://example.com/mock1/image_source",
      },
      {
        imageUrl: `https://placehold.co/300x200.png?text=MockImg2-${encodedQuery.substring(0,5)}`,
        altText: `Mock Image 2 for ${query}`,
        photographerName: "Mock Artist 2",
        photographerUrl: "https://example.com/artist2",
        sourcePlatform: "MockPlatform",
        sourceUrl: "https://example.com/mock2/image_source",
      }
    ]
  };
}

export const performWebSearchTool = ai.defineTool(
  {
    name: 'performWebSearch',
    description: 'Performs a web search for the given query and returns a list of text results. Also fetches related images from Pexels or Unsplash based on the query.',
    inputSchema: PerformWebSearchInputSchema,
    outputSchema: PerformWebSearchOutputSchema,
  },
  performWebSearchToolHandler
);
