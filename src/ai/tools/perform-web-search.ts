
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
  sourcePlatform: z.string().optional().describe("The platform the image was sourced from (e.g., Pexels, Unsplash, Google)."),
  sourceUrl: z.string().url().optional().describe("A URL to the image's page on the source platform for attribution or the web page it was found on."),
});
export type ImageResultItem = z.infer<typeof ImageResultItemSchema>;


// Schema for the tool's output
const PerformWebSearchOutputSchema = z.object({
  webResults: z.array(WebSearchResultItemSchema).max(10).describe('An array of web search results (max 10 due to API limits).'),
  images: z.array(ImageResultItemSchema).max(20).optional().describe('An array of image search results (max 20).'),
});
export type PerformWebSearchOutput = z.infer<typeof PerformWebSearchOutputSchema>;

/**
 * Wrapper function to call the performWebSearchTool's logic.
 */
export async function performWebSearch(input: PerformWebSearchInput): Promise<PerformWebSearchOutput> {
  return performWebSearchToolHandler(input);
}

const MAX_WEB_RESULTS = 10; // Google Custom Search API typically limits to 10 per request
const MAX_IMAGES_TO_FETCH = 20;

// This is the handler function that the Genkit tool will execute.
async function performWebSearchToolHandler(input: PerformWebSearchInput): Promise<PerformWebSearchOutput> {
  const googleApiKey = process.env.SEARCH_API_KEY;
  const googleSearchEngineId = process.env.SEARCH_ENGINE_ID;
  const pexelsApiKey = process.env.PEXELS_API_KEY;

  let webResults: WebSearchResultItem[] = [];
  let images: ImageResultItem[] = [];

  // Fetch web results using Google Custom Search API
  if (!googleApiKey) {
    console.warn('SEARCH_API_KEY (for Google Custom Search) environment variable is not set. For production environments like Netlify, this must be configured in your site settings. Returning mock results.');
    return getMockSearchResults(input.query);
  }
  if (!googleSearchEngineId || googleSearchEngineId === 'YOUR_SEARCH_ENGINE_ID') {
    let warningMessage = 'SEARCH_ENGINE_ID (for Google Custom Search) environment variable is not set.';
    if (googleSearchEngineId === 'YOUR_SEARCH_ENGINE_ID') {
      warningMessage = 'SEARCH_ENGINE_ID environment variable is using a placeholder value "YOUR_SEARCH_ENGINE_ID".';
    }
    console.warn(`${warningMessage} For production environments like Netlify, a valid Search Engine ID must be configured in your site settings. Returning mock results.`);
    return getMockSearchResults(input.query);
  }

  try {
    console.log(`Fetching web results from Google Custom Search for query: "${input.query}"`);
    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleSearchEngineId}&q=${encodeURIComponent(input.query)}&num=${MAX_WEB_RESULTS}`
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
    console.log(`Fetched ${webResults.length} web result(s) from Google.`);

    // Extract images from Google search results pagemap
    if (data.items) {
      for (const item of data.items) {
        if (images.length >= MAX_IMAGES_TO_FETCH) break;
        const cseImage = item.pagemap?.cse_image?.[0]?.src;
        const cseThumbnail = item.pagemap?.cse_thumbnail?.[0]?.src;
        const imageUrl = cseImage || cseThumbnail;
        if (imageUrl && !images.find(img => img.imageUrl === imageUrl)) {
          images.push({
            imageUrl: imageUrl,
            altText: `Image related to ${item.title}`,
            sourcePlatform: "Google",
            sourceUrl: item.link, // Link to the page where the image was found
          });
        }
      }
      console.log(`Found ${images.length} image(s) from Google search result pagemaps.`);
    }

  } catch (error) {
    console.error('Error fetching real web search results or extracting images from Google:', error);
    console.warn('Falling back to mock search results due to an error during web API call for web results.');
    return getMockSearchResults(input.query);
  }

  // Pexels fallback: ONLY if Google provided ZERO images
  if (images.length === 0 && pexelsApiKey && pexelsApiKey !== "YOUR_PEXELS_API_KEY_HERE") {
    try {
      console.log(`Google provided 0 images. Attempting to fetch ${MAX_IMAGES_TO_FETCH} image(s) from Pexels for query: "${input.query}"`);
      const pexelsResponse = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(input.query)}&per_page=${MAX_IMAGES_TO_FETCH}`, {
        headers: { Authorization: pexelsApiKey }
      });
      if (pexelsResponse.ok) {
        const pexelsData = await pexelsResponse.json();
        if (pexelsData.photos && pexelsData.photos.length > 0) {
          pexelsData.photos.forEach((photo: any) => {
            if (images.length >= MAX_IMAGES_TO_FETCH) return;
            if (!images.find(img => img.imageUrl === photo.src.medium)) {
                 images.push({
                    imageUrl: photo.src.medium,
                    altText: photo.alt || `Image related to ${input.query}`,
                    photographerName: photo.photographer,
                    photographerUrl: photo.photographer_url,
                    sourcePlatform: "Pexels",
                    sourceUrl: photo.url,
                  });
            }
          });
          console.log(`Added images from Pexels. Total images now: ${images.length}`);
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
  } else if (images.length === 0 && (!pexelsApiKey || pexelsApiKey === "YOUR_PEXELS_API_KEY_HERE")) {
    console.warn("Google provided 0 images, but PEXELS_API_KEY not set or is a placeholder. Skipping Pexels image search.");
  }


  // If no real images were fetched and web results are also empty (likely meaning we fell back to mocks earlier),
  // ensure mock images are provided.
  if (webResults.length === 0 && images.length === 0) {
    console.warn("No web results and no real images, returning full mock data.");
    return getMockSearchResults(input.query);
  }
  
  // If no images were fetched from any API, but we have web results, provide placeholder images.
  if (images.length === 0 && webResults.length > 0) {
    console.log("No images fetched from Google or Pexels. Providing placeholder images.");
    const safeQuery = input.query || "image";
    const numPlaceholders = MAX_IMAGES_TO_FETCH;
    images = Array.from({ length: numPlaceholders }).map((_, i) => ({
        imageUrl: `https://placehold.co/300x200.png?text=${encodeURIComponent(safeQuery.substring(0,10))}-${i+1}`,
        altText: `Placeholder image for ${safeQuery} ${i+1}`,
        sourcePlatform: "Placeholder",
        sourceUrl: `https://placehold.co/`
    }));
  }

  console.log("Final images being returned by performWebSearchToolHandler:", JSON.stringify(images.map(img => ({url:img.imageUrl, source:img.sourcePlatform})), null, 2));
  return { webResults, images };
}

function getMockSearchResults(query: string): PerformWebSearchOutput {
  const encodedQuery = encodeURIComponent(query);
  const safeQuery = query || "mock";
  return {
    webResults: Array.from({ length: MAX_WEB_RESULTS }).map((_, i) => ({
      title: `Mock Web Result ${i + 1} for: ${safeQuery}`,
      link: `https://example.com/mock-web${i+1}?q=${encodedQuery}`,
      snippet: `This is mock web search result snippet ${i+1}. Configure your Search API (SEARCH_API_KEY and SEARCH_ENGINE_ID in environment variables) for real results.`,
    })),
    images: Array.from({ length: MAX_IMAGES_TO_FETCH }).map((_, i) => ({ 
        imageUrl: `https://placehold.co/300x200.png?text=Mock-${safeQuery.substring(0,5)}-${i+1}`,
        altText: `Mock Image ${i+1} for ${safeQuery}`,
        photographerName: `Mock Artist ${i+1}`,
        photographerUrl: `https://example.com/artist${i+1}`,
        sourcePlatform: "MockPlatform",
        sourceUrl: `https://example.com/mock${i+1}/image_source`,
      }))
  };
}

export const performWebSearchTool = ai.defineTool(
  {
    name: 'performWebSearch',
    description: 'Performs a web search for the given query and returns a list of text results. Also fetches related images, prioritizing Google Search pagemap, then Pexels if Google provides no images.',
    inputSchema: PerformWebSearchInputSchema,
    outputSchema: PerformWebSearchOutputSchema,
  },
  performWebSearchToolHandler
);

