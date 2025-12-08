
// src/app/actions.ts
"use server";

import { z } from "zod";

import { generateAnswer, type GenerateAnswerInput as FlowGenerateAnswerInput, type GenerateAnswerOutput } from "@/ai/flows/generate-answer-flow";
import { generateSearchResults as fetchWebAndImageResults, type PerformWebSearchInput as FlowPerformWebSearchInput, type PerformWebSearchOutput } from "@/ai/flows/generate-search-results-flow";
import { sortSearchResults, type SortSearchResultsInput as FlowSortSearchResultsInput, type SortSearchResultsOutput } from "@/ai/flows/sort-search-results-flow"; 
import { generateNewsResults, type PerformNewsSearchInput as FlowPerformNewsSearchInput } from "@/ai/flows/generate-news-results-flow";
import { filterArticles, type FilterArticlesInput } from "@/ai/flows/filter-articles-flow";
import { generateChatResponse, type GenerateChatResponseInput, type GenerateChatResponseOutput, type ChatMessage } from "@/ai/flows/generate-chat-response-flow";
import { generateAdvancedSearchResults } from "@/ai/flows/generate-advanced-search-results-flow";
import type { PerformAdvancedSearchInput, PerformAdvancedSearchOutput } from "@/ai/tools/perform-advanced-search";
import { summarizeAdvancedResults, type SummarizeAdvancedResultsInput } from "@/ai/flows/summarize-advanced-search-flow";


const GENERIC_ERROR_MESSAGE = "Contact developer and lodge an issue";

export type { ChatMessage };

// --- Schemas and Types for generate-answer-flow ---
const ActionGenerateAnswerInputSchema = z.object({
  query: z.string().describe('The user query for which to generate an answer.'),
  verbose: z.boolean().optional().describe('Enable verbose logging for the flow.'),
  recentSearches: z.array(z.string()).optional().describe('A list of recent search queries by the user, for context.'),
});
// --- End Schemas and Types from generate-answer-flow.ts ---


// --- Schemas and Types for fetchWebAndImageResults (formerly generate-search-results-flow) ---
const ActionGenerateSearchResultsInputSchema = z.object({
  query: z.string().describe('The user query for which to generate search results.'),
  verbose: z.boolean().optional().describe('Enable verbose logging for the flow.'),
});

const WebSearchResultItemSchema = z.object({
  title: z.string().describe('The title of the search result.'),
  link: z.string().describe('The URL of the search result.'),
  snippet: z.string().describe('A short, descriptive snippet for the search result.'),
});

const ImageResultItemSchema = z.object({
  imageUrl: z.string().url().describe('URL of the image.'),
  altText: z.string().optional().describe('Alt text for the image.'),
  photographerName: z.string().optional().describe("The name of the image's photographer for attribution."),
  photographerUrl: z.string().url().optional().describe("A URL to the photographer's profile or source for attribution."),
  sourcePlatform: z.string().optional().describe("The platform the image was sourced from (e.g., Pexels, Unsplash, Google)."),
  sourceUrl: z.string().url().optional().describe("A URL to the image's page on the source platform for attribution or the web page it was found on."),
});
export type ImageResultItem = z.infer<typeof ImageResultItemSchema>;

const GenerateSearchResultsOutputSchema = z.object({
  webResults: z.array(WebSearchResultItemSchema).max(10).describe('An array of web search results (max 10).'),
  images: z.array(ImageResultItemSchema).max(30).optional().describe('An array of image search results (max 30).'),
});
export type GenerateSearchResultsOutput = z.infer<typeof GenerateSearchResultsOutputSchema>;
// --- End Schemas and Types from generate-search-results-flow.ts ---

// --- Schemas and Types for generate-news-results-flow.ts ---
const NewsArticleItemSchema = z.object({
  title: z.string().describe('The headline or title of the news article.'),
  description: z.string().nullable().describe('A brief description of the news article.'),
  url: z.string().url().describe('The direct URL to the news article.'),
  source: z.string().describe('The name of the news source (e.g., "The New York Times").'),
  publishedAt: z.string().describe('The publication date of the article in ISO 8601 format.'),
});
export type NewsArticleItem = z.infer<typeof NewsArticleItemSchema>;

const GenerateNewsResultsOutputSchema = z.object({
  articles: z.array(NewsArticleItemSchema).describe('An array of news articles relevant to the query.'),
});
export type GenerateNewsResultsOutput = z.infer<typeof GenerateNewsResultsOutputSchema>;
// --- End Schemas and Types from generate-news-results-flow.ts ---


// --- Schemas for sortSearchResults input and output validation ---
const LocationDataSchema = z.object({
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  error: z.string().optional(),
}).optional();
export type LocationData = z.infer<typeof LocationDataSchema>;


const DeviceInfoSchema = z.object({
  userAgent: z.string().optional(),
  screenWidth: z.number().optional(),
  screenHeight: z.number().optional(),
  os: z.string().optional().describe("The operating system of the user's device, if identifiable."),
}).optional();

const ActionSortSearchResultsInputSchema = z.object({
  query: z.string().describe('The original user query.'),
  webResults: z.array(WebSearchResultItemSchema).describe('The list of web search results to be sorted.'),
  verbose: z.boolean().optional().describe('Enable verbose logging for the flow.'),
  location: LocationDataSchema,
  deviceInfo: DeviceInfoSchema,
  recentSearches: z.array(z.string()).optional().describe('A list of recent search queries by the user, for context.'),
});
// --- End Schemas for sortSearchResults ---


const processSearchQueryInputSchema = z.object({
  query: z.string().min(1, "Query is required."),
  verbose: z.boolean().optional(),
  location: LocationDataSchema,
  deviceInfo: DeviceInfoSchema,
  recentSearches: z.array(z.string()).optional(),
});

export type ProcessSearchQueryInput = z.infer<typeof processSearchQueryInputSchema>;

export interface SearchActionResult {
  answer?: GenerateAnswerOutput;
  searchResults?: GenerateSearchResultsOutput;
  newsResults?: GenerateNewsResultsOutput;
  advancedSearchResults?: PerformAdvancedSearchOutput;
  error?: string;
}

export async function processSearchQuery(
  input: ProcessSearchQueryInput
): Promise<SearchActionResult> {
  const validatedInput = processSearchQueryInputSchema.safeParse(input);

  if (!validatedInput.success) {
    console.error("Input validation error:", validatedInput.error.errors);
    return { error: GENERIC_ERROR_MESSAGE };
  }

  const { query, verbose, location, deviceInfo, recentSearches } = validatedInput.data;
  if (verbose) {
    console.log(`[VERBOSE ACTION] processSearchQuery called with query: "${query}", verbose: ${verbose}, location: ${JSON.stringify(location)}, deviceInfo: ${JSON.stringify(deviceInfo)}, recentSearches: ${JSON.stringify(recentSearches)}`);
  }

  try {
    const commonArgs = { query, verbose }; 
    const answerArgs = { ...commonArgs, recentSearches }; 
    
    const [answerResult, searchResultsCombined] = await Promise.allSettled([
      generateAnswer(answerArgs as FlowGenerateAnswerInput), 
      fetchWebAndImageResults(commonArgs as FlowPerformWebSearchInput),
    ]);

    const answer = answerResult.status === 'fulfilled' ? answerResult.value : undefined;
    if (verbose && answerResult.status === 'fulfilled') {
        console.log('[VERBOSE ACTION] Answer generation successful.');
    }
    
    let parsedSearchResults: GenerateSearchResultsOutput | undefined;
    if (searchResultsCombined.status === 'fulfilled') {
      const validation = GenerateSearchResultsOutputSchema.safeParse(searchResultsCombined.value);
      if (validation.success) {
        parsedSearchResults = validation.data;
        if (verbose) console.log('[VERBOSE ACTION] Search results fetching and parsing successful.');

        if (parsedSearchResults.webResults && parsedSearchResults.webResults.length > 0) {
          try {
            if (verbose) console.log(`[VERBOSE ACTION] Attempting to AI sort ${parsedSearchResults.webResults.length} web results for query: "${query}" with location, device info, and recent searches.`);
            
            const sortInput: FlowSortSearchResultsInput = { 
                query, 
                webResults: parsedSearchResults.webResults,
                verbose,
                location: location, 
                deviceInfo: deviceInfo, 
                recentSearches: recentSearches, 
            };
            
            const sortedResultsAction = await sortSearchResults(sortInput);
            
            parsedSearchResults.webResults = sortedResultsAction.sortedWebResults;
            if (verbose) console.log("[VERBOSE ACTION] Web results AI sorted successfully.");

          } catch (sortError) {
            console.error("Error during AI sorting of web results (actions.ts):", sortError);
            if (verbose) console.log("[VERBOSE ACTION] AI sorting of web results failed. Using original order.", sortError);
          }
        }

      } else {
        console.error("Search results format error (actions.ts):", validation.error.flatten());
        if (verbose) console.log("[VERBOSE ACTION] Search results format error. Raw data:", searchResultsCombined.value);
         const rawData = searchResultsCombined.value as any;
         parsedSearchResults = { 
           webResults: Array.isArray(rawData?.webResults) ? rawData.webResults : [], 
           images: Array.isArray(rawData?.images) ? rawData.images : [] 
         };
         console.warn("Attempted graceful degradation for search results format error. Parsed:", parsedSearchResults);
      }
    }

    let hasErrors = false;
    if (answerResult.status === 'rejected') {
      console.error("Error generating answer:", answerResult.reason);
      hasErrors = true;
      if (verbose) console.log('[VERBOSE ACTION] Answer generation rejected:', answerResult.reason);
    }
    if (searchResultsCombined.status === 'rejected') {
      console.error("Error generating search results:", searchResultsCombined.reason);
      hasErrors = true;
      if (verbose) console.log('[VERBOSE ACTION] Search results generation rejected:', searchResultsCombined.reason);
    } else if (searchResultsCombined.status === 'fulfilled' && !GenerateSearchResultsOutputSchema.safeParse(searchResultsCombined.value).success) {
      hasErrors = true;
    }
     
    if (hasErrors) {
      if (verbose) console.log('[VERBOSE ACTION] One or more operations failed. Returning generic error.');
      return { 
        answer, // Return any partial data we got
        searchResults: parsedSearchResults,
        error: GENERIC_ERROR_MESSAGE
      };
    }
    
    if (verbose) console.log('[VERBOSE ACTION] processSearchQuery completed.');
    return {
      answer,
      searchResults: parsedSearchResults,
    };

  } catch (e) {
    console.error("Outer error processing search query:", e);
    if (verbose) console.log('[VERBOSE ACTION] Outer catch block error in processSearchQuery:', e);
    return { error: GENERIC_ERROR_MESSAGE };
  }
}

export async function performAdvancedSearch(
  input: PerformAdvancedSearchInput
): Promise<SearchActionResult> {
  if (input.verbose) {
    console.log(`[VERBOSE ACTION] performAdvancedSearch called with query: "${input.query}"`);
  }
  try {
    const advancedSearchResults = await generateAdvancedSearchResults(input);
    return {
      advancedSearchResults
    };
  } catch (e) {
    console.error("Outer error processing advanced search query:", e);
    if (input.verbose) console.log('[VERBOSE ACTION] Outer catch block error in performAdvancedSearch:', e);
    return { error: GENERIC_ERROR_MESSAGE };
  }
}

export async function getNewsFeed(
  input: Omit<FlowPerformNewsSearchInput, 'query'>
): Promise<GenerateNewsResultsOutput> {
  try {
    // We can use a generic query for a general news feed.
    const news = await generateNewsResults({ query: 'latest top headlines', verbose: input.verbose });
    
    // Validate the initial fetch
    const initialValidation = GenerateNewsResultsOutputSchema.safeParse(news);
    if (!initialValidation.success) {
      console.error("News feed initial format error (actions.ts):", initialValidation.error.flatten());
      throw new Error("News feed format error.");
    }
    
    if (initialValidation.data.articles.length === 0) {
      return { articles: [] };
    }

    if (input.verbose) {
        console.log(`[VERBOSE ACTION] getNewsFeed: Fetched ${initialValidation.data.articles.length} articles. Now attempting to filter out financial news.`);
    }
    
    // Filter out financial news using the AI flow
    const filterInput: FilterArticlesInput = {
        articles: initialValidation.data.articles,
        categoryToExclude: 'finance',
        verbose: input.verbose,
    };
    const filteredResult = await filterArticles(filterInput);
    
    const finalValidation = GenerateNewsResultsOutputSchema.safeParse({ articles: filteredResult.filteredArticles });

    if (!finalValidation.success) {
        console.error("News feed filtered format error (actions.ts):", finalValidation.error.flatten());
        throw new Error("Filtered news feed format error.");
    }
    
    if (input.verbose) {
        console.log(`[VERBOSE ACTION] getNewsFeed: Filtering complete. ${finalValidation.data.articles.length} articles remaining.`);
    }

    return finalValidation.data;

  } catch (error) {
    console.error("Error fetching or filtering news feed:", error);
    // Return empty articles array on error to prevent UI crash
    return { articles: [] };
  }
}

export async function getStockImages(
  input: Omit<FlowPerformWebSearchInput, 'query'>
): Promise<GenerateSearchResultsOutput> {
   try {
    // Use a generic query for Pexels
    const images = await fetchWebAndImageResults({ query: 'nature', verbose: input.verbose });
    const validation = GenerateSearchResultsOutputSchema.safeParse(images);
     if (!validation.success) {
      console.error("Stock images format error (actions.ts):", validation.error.flatten());
      throw new Error("Stock images format error.");
    }
    // We only care about images for this action
    return { webResults: [], images: validation.data.images };
  } catch (error) {
    console.error("Error fetching stock images:", error);
    return { webResults: [], images: [] };
  }
}

export async function sendChatMessage(
  input: GenerateChatResponseInput
): Promise<GenerateChatResponseOutput> {
  try {
    if (input.verbose) {
      console.log(`[VERBOSE ACTION] sendChatMessage called with message: "${input.message}"`);
    }
    const response = await generateChatResponse(input);
    return response;
  } catch (error) {
    console.error("Error in sendChatMessage action:", error);
    return { response: GENERIC_ERROR_MESSAGE };
  }
}

export async function summarizeAdvancedResultsAction(
  input: SummarizeAdvancedResultsInput
) {
  try {
    if (input.verbose) {
      console.log(`[VERBOSE ACTION] summarizeAdvancedResultsAction called for query: "${input.query}"`);
    }
    const response = await summarizeAdvancedResults(input);
    return response;
  } catch (error) {
    console.error("Error in summarizeAdvancedResultsAction:", error);
    return { summary: `An error occurred while generating the summary: ${GENERIC_ERROR_MESSAGE}` };
  }
}
