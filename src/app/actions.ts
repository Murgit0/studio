
// src/app/actions.ts
"use server";

import { z } from "zod";

import { generateAnswer, type GenerateAnswerInput as FlowGenerateAnswerInput, type GenerateAnswerOutput } from "@/ai/flows/generate-answer-flow";
import { generateSearchResults as fetchWebAndImageResults, type PerformWebSearchInput as FlowPerformWebSearchInput, type PerformWebSearchOutput } from "@/ai/flows/generate-search-results-flow";
import { sortSearchResults, type SortSearchResultsInput as FlowSortSearchResultsInput, type SortSearchResultsOutput } from "@/ai/flows/sort-search-results-flow"; 

// --- Schemas and Types for generate-answer-flow ---
const ActionGenerateAnswerInputSchema = z.object({
  query: z.string().describe('The user query for which to generate an answer.'),
  verbose: z.boolean().optional().describe('Enable verbose logging for the flow.'),
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
  images: z.array(ImageResultItemSchema).max(20).optional().describe('An array of image search results (max 20).'),
});
export type GenerateSearchResultsOutput = z.infer<typeof GenerateSearchResultsOutputSchema>;
// --- End Schemas and Types from generate-search-results-flow.ts ---


// --- Schemas for sortSearchResults input and output validation ---
const LocationDataSchema = z.object({
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  error: z.string().optional(),
}).optional();

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
});
// --- End Schemas for sortSearchResults ---


const processSearchQueryInputSchema = z.object({
  query: z.string().min(1, "Query is required."),
  verbose: z.boolean().optional(),
  location: LocationDataSchema,
  deviceInfo: DeviceInfoSchema,
});

export type ProcessSearchQueryInput = z.infer<typeof processSearchQueryInputSchema>;

export interface SearchActionResult {
  answer?: GenerateAnswerOutput;
  searchResults?: GenerateSearchResultsOutput;
  error?: string;
}

export async function processSearchQuery(
  input: ProcessSearchQueryInput
): Promise<SearchActionResult> {
  const validatedInput = processSearchQueryInputSchema.safeParse(input);

  if (!validatedInput.success) {
    return { error: validatedInput.error.errors.map(e => e.message).join(", ") };
  }

  const { query, verbose, location, deviceInfo } = validatedInput.data;
  if (verbose) {
    console.log(`[VERBOSE ACTION] processSearchQuery called with query: "${query}", verbose: ${verbose}, location: ${JSON.stringify(location)}, deviceInfo: ${JSON.stringify(deviceInfo)}`);
  }

  try {
    // For flows that don't use location/deviceInfo, we only pass query and verbose
    const baseFlowArgs = { query, verbose };
    
    const [answerResult, searchResultsCombined] = await Promise.allSettled([
      generateAnswer(baseFlowArgs as FlowGenerateAnswerInput), 
      fetchWebAndImageResults(baseFlowArgs as FlowPerformWebSearchInput)
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
            if (verbose) console.log(`[VERBOSE ACTION] Attempting to AI sort ${parsedSearchResults.webResults.length} web results for query: "${query}" with location and device info.`);
            
            const sortInput: FlowSortSearchResultsInput = { 
                query, 
                webResults: parsedSearchResults.webResults,
                verbose,
                location: location, // Pass location
                deviceInfo: deviceInfo, // Pass deviceInfo
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


    let errorMessages: string[] = [];
    if (answerResult.status === 'rejected') {
      console.error("Error generating answer:", answerResult.reason);
      const reasonText = answerResult.reason instanceof Error ? answerResult.reason.message : String(answerResult.reason);
      errorMessages.push(`AI Answer generation failed: ${reasonText.substring(0,150)}`);
       if (verbose) console.log('[VERBOSE ACTION] Answer generation rejected:', answerResult.reason);
    }
    if (searchResultsCombined.status === 'rejected') {
      console.error("Error generating search results:", searchResultsCombined.reason);
      const reasonText = searchResultsCombined.reason instanceof Error ? searchResultsCombined.reason.message : String(searchResultsCombined.reason);
      errorMessages.push(`Search Results generation failed: ${reasonText.substring(0,150)}`);
      if (verbose) console.log('[VERBOSE ACTION] Search results generation rejected:', searchResultsCombined.reason);
    } else if (searchResultsCombined.status === 'fulfilled' && !GenerateSearchResultsOutputSchema.safeParse(searchResultsCombined.value).success) {
      errorMessages.push(`Search Results format error. Check tool output logs.`);
    }
    
    if (!answer && 
        (!parsedSearchResults || 
         ((!parsedSearchResults.webResults || parsedSearchResults.webResults.length === 0) && 
          (!parsedSearchResults.images || parsedSearchResults.images.length === 0))) && 
        errorMessages.length > 0) {
      if (verbose) console.log('[VERBOSE ACTION] No answer and no search results, returning error.');
      return { error: errorMessages.join("; ") };
    }
    
    if (verbose) console.log('[VERBOSE ACTION] processSearchQuery completed.');
    return {
      answer,
      searchResults: parsedSearchResults,
      error: errorMessages.length > 0 ? errorMessages.join("; ") : undefined,
    };

  } catch (e) {
    console.error("Error processing search query:", e);
    const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred.";
    if (verbose) console.log('[VERBOSE ACTION] Outer catch block error in processSearchQuery:', e);
    return { error: `An error occurred while processing your request: ${errorMessage.substring(0,200)}` };
  }
}
