
'use server';
/**
 * @fileOverview Sorts web search results based on relevance to a user's query using an AI model.
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

const SortSearchResultsInputSchema = z.object({
  query: z.string().describe('The original user query.'),
  webResults: z.array(WebSearchResultItemSchema).describe('The list of web search results to be sorted.'),
});
export type SortSearchResultsInput = z.infer<typeof SortSearchResultsInputSchema>;

const SortSearchResultsOutputSchema = z.object({
  sortedWebResults: z.array(WebSearchResultItemSchema).describe('The web search results, sorted by relevance to the query.'),
});
export type SortSearchResultsOutput = z.infer<typeof SortSearchResultsOutputSchema>;

export async function sortSearchResults(input: SortSearchResultsInput): Promise<SortSearchResultsOutput> {
  // If no results or a very small number, sorting might not be beneficial or could be error-prone for the AI.
  // Let's say we only sort if there's more than 1 result.
  if (input.webResults.length <= 1) {
    return { sortedWebResults: input.webResults };
  }
  return sortSearchResultsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'sortSearchResultsPrompt',
  input: {schema: SortSearchResultsInputSchema},
  output: {schema: SortSearchResultsOutputSchema},
  prompt: `You are an expert relevance ranking AI.
Your task is to re-order the given list of web search results based on their relevance to the user's query.
The most relevant results should appear first in the output array.
Analyze the user's query and then, for each search result (title and snippet), assess how well it answers or relates to the query.

User Query:
{{{query}}}

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
    inputSchema: SortSearchResultsInputSchema,
    outputSchema: SortSearchResultsOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
        // This case should ideally be handled by the model producing valid JSON based on the output schema.
        // If output is null, it means the model failed to produce the expected structured output.
        console.warn('SortSearchResultsFlow: AI model did not return expected output. Returning original order.');
        return { sortedWebResults: input.webResults };
    }
    // Ensure the output contains all original items, even if sorting wasn't perfect
    // This is a basic check; more sophisticated validation might be needed
    if (output.sortedWebResults.length !== input.webResults.length) {
        console.warn('SortSearchResultsFlow: AI model returned a different number of items. Returning original order.');
        return { sortedWebResults: input.webResults };
    }
    // Further check: ensure all original links are present to confirm items weren't fabricated/lost
    const originalLinks = new Set(input.webResults.map(r => r.link));
    const outputLinks = new Set(output.sortedWebResults.map(r => r.link));
    if (originalLinks.size !== outputLinks.size || !Array.from(originalLinks).every(link => outputLinks.has(link))) {
        console.warn('SortSearchResultsFlow: AI model modified or lost items during sorting. Returning original order.');
        return { sortedWebResults: input.webResults };
    }

    return output;
  }
);
