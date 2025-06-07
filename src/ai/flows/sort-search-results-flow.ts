
'use server';
/**
 * @fileOverview Sorts web search results based on relevance to a user's query using an AI model,
 * optionally considering user's location, device information, and recent searches.
 *
 * - sortSearchResults - A function that re-ranks search results.
 * - SortSearchResultsInput - The input type for the sortSearchResults function.
 * - SortSearchResultsOutput - The return type for the sortSearchResults function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Schema for a single web search result item (must match the one in actions.ts and perform-web-search.ts)
const WebSearchResultItemSchema = z.object({
  title: z.string().describe('The title of the search result.'),
  link: z.string().describe('The URL of the search result.'),
  snippet: z.string().describe('A brief snippet or description of the search result.'),
});
export type WebSearchResultItem = z.infer<typeof WebSearchResultItemSchema>;

const LocationDataSchema = z.object({
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  error: z.string().optional(),
}).optional().describe("User's approximate geolocation data, if available.");

const DeviceInfoSchema = z.object({
  userAgent: z.string().optional(),
  screenWidth: z.number().optional(),
  screenHeight: z.number().optional(),
  os: z.string().optional().describe("The operating system of the user's device, if identifiable."),
}).optional().describe("Information about the user's device, if available.");

const SortSearchResultsInputSchemaInternal = z.object({
  query: z.string().describe('The original user query.'),
  webResults: z.array(WebSearchResultItemSchema).describe('The list of web search results to be sorted.'),
  verbose: z.boolean().optional().describe('Enable verbose logging for the flow.'),
  location: LocationDataSchema,
  deviceInfo: DeviceInfoSchema,
  recentSearches: z.array(z.string()).optional().describe('A list of recent search queries by the user, for context.'),
});
export type SortSearchResultsInput = z.infer<typeof SortSearchResultsInputSchemaInternal>;

const SortSearchResultsOutputSchemaInternal = z.object({
  sortedWebResults: z.array(WebSearchResultItemSchema).describe('The web search results, sorted by relevance to the query, considering location, device context, and recent searches if provided.'),
});
export type SortSearchResultsOutput = z.infer<typeof SortSearchResultsOutputSchemaInternal>;

export async function sortSearchResults(input: SortSearchResultsInput): Promise<SortSearchResultsOutput> {
  if (input.verbose) {
    console.log(`[VERBOSE FLOW WRAPPER - sortSearchResults] Input:`, JSON.stringify(input, null, 2));
  }

  if (input.webResults.length <= 1) {
    if (input.verbose) {
        console.log(`[VERBOSE FLOW WRAPPER - sortSearchResults] Skipping sort for <= 1 result.`);
    }
    return { sortedWebResults: input.webResults };
  }
  const result = await sortSearchResultsFlow(input);
  if (input.verbose) {
    console.log(`[VERBOSE FLOW WRAPPER - sortSearchResults] Output:`, JSON.stringify(result, null, 2));
  }
  return result;
}

const prompt = ai.definePrompt({
  name: 'sortSearchResultsPrompt',
  input: {schema: SortSearchResultsInputSchemaInternal.omit({ verbose: true })}, // verbose not needed by prompt
  output: {schema: SortSearchResultsOutputSchemaInternal},
  prompt: `You are an expert relevance ranking AI.
Your task is to re-order the given list of web search results based on their relevance to the user's query.
The most relevant results should appear first in the output array.
Analyze the user's query and then, for each search result (title and snippet), assess how well it answers or relates to the query.

User Query:
{{{query}}}

{{#if location}}
User's approximate location (if available and potentially relevant to the query):
Latitude: {{location.latitude}}
Longitude: {{location.longitude}}
{{#if location.error}}
(Note: Location could not be retrieved: {{location.error}})
{{/if}}
{{/if}}

{{#if deviceInfo}}
User's device context (if available and potentially relevant):
{{#if deviceInfo.userAgent}}User Agent: {{deviceInfo.userAgent}}{{/if}}
{{#if deviceInfo.screenWidth}}Screen Width: {{deviceInfo.screenWidth}}px{{/if}}
{{#if deviceInfo.screenHeight}}Screen Height: {{deviceInfo.screenHeight}}px{{/if}}
{{#if deviceInfo.os}}Operating System: {{deviceInfo.os}}{{/if}}
{{/if}}

{{#if recentSearches}}
Recent searches by the user that might provide context on their current interest or line of inquiry:
{{#each recentSearches}}
- {{{this}}}
{{/each}}
Consider this search history if it helps clarify the intent behind the current query or suggests related topics of interest.
{{/if}}

When ranking, consider if the user's location, device context, or recent search history (if provided and the information seems pertinent to the query) offers clues about their intent or could make certain results more practical or relevant. For example, local services might be more relevant if the query has local intent and location is available. However, do not over-prioritize based on this context if it does not seem relevant to the query itself. The primary ranking factor should still be direct relevance to the query.

Original Search Results (JSON array of objects, each with 'title', 'link', and 'snippet'):
{{{json webResults}}}

Your output MUST be a JSON array containing THE SAME search result objects as provided in the input, but re-ordered by relevance.
Do not add new fields. Do not remove any fields. Do not change the content of the fields.
Ensure all original search result items are present in your sorted output.
The output must be a valid JSON array of the original search result items, sorted from most to least relevant.
Return ONLY the JSON array of sorted results.
`,
});

const MAX_AI_ATTEMPTS = 2; // 1 initial + 1 retry
const AI_RETRY_DELAY_MS = 500;

const sortSearchResultsFlow = ai.defineFlow(
  {
    name: 'sortSearchResultsFlow',
    inputSchema: SortSearchResultsInputSchemaInternal,
    outputSchema: SortSearchResultsOutputSchemaInternal,
  },
  async (input) => {
    const promptInput = { 
        query: input.query, 
        webResults: input.webResults,
        location: input.location,
        deviceInfo: input.deviceInfo,
        recentSearches: input.recentSearches,
    };
    
    let finalOutput: SortSearchResultsOutputSchemaInternal | null = null;
    let lastError: any = null;

    for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt++) {
      try {
        if (input.verbose) {
          if (attempt > 1) {
            console.log(`[VERBOSE FLOW - sortSearchResultsFlow] Retrying prompt call (attempt ${attempt}/${MAX_AI_ATTEMPTS}) for query: "${input.query}"`);
          }
          // Log prompt call for each attempt if verbose
           console.log(`[VERBOSE FLOW - sortSearchResultsFlow] Calling prompt (attempt ${attempt}) with input:`, JSON.stringify(promptInput, null, 2));
        }
        
        const { output: currentPromptOutput } = await prompt(promptInput);
        
        if (input.verbose) {
            console.log(`[VERBOSE FLOW - sortSearchResultsFlow] Prompt output (attempt ${attempt}):`, JSON.stringify(currentPromptOutput, null, 2));
        }

        // Validate the output integrity
        if (!currentPromptOutput) {
            if (input.verbose) console.log(`[VERBOSE FLOW - sortSearchResultsFlow] AI model output was null on attempt ${attempt}.`);
            if (attempt < MAX_AI_ATTEMPTS) {  continue; } // Retry if not last attempt
            // If last attempt and still null, it will fall through to the outer !finalOutput check
        } else if (!currentPromptOutput.sortedWebResults || currentPromptOutput.sortedWebResults.length !== input.webResults.length) {
            if (input.verbose) console.log(`[VERBOSE FLOW - sortSearchResultsFlow] AI model output item count mismatch or missing sortedWebResults on attempt ${attempt}. Output:`, currentPromptOutput);
            if (attempt < MAX_AI_ATTEMPTS) { continue; } // Retry
        } else {
            const originalLinks = new Set(input.webResults.map(r => r.link));
            const outputLinks = new Set(currentPromptOutput.sortedWebResults.map(r => r.link));
            if (originalLinks.size !== outputLinks.size || !Array.from(originalLinks).every(link => outputLinks.has(link))) {
                if (input.verbose) console.log(`[VERBOSE FLOW - sortSearchResultsFlow] AI model modified or lost items during sorting on attempt ${attempt}.`);
                if (attempt < MAX_AI_ATTEMPTS) { continue; } // Retry
            } else {
                finalOutput = currentPromptOutput; // Valid output
                break; // Success, exit retry loop
            }
        }
      } catch (error) {
        lastError = error;
        if (input.verbose) {
          console.error(`[VERBOSE FLOW - sortSearchResultsFlow] Error during prompt call (attempt ${attempt}/${MAX_AI_ATTEMPTS}):`, error);
        }
      }

      if (attempt < MAX_AI_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, AI_RETRY_DELAY_MS));
      }
    }
    
    if (!finalOutput) {
        console.warn(`SortSearchResultsFlow: AI model did not return valid/expected output after ${MAX_AI_ATTEMPTS} attempts for query "${input.query}". Returning original order. Last error (if any):`, lastError);
        if (input.verbose && !lastError) console.log('[VERBOSE FLOW - sortSearchResultsFlow] AI model output processing failed due to invalid structure/content after all attempts. Returning original order.');
        return { sortedWebResults: input.webResults };
    }

    return finalOutput;
  }
);
