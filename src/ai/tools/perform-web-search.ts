
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
const MAX_API_ATTEMPTS = 2; // Max 1 initial + 1 retry
const RETRY_DELAY_MS = 500;

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

  // --- Google Custom Search with Retry ---
  if (googleApiKey && googleSearchEngineId && googleSearchEngineId !== 'YOUR_SEARCH_ENGINE_ID') {
    let attempts = 0;
    while (attempts < MAX_API_ATTEMPTS && webResults.length === 0) {
      attempts++;
      if (input.verbose && attempts > 1) {
        console.log(`[VERBOSE TOOL] Retrying Google Custom Search (attempt ${attempts}/${MAX_API_ATTEMPTS}) for query: "${input.query}"`);
      }
      try {
        const googleSearchUrl = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleSearchEngineId}&q=${encodeURIComponent(input.query)}&num=${MAX_WEB_RESULTS}`;
        if (input.verbose) console.log(`[VERBOSE TOOL] Google Search URL (attempt ${attempts}): ${googleSearchUrl}`);
        const response = await fetch(googleSearchUrl);

        if (!response.ok) {
          if (attempts >= MAX_API_ATTEMPTS) {
            const errorData = await response.text();
            console.error(`Google Search API request failed on final attempt ${attempts}/${MAX_API_ATTEMPTS} with status ${response.status}: ${errorData}`);
            if (input.verbose) console.log(`[VERBOSE TOOL] Google Search API error response text (attempt ${attempts}): ${errorData}`);
          }
          // If not the last attempt, allow loop to retry
        } else {
          googleSearchData = await response.json();
          if (input.verbose) console.log(`[VERBOSE TOOL] Google Search API Raw Response (attempt ${attempts}):`, JSON.stringify(googleSearchData, null, 2));
          
          if (googleSearchData.items && googleSearchData.items.length > 0) {
            webResults = googleSearchData.items.map((item: any): WebSearchResultItem => ({
              title: item.title,
              link: item.link,
              snippet: item.snippet,
            }));
            console.log(`Fetched ${webResults.length} web result(s) from Google (attempt ${attempts}/${MAX_API_ATTEMPTS}).`);
            break; // Success, exit retry loop
          } else {
            if (attempts >= MAX_API_ATTEMPTS) {
              console.log(`No web results found on Google after ${attempts} attempts for "${input.query}".`);
            }
          }
        }
      } catch (error) {
        if (attempts >= MAX_API_ATTEMPTS) {
          console.error(`Error fetching web search results from Google on final attempt ${attempts}/${MAX_API_ATTEMPTS}:`, error);
          if (input.verbose) console.log(`[VERBOSE TOOL] Exception during Google Search API call (attempt ${attempts}):`, error);
        }
      }
      if (webResults.length === 0 && attempts < MAX_API_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS)); 
      }
    }
  } else {
    let warningMessage = 'Google Custom Search not configured: ';
    if (!googleApiKey) warningMessage += 'SEARCH_API_KEY missing. ';
    if (!googleSearchEngineId || googleSearchEngineId === 'YOUR_SEARCH_ENGINE_ID') warningMessage += 'SEARCH_ENGINE_ID missing or placeholder. ';
    // Only log this warning if Google Search was intended but not configured.
    if (googleApiKey || googleSearchEngineId) {
        console.warn(`${warningMessage}Will attempt DuckDuckScrape for web results.`);
        if (input.verbose) console.log(`[VERBOSE TOOL] ${warningMessage}`);
    }
  }

  // --- Fallback to DuckDuckScrape if Google Search failed or no results ---
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
  
  // --- Mock web results if all above fail ---
  if (webResults.length === 0) {
      console.warn('No web results from Google or DuckDuckScrape. Returning mock web results.');
      if (input.verbose) console.log('[VERBOSE TOOL] Using mock web results.');
      webResults = getMockSearchResults(input.query).webResults;
  }

  // --- Image Extraction from Google Search Data (if available) ---
  if (googleSearchData?.items) {
    for (const item of googleSearchData.items) {
      if (images.length >= MAX_IMAGES_TO_FETCH) break;
      const cseImageSrc = item.pagemap?.cse_image?.[0]?.src;
      const cseThumbnailSrc = item.pagemap?.cse_thumbnail?.[0]?.src;
      const potentialImageUrl = cseImageSrc || cseThumbnailSrc;
      
      if (potentialImageUrl && !images.find(img => img.imageUrl === potentialImageUrl)) { 
        const imageEntryCandidate = {
          imageUrl: potentialImageUrl,
          altText: item.pagemap?.metatags?.[0]?.['og:image:alt'] || item.pagemap?.metatags?.[0]?.['twitter:image:alt'] || `Image from ${item.title}`,
          sourcePlatform: "Google",
          sourceUrl: item.link,
        };
        const parsedImageEntry = ImageResultItemSchema.safeParse(imageEntryCandidate);
        if (parsedImageEntry.success) {
          images.push(parsedImageEntry.data);
        } else {
          if (input.verbose) {
            console.warn(`[VERBOSE TOOL] Skipping Google CSE image due to schema validation failure. imageUrl: ${potentialImageUrl}, pageUrl: ${item.link}. Errors:`, parsedImageEntry.error.flatten().fieldErrors, "Input data:", imageEntryCandidate);
          }
        }
      }
    }
    if (input.verbose) console.log(`[VERBOSE TOOL] Extracted ${images.length} valid image(s) from Google Custom Search results data after schema validation.`);
  }

  // --- Pexels Image Search with Retry (if needed) ---
  if (images.length < MAX_IMAGES_TO_FETCH && pexelsApiKey && pexelsApiKey !== "YOUR_PEXELS_API_KEY_HERE") {
    let pexelsAttempts = 0;
    let pexelsCallSuccessfulInLoop = false; 

    while (pexelsAttempts < MAX_API_ATTEMPTS && !pexelsCallSuccessfulInLoop && (images.length < MAX_IMAGES_TO_FETCH)) {
      pexelsAttempts++;
      const imagesNeededFromPexels = MAX_IMAGES_TO_FETCH - images.length;
      if (imagesNeededFromPexels <= 0) break;

      if (input.verbose && pexelsAttempts > 1) {
        console.log(`[VERBOSE TOOL] Retrying Pexels API (attempt ${pexelsAttempts}/${MAX_API_ATTEMPTS}) for query: "${input.query}"`);
      }

      try {
        const pexelsUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(input.query)}&per_page=${imagesNeededFromPexels}`;
        if (input.verbose) console.log(`[VERBOSE TOOL] Pexels API URL (attempt ${pexelsAttempts}): ${pexelsUrl}`);
        const pexelsResponse = await fetch(pexelsUrl, {
          headers: { Authorization: pexelsApiKey }
        });

        if (pexelsResponse.ok) {
          pexelsCallSuccessfulInLoop = true; // Mark API call as successful for this iteration
          const pexelsData = await pexelsResponse.json();
          if (input.verbose) console.log(`[VERBOSE TOOL] Pexels API Raw Response (attempt ${pexelsAttempts}):`, JSON.stringify(pexelsData, null, 2));
          
          if (pexelsData.photos && pexelsData.photos.length > 0) {
            let pexelsImagesAddedThisAttempt = 0;
            pexelsData.photos.forEach((photo: any) => {
              if (images.length >= MAX_IMAGES_TO_FETCH) return;
              const pexelsImageCandidate = {
                  imageUrl: photo.src?.medium,
                  altText: photo.alt || `Image by ${photo.photographer} on Pexels`,
                  photographerName: photo.photographer,
                  photographerUrl: photo.photographer_url,
                  sourcePlatform: "Pexels",
                  sourceUrl: photo.url,
              };
              const parsedPexelsImage = ImageResultItemSchema.safeParse(pexelsImageCandidate);
              if (parsedPexelsImage.success) {
                  if (!images.find(img => img.imageUrl === parsedPexelsImage.data.imageUrl)) {
                      images.push(parsedPexelsImage.data);
                      pexelsImagesAddedThisAttempt++;
                  }
              } else {
                   if (input.verbose) {
                      console.warn(`[VERBOSE TOOL] Skipping Pexels image due to schema validation failure. imageUrl: ${photo.src?.medium}. Errors:`, parsedPexelsImage.error.flatten().fieldErrors, "Input data:", pexelsImageCandidate);
                  }
              }
            });
            if (input.verbose) console.log(`[VERBOSE TOOL] Fetched and added ${pexelsImagesAddedThisAttempt} valid image(s) from Pexels (attempt ${pexelsAttempts}).`);
          } else {
            if (input.verbose) console.log(`[VERBOSE TOOL] No images found on Pexels for "${input.query}" (attempt ${pexelsAttempts}).`);
          }
        } else { // !pexelsResponse.ok
          if (pexelsAttempts >= MAX_API_ATTEMPTS) {
            const pexelsError = await pexelsResponse.text();
            console.error(`Pexels API request failed on final attempt ${pexelsAttempts}/${MAX_API_ATTEMPTS} for query "${input.query}" with status ${pexelsResponse.status}: ${pexelsError}`);
            if (input.verbose) console.log(`[VERBOSE TOOL] Pexels API error response text (attempt ${pexelsAttempts}): ${pexelsError}`);
          }
          // If not the last attempt, loop will continue due to !pexelsCallSuccessfulInLoop
        }
      } catch (e) {
        if (pexelsAttempts >= MAX_API_ATTEMPTS) {
          console.error(`Error fetching from Pexels on final attempt ${pexelsAttempts}/${MAX_API_ATTEMPTS} for query "${input.query}":`, e);
          if (input.verbose) console.log(`[VERBOSE TOOL] Exception during Pexels API call (attempt ${pexelsAttempts}):`, e);
        }
        // If not the last attempt, loop will continue due to !pexelsCallSuccessfulInLoop
      }

      if (!pexelsCallSuccessfulInLoop && pexelsAttempts < MAX_API_ATTEMPTS && (images.length < MAX_IMAGES_TO_FETCH)) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS)); 
      }
    }
  } else if (images.length < MAX_IMAGES_TO_FETCH && (!pexelsApiKey || pexelsApiKey === "YOUR_PEXELS_API_KEY_HERE")) {
     // Only log this warning if Pexels was intended (key was empty placeholder or just missing)
     if (pexelsApiKey === "YOUR_PEXELS_API_KEY_HERE" || !pexelsApiKey) {
        console.warn("PEXELS_API_KEY not set or is a placeholder. Skipping Pexels image search.");
        if (input.verbose) console.log("[VERBOSE TOOL] Pexels API key not set/placeholder, skipping.");
     }
  }

  // --- Placeholder/Mock Images Logic ---
  if (images.length === 0 && webResults.length > 0) { // Only use placeholders if web results exist but no images
    if (input.verbose) console.log("[VERBOSE TOOL] No images fetched from Google or Pexels, but web results exist. Providing placeholder images.");
    const safeQuery = input.query || "image";
    images = Array.from({ length: Math.min(MAX_IMAGES_TO_FETCH, 6) }).map((_, i) => ({ 
        imageUrl: `https://placehold.co/300x200.png`,
        altText: `Placeholder image for ${safeQuery} ${i+1}`,
        sourcePlatform: "Placeholder",
        sourceUrl: `https://placehold.co/` 
    }));
  } else if (images.length === 0 && webResults.length > 0 && webResults[0]?.title?.startsWith("Mock Web Result")) { 
    // If web results are mock, and no real images, use mock images.
    if (input.verbose) console.log("[VERBOSE TOOL] Web results are mock and no real images, using mock images from getMockSearchResults.");
    images = getMockSearchResults(input.query).images || [];
  } else if (images.length === 0 && webResults.length === 0) { // No web results at all, also use mock images
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
        imageUrl: `https://placehold.co/300x200.png`,
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
    description: 'Performs a web search for text results, primarily using Google Custom Search (with retry) and falling back to DuckDuckScrape. Fetches related images, prioritizing images found within Google search results, then Pexels (with retry). Provides placeholders if no images are sourced.',
    inputSchema: PerformWebSearchInputSchema,
    outputSchema: PerformWebSearchOutputSchema,
  },
  performWebSearchToolHandler
);

