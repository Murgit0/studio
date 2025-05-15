// src/app/actions.ts
"use server";

import { z } from "zod";

import { generateAnswer } from "@/ai/flows/generate-answer-flow";
import { generateSearchResults } from "@/ai/flows/generate-search-results-flow.ts";

// --- Schemas and Types for generate-answer-flow ---
const GenerateAnswerInputSchema = z.object({
  query: z.string().describe('The user query for which to generate an answer.'),
});
export type GenerateAnswerInput = z.infer<typeof GenerateAnswerInputSchema>;

const GenerateAnswerOutputSchema = z.object({
  answer: z.string().describe('A concise, helpful answer to the user query.'),
});
export type GenerateAnswerOutput = z.infer<typeof GenerateAnswerOutputSchema>;
// --- End Schemas and Types from generate-answer-flow.ts ---

// --- Schemas and Types for generate-search-results-flow ---
const GenerateSearchResultsInputSchema = z.object({
  query: z.string().describe('The user query for which to generate search results.'),
});
export type GenerateSearchResultsInput = z.infer<typeof GenerateSearchResultsInputSchema>;

const SearchResultItemSchema = z.object({
  title: z.string().describe('A plausible title for a search result.'),
  snippet: z.string().describe('A short, descriptive snippet for the search result.'),
  url: z.string().describe('A plausible, but not necessarily real, URL for the search result (e.g., https://example.com/topic).'), // Changed from z.string().url()
});

const GenerateSearchResultsOutputSchema = z.object({
  results: z.array(SearchResultItemSchema).max(5).describe('An array of up to 5 simulated search results.'),
});
export type GenerateSearchResultsOutput = z.infer<typeof GenerateSearchResultsOutputSchema>;
// --- End Schemas and Types from generate-search-results-flow.ts ---


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
    // Run both flows in parallel
    // The input { query } conforms to GenerateAnswerInput and GenerateSearchResultsInput
    const [answerResult, searchResultsResult] = await Promise.allSettled([
      generateAnswer({ query }),
      generateSearchResults({ query })
    ]);

    const answer = answerResult.status === 'fulfilled' ? answerResult.value : undefined;
    const searchResults = searchResultsResult.status === 'fulfilled' ? searchResultsResult.value : undefined;

    let errorMessages: string[] = [];
    if (answerResult.status === 'rejected') {
      console.error("Error generating answer:", answerResult.reason);
      const reasonText = answerResult.reason instanceof Error ? answerResult.reason.message : String(answerResult.reason);
      errorMessages.push(`AI Answer generation failed: ${reasonText.substring(0,150)}`);
    }
    if (searchResultsResult.status === 'rejected') {
      console.error("Error generating search results:", searchResultsResult.reason);
      const reasonText = searchResultsResult.reason instanceof Error ? searchResultsResult.reason.message : String(searchResultsResult.reason);
      errorMessages.push(`AI Search Results generation failed: ${reasonText.substring(0,150)}`);
    }
    
    // If both failed and produced no data, return the combined error.
    if (!answer && !searchResults && errorMessages.length > 0) {
      return { error: errorMessages.join("; ") };
    }

    // If one succeeded and the other failed, return the successful data along with the error message.
    return {
      answer,
      searchResults,
      error: errorMessages.length > 0 ? errorMessages.join("; ") : undefined,
    };

  } catch (e) {
    console.error("Error processing search query:", e);
    const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred.";
    return { error: `An error occurred while processing your request: ${errorMessage.substring(0,200)}` };
  }
}
