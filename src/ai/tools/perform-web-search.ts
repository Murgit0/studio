
'use server';
/**
 * @fileOverview A tool for performing web searches and fetching related images.
 *
 * - performWebSearch - A function that wraps the tool to fetch search results and images.
 * - PerformWebSearchInput - The input type for the performWebSearch function.
 * - ImageResultItem - The type for a single image result item.
 * - PerformWebSearchOutput - The return type for the performWebSearch function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { search as duckDuckScrapeSearch, type SearchOptions, type SafeSearchType } from 'duck-duck-scrape';

// Schema for the tool's input
const PerformWebSearchInputSchema = z.object({
  query: z.string().describe('The search query.'),
  verbose: z.boolean().optional().describe('Enable verbose logging for the tool.'),
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
  webResults: z.array(WebSearchResultItemSchema).max(10).describe('An array of web search results (max 10).'),
  images: z.array(ImageResultItemSchema).max(20).optional().describe('An array of image search results (max 20).'),
});
export type PerformWebSearchOutput = z.infer<typeof PerformWebSearchOutputSchema>;

/**
 * Wrapper function to call the performWebSearchTool's logic.
 */
export async function performWebSearch(input: PerformWebSearchInput): Promise<PerformWebSearchOutput> {
  if (input.verbose) {
    console.log(`[VERBOSE TOOL - performWebSearch wrapper] Input:`, JSON.stringify(input, null, 2));
  }
  const result = await performWebSearchToolHandler(input);
  if (input.verbose) {
    console.log(`[VERBOSE TOOL - performWebSearch wrapper] Output:`, JSON.stringify(result, null, 2));
  }
  return result;
}

const MAX_WEB_RESULTS = 10;
const MAX_IMAGES_TO_FETCH = 20;

async function performWebSearchToolHandler(input: PerformWebSearchInput): Promise<PerformWebSearchOutput> {
  if (input.verbose) {
    console.log(`[VERBOSE TOOL - performWebSearchToolHandler] Starting for query: "${input.query}"`);
  }
  const googleApiKey = process.env.SEARCH_API_KEY;
  const googleSearchEngineId = process.env.SEARCH_ENGINE_ID;
  const pexelsApiKey = process.env.PEXELS_API_KEY;

  let webResults: WebSearchResultItem[] = [];
  let images: ImageResultItem[] = [];
  let googleSearchData: any = null;

  if (googleApiKey && googleSearchEngineId && googleSearchEngineId !== 'YOUR_SEARCH_ENGINE_ID') {
    try {
      if (input.verbose) console.log(`[VERBOSE TOOL] Fetching web results from Google Custom Search for query: "${input.query}"`);
      const googleSearchUrl = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleSearchEngineId}&q=${encodeURIComponent(input.query)}&num=${MAX_WEB_RESULTS}`;
      if (input.verbose) console.log(`[VERBOSE TOOL] Google Search URL: ${googleSearchUrl}`);
      const response = await fetch(googleSearchUrl);

      if (!response.ok) {
        const errorData = await response.text();
        console.error(`Google Search API request failed with status ${response.status}: ${errorData}`);
        if (input.verbose) console.log(`[VERBOSE TOOL] Google Search API error response text: ${errorData}`);
      } else {
        googleSearchData = await response.json();
        if (input.verbose) console.log('[VERBOSE TOOL] Google Search API Raw Response:', JSON.stringify(googleSearchData, null, 2));
        
        if (googleSearchData.items && googleSearchData.items.length > 0) {
          webResults = googleSearchData.items.map((item: any): WebSearchResultItem => ({
            title: item.title,
            link: item.link,
            snippet: item.snippet,
          }));
          console.log(`Fetched ${webResults.length} web result(s) from Google.`);
        } else {
          console.log(`No web results found on Google for "${input.query}".`);
        }
      }
    } catch (error) {
      console.error('Error fetching web search results from Google:', error);
      if (input.verbose) console.log('[VERBOSE TOOL] Exception during Google Search API call:', error);
    }
  } else {
    let warningMessage = 'Google Custom Search not configured: ';
    if (!googleApiKey) warningMessage += 'SEARCH_API_KEY missing. ';
    if (!googleSearchEngineId || googleSearchEngineId === 'YOUR_SEARCH_ENGINE_ID') warningMessage += 'SEARCH_ENGINE_ID missing or placeholder. ';
    console.warn(`${warningMessage}Will attempt DuckDuckScrape for web results.`);
    if (input.verbose) console.log(`[VERBOSE TOOL] ${warningMessage}`);
  }

  if (webResults.length === 0) {
    try {
      if (input.verbose) console.log(`[VERBOSE TOOL] Google Search failed or returned no results. Fetching web results from DuckDuckScrape for query: "${input.query}"`);
      const safeSearchValue: SafeSearchType = 'moderate';
      const ddgOptions: SearchOptions = {
        safeSearch: safeSearchValue,
        offset: 0,
      };
      const ddgWebResults = await duckDuckScrapeSearch(input.query, ddgOptions);
      if (input.verbose) console.log('[VERBOSE TOOL] DuckDuckScrape Raw Response:', JSON.stringify(ddgWebResults, null, 2));

      if (ddgWebResults && ddgWebResults.results && ddgWebResults.results.length > 0) {
        webResults = ddgWebResults.results
          .slice(0, MAX_WEB_RESULTS)
          .map((item: any): WebSearchResultItem => ({
            title: item.title,
            link: item.url, 
            snippet: item.description, 
          }));
        console.log(`Fetched ${webResults.length} web result(s) from DuckDuckScrape.`);
      } else {
        console.log(`No web results found on DuckDuckScrape for "${input.query}".`);
      }
    } catch (error) {
      console.error('Error fetching web search results from DuckDuckScrape:', error);
      if (input.verbose) console.log('[VERBOSE TOOL] Exception during DuckDuckScrape call:', error);
    }
  }
  
  if (webResults.length === 0) {
      console.warn('No web results from Google or DuckDuckScrape. Returning mock web results.');
      if (input.verbose) console.log('[VERBOSE TOOL] Using mock web results.');
      webResults = getMockSearchResults(input.query).webResults;
  }


  if (googleSearchData?.items) {
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
    if (input.verbose) console.log(`[VERBOSE TOOL] Extracted ${images.length} image(s) from Google Custom Search results data.`);
  }

  if (images.length < MAX_IMAGES_TO_FETCH && pexelsApiKey && pexelsApiKey !== "YOUR_PEXELS_API_KEY_HERE") {
    const imagesNeededFromPexels = MAX_IMAGES_TO_FETCH - images.length;
    try {
      if (input.verbose) console.log(`[VERBOSE TOOL] Attempting to fetch up to ${imagesNeededFromPexels} image(s) from Pexels for query: "${input.query}"`);
      const pexelsUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(input.query)}&per_page=${imagesNeededFromPexels}`;
      if (input.verbose) console.log(`[VERBOSE TOOL] Pexels API URL: ${pexelsUrl}`);
      const pexelsResponse = await fetch(pexelsUrl, {
        headers: { Authorization: pexelsApiKey }
      });
      if (pexelsResponse.ok) {
        const pexelsData = await pexelsResponse.json();
        if (input.verbose) console.log('[VERBOSE TOOL] Pexels API Raw Response:', JSON.stringify(pexelsData, null, 2));
        if (pexelsData.photos && pexelsData.photos.length > 0) {
          let pexelsImagesAdded = 0;
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
                  pexelsImagesAdded++;
            }
          });
          if (input.verbose) console.log(`[VERBOSE TOOL] Fetched and added ${pexelsImagesAdded} image(s) from Pexels.`);
        } else {
          if (input.verbose) console.log(`[VERBOSE TOOL] No images found on Pexels for "${input.query}".`);
        }
      } else {
        const pexelsError = await pexelsResponse.text();
        console.error(`Pexels API request failed for query "${input.query}" with status ${pexelsResponse.status}: ${pexelsError}`);
        if (input.verbose) console.log(`[VERBOSE TOOL] Pexels API error response text: ${pexelsError}`);
      }
    } catch (e) {
      console.error(`Error fetching from Pexels for query "${input.query}":`, e);
      if (input.verbose) console.log(`[VERBOSE TOOL] Exception during Pexels API call:`, e);
    }
  } else if (images.length < MAX_IMAGES_TO_FETCH && (!pexelsApiKey || pexelsApiKey === "YOUR_PEXELS_API_KEY_HERE")) {
     console.warn("PEXELS_API_KEY not set or is a placeholder. Skipping Pexels image search as fallback.");
     if (input.verbose) console.log("[VERBOSE TOOL] Pexels API key not set, skipping.");
  }

  if (images.length === 0 && webResults.length > 0) {
    if (input.verbose) console.log("[VERBOSE TOOL] No images fetched from Google or Pexels. Providing placeholder images.");
    const safeQuery = input.query || "image";
    images = Array.from({ length: Math.min(MAX_IMAGES_TO_FETCH, 6) }).map((_, i) => ({ 
        imageUrl: `https://placehold.co/300x200.png?text=${encodeURIComponent(safeQuery.substring(0,10))}-${i+1}`,
        altText: `Placeholder image for ${safeQuery} ${i+1}`,
        sourcePlatform: "Placeholder",
        sourceUrl: `https://placehold.co/`
    }));
  } else if (images.length === 0 && webResults.length === 0) {
    console.warn("No web results and no real images, using mock images from getMockSearchResults.");
    if (input.verbose) console.log("[VERBOSE TOOL] No web results and no real images, using mock images.");
    images = getMockSearchResults(input.query).images || [];
  }
  
  if (images.length > MAX_IMAGES_TO_FETCH) {
    images = images.slice(0, MAX_IMAGES_TO_FETCH);
  }

  if (input.verbose) console.log("[VERBOSE TOOL] Final images being returned by performWebSearchToolHandler:", JSON.stringify(images.map(img => ({url:img.imageUrl, source:img.sourcePlatform, alt: img.altText?.substring(0,30)})), null, 2));
  return { webResults, images };
}

function getMockSearchResults(query: string): PerformWebSearchOutput {
  const encodedQuery = encodeURIComponent(query);
  const safeQuery = query || "mock";
  return {
    webResults: Array.from({ length: MAX_WEB_RESULTS }).map((_, i) => ({
      title: `Mock Web Result ${i + 1} for: ${safeQuery}`,
      link: `https://example.com/mock-web${i+1}?q=${encodedQuery}`,
      snippet: `This is mock web search result snippet ${i+1}. Configure your Search API (SEARCH_API_KEY and SEARCH_ENGINE_ID in environment variables) and/or DuckDuckScrape for real results.`,
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
    description: 'Performs a web search for text results, primarily using Google Custom Search and falling back to DuckDuckScrape. Fetches related images, prioritizing images found within Google search results, then Pexels. Provides placeholders if no images are sourced.',
    inputSchema: PerformWebSearchInputSchema,
    outputSchema: PerformWebSearchOutputSchema,
  },
  performWebSearchToolHandler
);

