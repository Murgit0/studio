
'use server';
/**
 * @fileOverview A tool for performing web searches and fetching related images.
 *
 * - performWebSearch - A function that wraps the tool to fetch search results and images.
 * - PerformWebSearchInput - The input type for the performWebSearch function.
 * - PerformWebSearchOutput - The return type for the performWebSearch function.
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

const MAX_WEB_RESULTS = 10;
const MAX_IMAGES_TO_FETCH = 20;

// This is the handler function that the Genkit tool will execute.
async function performWebSearchToolHandler(input: PerformWebSearchInput): Promise<PerformWebSearchOutput> {
  const googleApiKey = process.env.SEARCH_API_KEY;
  const googleSearchEngineId = process.env.SEARCH_ENGINE_ID;
  const pexelsApiKey = process.env.PEXELS_API_KEY;


  let webResults: WebSearchResultItem[] = [];
  let images: ImageResultItem[] = [];

  // 1. Fetch Web Results (Text) from Google Custom Search
  if (!googleApiKey) {
    let warningMessage = 'SEARCH_API_KEY (for Google Custom Search) environment variable is not set.';
    if (process.env.NODE_ENV === 'production') {
      warningMessage += ' For production environments like Netlify, this must be configured in your site settings.';
    } else {
      warningMessage += ' Please set it in your .env file for local development.';
    }
    console.warn(`${warningMessage} Returning mock results for web content.`);
    return getMockSearchResults(input.query); // Early exit with full mocks if no Google key
  }
  if (!googleSearchEngineId || googleSearchEngineId === 'YOUR_SEARCH_ENGINE_ID') {
    let warningMessage = 'SEARCH_ENGINE_ID (for Google Custom Search) environment variable is not set.';
    if (googleSearchEngineId === 'YOUR_SEARCH_ENGINE_ID') {
      warningMessage = 'SEARCH_ENGINE_ID environment variable is using a placeholder value "YOUR_SEARCH_ENGINE_ID".';
    }
    if (process.env.NODE_ENV === 'production') {
      warningMessage += ' For production environments like Netlify, a valid Search Engine ID must be configured in your site settings.';
    } else {
      warningMessage += ' Please set it for local development (e.g., in your .env file or by creating a Programmable Search Engine in Google Cloud).';
    }
    console.warn(`${warningMessage} Returning mock results for web content.`);
    return getMockSearchResults(input.query); // Early exit with full mocks
  }

  let googleSearchData: any = null;
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
    googleSearchData = await response.json();
    webResults = googleSearchData.items?.map((item: any): WebSearchResultItem => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet,
    })) || [];
    console.log(`Fetched ${webResults.length} web result(s) from Google.`);

  } catch (error) {
    console.error('Error fetching real web search results from Google:', error);
    console.warn('Falling back to mock search results for web content due to an error during web API call.');
    webResults = getMockSearchResults(input.query).webResults; // Use mock web results
  }

  // 2. Fetch Images - Prioritize Pexels
  if (pexelsApiKey && pexelsApiKey !== "YOUR_PEXELS_API_KEY_HERE") {
    try {
      console.log(`Attempting to fetch up to ${MAX_IMAGES_TO_FETCH} image(s) from Pexels for query: "${input.query}"`);
      const pexelsResponse = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(input.query)}&per_page=${MAX_IMAGES_TO_FETCH}`, {
        headers: { Authorization: pexelsApiKey }
      });
      if (pexelsResponse.ok) {
        const pexelsData = await pexelsResponse.json();
        if (pexelsData.photos && pexelsData.photos.length > 0) {
          pexelsData.photos.forEach((photo: any) => {
            if (images.length >= MAX_IMAGES_TO_FETCH) return;
            if (photo.src?.medium && !images.find(img => img.imageUrl === photo.src.medium)) {
                 images.push({
                    imageUrl: photo.src.medium,
                    altText: photo.alt || `Image by ${photo.photographer} on Pexels`,
                    photographerName: photo.photographer,
                    photographerUrl: photo.photographer_url,
                    sourcePlatform: "Pexels",
                    sourceUrl: photo.url,
                  });
            }
          });
          console.log(`Fetched ${images.length} image(s) from Pexels.`);
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
  } else {
    console.warn("PEXELS_API_KEY not set or is a placeholder. Skipping Pexels image search as primary source.");
  }

  // 3. Supplement with Google Images if Pexels provided fewer than MAX_IMAGES_TO_FETCH
  if (images.length < MAX_IMAGES_TO_FETCH && googleSearchData?.items) {
    console.log(`Pexels provided ${images.length} images. Attempting to supplement with Google Images.`);
    for (const item of googleSearchData.items) {
      if (images.length >= MAX_IMAGES_TO_FETCH) break;
      const cseImage = item.pagemap?.cse_image?.[0]?.src;
      const cseThumbnail = item.pagemap?.cse_thumbnail?.[0]?.src;
      const imageUrl = cseImage || cseThumbnail;
      
      if (imageUrl && !images.find(img => img.imageUrl === imageUrl)) { 
        images.push({
          imageUrl: imageUrl,
          altText: item.pagemap?.metatags?.[0]?.['og:image:alt'] || item.pagemap?.metatags?.[0]?.['twitter:image:alt'] || `Image from ${item.title}`,
          sourcePlatform: "Google",
          sourceUrl: item.link, 
        });
      }
    }
    console.log(`Total images after supplementing with Google: ${images.length}`);
  }

  // 4. Placeholders as a final resort if no images were fetched and web results exist
  if (images.length === 0 && webResults.length > 0) {
    console.log("No images fetched from Pexels or Google. Providing placeholder images.");
    const safeQuery = input.query || "image";
    images = Array.from({ length: Math.min(MAX_IMAGES_TO_FETCH, 6) }).map((_, i) => ({ 
        imageUrl: `https://placehold.co/300x200.png?text=${encodeURIComponent(safeQuery.substring(0,10))}-${i+1}`,
        altText: `Placeholder image for ${safeQuery} ${i+1}`,
        sourcePlatform: "Placeholder",
        sourceUrl: `https://placehold.co/`
    }));
  } else if (images.length === 0 && webResults.length === 0) {
    console.warn("No web results and no real images, using mock images.");
    images = getMockSearchResults(input.query).images || [];
  }
  
  if (images.length > MAX_IMAGES_TO_FETCH) {
    images = images.slice(0, MAX_IMAGES_TO_FETCH);
  }

  console.log("Final images being returned by performWebSearchToolHandler:", JSON.stringify(images.map(img => ({url:img.imageUrl, source:img.sourcePlatform, alt: img.altText?.substring(0,30)})), null, 2));
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
    images: Array.from({ length: Math.min(MAX_IMAGES_TO_FETCH, 6) }).map((_, i) => ({ 
        imageUrl: `https://placehold.co/300x200.png?text=Mock-${safeQuery.substring(0,5)}-${i+1}`,
        altText: `Mock Image ${i+1} for ${safeQuery}`,
        photographerName: `Mock Artist ${i+1}`,
        photographerUrl: `https://example.com/artist${i+1}`,
        sourcePlatform: "MockPlatform",
        sourceUrl: `https://example.com/mock${i+1}/image_source`,
      }))
  };
}

const performWebSearchTool = ai.defineTool(
  {
    name: 'performWebSearch',
    description: 'Performs a web search for text results using Google Custom Search. Fetches related images, prioritizing Pexels, then supplementing with Google Images if Pexels provides too few.',
    inputSchema: PerformWebSearchInputSchema,
    outputSchema: PerformWebSearchOutputSchema,
  },
  performWebSearchToolHandler
);
