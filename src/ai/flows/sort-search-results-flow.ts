
'use server';
/**
 * @fileOverview Sorts web search results based on relevance to a user's query using an AI model,
 * optionally considering user's location and device information.
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
}).optional().describe("Information about the user's device, if available.");

const SortSearchResultsInputSchemaInternal = z.object({
  query: z.string().describe('The original user query.'),
  webResults: z.array(WebSearchResultItemSchema).describe('The list of web search results to be sorted.'),
  verbose: z.boolean().optional().describe('Enable verbose logging for the flow.'),
  location: LocationDataSchema,
  deviceInfo: DeviceInfoSchema,
});
export type SortSearchResultsInput = z.infer<typeof SortSearchResultsInputSchemaInternal>;

const SortSearchResultsOutputSchemaInternal = z.object({
  sortedWebResults: z.array(WebSearchResultItemSchema).describe('The web search results, sorted by relevance to the query, considering location and device context if provided.'),
});
export type SortSearchResultsOutput = z.infer<typeof SortSearchResultsOutputSchemaInternal>;

export async function sortSearchResults(input: SortSearchResultsInput): Promise<SortSearchResultsOutput> {
  if (input.verbose) {
    console.log(`[VERBOSE FLOW - sortSearchResults] Input:`, JSON.stringify(input, null, 2));
  }

  if (input.webResults.length <= 1) {
    if (input.verbose) {
        console.log(`[VERBOSE FLOW - sortSearchResults] Skipping sort for <= 1 result.`);
    }
    return { sortedWebResults: input.webResults };
  }
  const result = await sortSearchResultsFlow(input);
  if (input.verbose) {
    console.log(`[VERBOSE FLOW - sortSearchResults] Output:`, JSON.stringify(result, null, 2));
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
User Agent: {{deviceInfo.userAgent}}
Screen Width: {{deviceInfo.screenWidth}}px
Screen Height: {{deviceInfo.screenHeight}}px
{{/if}}

When ranking, consider if the user's location or device context (if provided and the information seems pertinent to the query) offers clues about their intent or could make certain results more practical or relevant. For example, local services might be more relevant if the query has local intent and location is available. However, do not over-prioritize based on this context if it does not seem relevant to the query. The primary ranking factor should still be direct relevance to the query itself.

Original Search Results (JSON array of objects, each with 'title', 'link', and 'snippet'):
{{{json webResults}}}

Your output MUST be a JSON array containing THE SAME search result objects as provided in the input, but re-ordered by relevance.
Do not add new fields. Do not remove any fields. Do not change the content of the fields.
Ensure all original search result items are present in your sorted output.
The output must be a valid JSON array of the original search result items, sorted from most to least relevant.
Return ONLY the JSON array of sorted results.
`,
});

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
        deviceInfo: input.deviceInfo
    };
    if (input.verbose) {
        console.log(`[VERBOSE FLOW - sortSearchResultsFlow] Calling prompt with input:`, JSON.stringify(promptInput, null, 2));
    }
    
    const {output} = await prompt(promptInput);
    
    if (input.verbose) {
        console.log(`[VERBOSE FLOW - sortSearchResultsFlow] Prompt output:`, JSON.stringify(output, null, 2));
    }

    if (!output) {
        console.warn('SortSearchResultsFlow: AI model did not return expected output. Returning original order.');
        if (input.verbose) console.log('[VERBOSE FLOW - sortSearchResultsFlow] AI model output was null. Returning original order.');
        return { sortedWebResults: input.webResults };
    }
    
    if (output.sortedWebResults.length !== input.webResults.length) {
        console.warn('SortSearchResultsFlow: AI model returned a different number of items. Returning original order.');
        if (input.verbose) console.log('[VERBOSE FLOW - sortSearchResultsFlow] AI model output item count mismatch. Returning original order.');
        return { sortedWebResults: input.webResults };
    }
    
    const originalLinks = new Set(input.webResults.map(r => r.link));
    const outputLinks = new Set(output.sortedWebResults.map(r => r.link));
    if (originalLinks.size !== outputLinks.size || !Array.from(originalLinks).every(link => outputLinks.has(link))) {
        console.warn('SortSearchResultsFlow: AI model modified or lost items during sorting. Returning original order.');
         if (input.verbose) console.log('[VERBOSE FLOW - sortSearchResultsFlow] AI model modified/lost items. Returning original order.');
        return { sortedWebResults: input.webResults };
    }

    return output;
  }
);
