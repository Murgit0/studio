
// src/app/actions.ts
"use server";

import { z } from "zod";

import { generateAnswer } from "@/ai/flows/generate-answer-flow";
import { generateSearchResults as fetchWebAndImageResults } from "@/ai/flows/generate-search-results-flow";
import { sortSearchResults } from "@/ai/flows/sort-search-results-flow"; // Import only the function and types

// --- Schemas and Types for generate-answer-flow ---
const GenerateAnswerInputSchema = z.object({
  query: z.string().describe('The user query for which to generate an answer.'),
});
export type GenerateAnswerInput = z.infer<typeof GenerateAnswerInputSchema>;

const GenerateAnswerOutputSchema = z.object({
  answer: z.string().describe('A balanced and informative answer to the user query, without references.'),
});
export type GenerateAnswerOutput = z.infer<typeof GenerateAnswerOutputSchema>;
// --- End Schemas and Types from generate-answer-flow.ts ---

// --- Schemas and Types for fetchWebAndImageResults (formerly generate-search-results-flow) ---
const GenerateSearchResultsInputSchema = z.object({
  query: z.string().describe('The user query for which to generate search results.'),
});
export type GenerateSearchResultsInput = z.infer<typeof GenerateSearchResultsInputSchema>;

// Schema for a single web search result item (text-focused) - Defined locally
const WebSearchResultItemSchema = z.object({
  title: z.string().describe('The title of the search result.'),
  link: z.string().describe('The URL of the search result.'),
  snippet: z.string().describe('A short, descriptive snippet for the search result.'),
});
// Type for WebSearchResultItem can be inferred locally if needed, e.g., type WebSearchResultItem = z.infer<typeof WebSearchResultItemSchema>;


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

const GenerateSearchResultsOutputSchema = z.object({
  webResults: z.array(WebSearchResultItemSchema).max(10).describe('An array of web search results (max 10).'),
  images: z.array(ImageResultItemSchema).max(20).optional().describe('An array of image search results (max 20).'),
});
export type GenerateSearchResultsOutput = z.infer<typeof GenerateSearchResultsOutputSchema>;
// --- End Schemas and Types from generate-search-results-flow.ts ---

// --- Local Schemas for sortSearchResults input and output validation ---
const LocalSortSearchResultsInputSchema = z.object({
  query: z.string().describe('The original user query.'),
  webResults: z.array(WebSearchResultItemSchema).describe('The list of web search results to be sorted.'),
});

const LocalSortSearchResultsOutputSchema = z.object({
  sortedWebResults: z.array(WebSearchResultItemSchema).describe('The web search results, sorted by relevance to the query.'),
});
// --- End Local Schemas for sortSearchResults ---


const processSearchQueryInputSchema = z.object({
  query: z.string().min(1, "Query is required."),
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

  const { query } = validatedInput.data;

  try {
    const [answerResult, searchResultsCombined] = await Promise.allSettled([
      generateAnswer({ query }),
      fetchWebAndImageResults({ query })
    ]);

    const answer = answerResult.status === 'fulfilled' ? answerResult.value : undefined;
    
    let parsedSearchResults: GenerateSearchResultsOutput | undefined;
    if (searchResultsCombined.status === 'fulfilled') {
      const validation = GenerateSearchResultsOutputSchema.safeParse(searchResultsCombined.value);
      if (validation.success) {
        parsedSearchResults = validation.data;

        // Attempt to sort the web results if they exist
        if (parsedSearchResults.webResults && parsedSearchResults.webResults.length > 0) {
          try {
            console.log(`Attempting to AI sort ${parsedSearchResults.webResults.length} web results for query: "${query}"`);
            const sortInput = { query, webResults: parsedSearchResults.webResults };
            
            // Validate input for sortSearchResults using local schema
            const validatedSortInput = LocalSortSearchResultsInputSchema.safeParse(sortInput);
            if (!validatedSortInput.success) {
                console.error("AI Sort Input Validation Error (actions.ts):", validatedSortInput.error.flatten());
            } else {
                const sortedResultsAction = await sortSearchResults(validatedSortInput.data);
                // Validate output of sortSearchResults using local schema
                const validatedSortOutput = LocalSortSearchResultsOutputSchema.safeParse(sortedResultsAction);
                if (validatedSortOutput.success) {
                    parsedSearchResults.webResults = validatedSortOutput.data.sortedWebResults;
                    console.log("Web results AI sorted successfully.");
                } else {
                    console.warn("AI sorting of web results failed to produce valid output (actions.ts), using original order. Validation error:", validatedSortOutput.error.flatten());
                }
            }
          } catch (sortError) {
            console.error("Error during AI sorting of web results (actions.ts), using original order:", sortError);
            // Proceed with unsorted results if sorting fails
          }
        }

      } else {
        console.error("Search results format error (actions.ts):", validation.error.flatten());
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
    }
    if (searchResultsCombined.status === 'rejected') {
      console.error("Error generating search results:", searchResultsCombined.reason);
      const reasonText = searchResultsCombined.reason instanceof Error ? searchResultsCombined.reason.message : String(searchResultsCombined.reason);
      errorMessages.push(`Search Results generation failed: ${reasonText.substring(0,150)}`);
    } else if (searchResultsCombined.status === 'fulfilled' && !GenerateSearchResultsOutputSchema.safeParse(searchResultsCombined.value).success) {
      errorMessages.push(`Search Results format error. Check tool output logs.`);
    }
    
    if (!answer && 
        (!parsedSearchResults || 
         ((!parsedSearchResults.webResults || parsedSearchResults.webResults.length === 0) && 
          (!parsedSearchResults.images || parsedSearchResults.images.length === 0))) && 
        errorMessages.length > 0) {
      return { error: errorMessages.join("; ") };
    }
    
    return {
      answer,
      searchResults: parsedSearchResults,
      error: errorMessages.length > 0 ? errorMessages.join("; ") : undefined,
    };

  } catch (e) {
    console.error("Error processing search query:", e);
    const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred.";
    return { error: `An error occurred while processing your request: ${errorMessage.substring(0,200)}` };
  }
}
