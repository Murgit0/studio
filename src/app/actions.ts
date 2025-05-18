// src/app/actions.ts
"use server";

import { z } from "zod";

import { generateAnswer } from "@/ai/flows/generate-answer-flow";
import { generateSearchResults } from "@/ai/flows/generate-search-results-flow";
import { generateImage } from "@/ai/flows/generate-image-flow"; // Added import for image generation

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

// --- Schemas and Types for generate-search-results-flow ---
const GenerateSearchResultsInputSchema = z.object({
  query: z.string().describe('The user query for which to generate search results.'),
});
export type GenerateSearchResultsInput = z.infer<typeof GenerateSearchResultsInputSchema>;

const SearchResultItemSchema = z.object({
  title: z.string().describe('The title of the search result.'),
  link: z.string().describe('The URL of the search result.'), 
  snippet: z.string().describe('A short, descriptive snippet for the search result.'),
});

const GenerateSearchResultsOutputSchema = z.object({
  results: z.array(SearchResultItemSchema).max(10).describe('An array of up to 10 search results.'),
});
export type GenerateSearchResultsOutput = z.infer<typeof GenerateSearchResultsOutputSchema>;
// --- End Schemas and Types from generate-search-results-flow.ts ---

// --- Schemas and Types for generate-image-flow ---
const GenerateImageInputSchema = z.object({
  query: z.string().describe('The user query for which to generate an image.'),
});
export type GenerateImageInput = z.infer<typeof GenerateImageInputSchema>;

const GenerateImageOutputSchema = z.object({
  imageDataUri: z.string().optional().describe('The generated image as a data URI, or undefined if no image could be generated.'),
});
export type GenerateImageOutput = z.infer<typeof GenerateImageOutputSchema>;
// --- End Schemas and Types from generate-image-flow.ts ---


const processSearchQueryInputSchema = z.object({
  query: z.string().min(1, "Query is required."),
});

export type ProcessSearchQueryInput = z.infer<typeof processSearchQueryInputSchema>;

export interface SearchActionResult {
  answer?: GenerateAnswerOutput;
  searchResults?: GenerateSearchResultsOutput;
  imageResult?: GenerateImageOutput; // Added image result
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
    // Run all flows in parallel
    const [answerResult, searchResultsResult, imageResultSettled] = await Promise.allSettled([
      generateAnswer({ query }),
      generateSearchResults({ query }),
      generateImage({ query }) // Added image generation call
    ]);

    const answer = answerResult.status === 'fulfilled' ? answerResult.value : undefined;
    const searchResults = searchResultsResult.status === 'fulfilled' ? 
      GenerateSearchResultsOutputSchema.parse(searchResultsResult.value) 
      : undefined;
    const imageResult = imageResultSettled.status === 'fulfilled' ?
      GenerateImageOutputSchema.parse(imageResultSettled.value)
      : undefined;

    let errorMessages: string[] = [];
    if (answerResult.status === 'rejected') {
      console.error("Error generating answer:", answerResult.reason);
      const reasonText = answerResult.reason instanceof Error ? answerResult.reason.message : String(answerResult.reason);
      errorMessages.push(`AI Answer generation failed: ${reasonText.substring(0,150)}`);
    }
    if (searchResultsResult.status === 'rejected') {
      console.error("Error generating search results:", searchResultsResult.reason);
      const reasonText = searchResultsResult.reason instanceof Error ? searchResultsResult.reason.message : String(searchResultsResult.reason);
      errorMessages.push(`Search Results generation failed: ${reasonText.substring(0,150)}`);
    }  else if (searchResultsResult.status === 'fulfilled' && !GenerateSearchResultsOutputSchema.safeParse(searchResultsResult.value).success) {
      console.error("Search results format error:", GenerateSearchResultsOutputSchema.safeParse(searchResultsResult.value).error);
      errorMessages.push(`Search Results format error. Check tool output.`);
    }
    if (imageResultSettled.status === 'rejected') {
      console.error("Error generating image:", imageResultSettled.reason);
      const reasonText = imageResultSettled.reason instanceof Error ? imageResultSettled.reason.message : String(imageResultSettled.reason);
      errorMessages.push(`Image generation failed: ${reasonText.substring(0,150)}`);
    } else if (imageResultSettled.status === 'fulfilled' && !GenerateImageOutputSchema.safeParse(imageResultSettled.value).success) {
      console.error("Image result format error:", GenerateImageOutputSchema.safeParse(imageResultSettled.value).error);
      errorMessages.push(`Image result format error. Check tool output.`);
    }
    
    if (!answer && (!searchResults || searchResults.results.length === 0) && !imageResult?.imageDataUri && errorMessages.length > 0) {
      return { error: errorMessages.join("; ") };
    }

    return {
      answer,
      searchResults,
      imageResult,
      error: errorMessages.length > 0 ? errorMessages.join("; ") : undefined,
    };

  } catch (e) {
    console.error("Error processing search query:", e);
    const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred.";
    return { error: `An error occurred while processing your request: ${errorMessage.substring(0,200)}` };
  }
}
