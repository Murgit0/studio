// src/ai/flows/filter-rank-results.ts
'use server';

/**
 * @fileOverview AI-powered information filter and ranker.
 *
 * filterAndRankResults - A function that filters and ranks information based on relevance to a query.
 * FilterAndRankResultsInput - The input type for the filterAndRankResults function.
 * FilterAndRankResultsOutput - The return type for the filterAndRankResults function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FilterAndRankResultsInputSchema = z.object({
  query: z.string().describe('The user query to filter and rank information against.'),
  information: z.array(z.string()).describe('An array of information snippets to filter and rank.'),
});
export type FilterAndRankResultsInput = z.infer<typeof FilterAndRankResultsInputSchema>;

const FilterAndRankResultsOutputSchema = z.array(
  z.object({
    snippet: z.string().describe('The information snippet.'),
    relevanceScore: z.number().describe('A score indicating the relevance of the snippet to the query.'),
  })
);
export type FilterAndRankResultsOutput = z.infer<typeof FilterAndRankResultsOutputSchema>;

export async function filterAndRankResults(input: FilterAndRankResultsInput): Promise<FilterAndRankResultsOutput> {
  return filterAndRankResultsFlow(input);
}

const filterAndRankResultsPrompt = ai.definePrompt({
  name: 'filterAndRankResultsPrompt',
  input: {schema: FilterAndRankResultsInputSchema},
  output: {schema: FilterAndRankResultsOutputSchema},
  prompt: `You are an AI information filter and ranker. Your task is to filter and rank information snippets based on their relevance to a given user query.  You will return an array of JSON objects, each containing the original information snippet and a relevance score (0-1) indicating how well it matches the query.

User Query: {{{query}}}

Information Snippets:
{{#each information}}
- {{{this}}}
{{/each}}
`,
});

const filterAndRankResultsFlow = ai.defineFlow(
  {
    name: 'filterAndRankResultsFlow',
    inputSchema: FilterAndRankResultsInputSchema,
    outputSchema: FilterAndRankResultsOutputSchema,
  },
  async input => {
    const {output} = await filterAndRankResultsPrompt(input);
    return output!;
  }
);
