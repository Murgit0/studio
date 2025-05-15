'use server';

/**
 * @fileOverview Summarizes information discovered from search queries.
 *
 * - summarizeResults - A function that summarizes search query results.
 * - SummarizeResultsInput - The input type for the summarizeResults function.
 * - SummarizeResultsOutput - The return type for the summarizeResults function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeResultsInputSchema = z.object({
  query: z.string().describe('The search query used to find the information.'),
  results: z.string().describe('The raw information discovered from the search query.'),
});
export type SummarizeResultsInput = z.infer<typeof SummarizeResultsInputSchema>;

const SummarizeResultsOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the information discovered.'),
});
export type SummarizeResultsOutput = z.infer<typeof SummarizeResultsOutputSchema>;

export async function summarizeResults(input: SummarizeResultsInput): Promise<SummarizeResultsOutput> {
  return summarizeResultsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeResultsPrompt',
  input: {schema: SummarizeResultsInputSchema},
  output: {schema: SummarizeResultsOutputSchema},
  prompt: `You are an AI expert in summarization.

  You will be provided with a search query and the raw results from that query. You will summarize the information, and return it to the user in a concise, easy to understand way.

  Query: {{{query}}}
  Results: {{{results}}}
  `,
});

const summarizeResultsFlow = ai.defineFlow(
  {
    name: 'summarizeResultsFlow',
    inputSchema: SummarizeResultsInputSchema,
    outputSchema: SummarizeResultsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
