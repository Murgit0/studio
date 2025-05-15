'use server';
/**
 * @fileOverview Generates simulated search results for a user's query.
 *
 * - generateSearchResults - A function that uses an AI model to generate search results.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateSearchResultsInputSchema = z.object({
  query: z.string().describe('The user query for which to generate search results.'),
});
type GenerateSearchResultsInput = z.infer<typeof GenerateSearchResultsInputSchema>;

const SearchResultItemSchema = z.object({
  title: z.string().describe('A plausible title for a search result.'),
  snippet: z.string().describe('A short, descriptive snippet for the search result.'),
  url: z.string().url().describe('A plausible, but not necessarily real, URL for the search result (e.g., https://example.com/topic).'),
});

const GenerateSearchResultsOutputSchema = z.object({
  results: z.array(SearchResultItemSchema).max(5).describe('An array of up to 5 simulated search results.'),
});
type GenerateSearchResultsOutput = z.infer<typeof GenerateSearchResultsOutputSchema>;

export async function generateSearchResults(input: GenerateSearchResultsInput): Promise<GenerateSearchResultsOutput> {
  return generateSearchResultsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSearchResultsPrompt',
  input: {schema: GenerateSearchResultsInputSchema},
  output: {schema: GenerateSearchResultsOutputSchema},
  prompt: `You are an AI component for Xpoxial Search. Your task is to generate a list of 5 plausible search results for the given user query.
Each search result should have a compelling title, a concise snippet (1-2 sentences), and a fictional but realistic-looking URL (e.g. https://example.com/relevant-topic or https://blog.example.org/article-name).
Do not use real websites unless they are extremely generic like example.com. Focus on creating diverse and relevant-sounding results. Ensure URLs are valid.

User Query: {{{query}}}

Generate 5 search results.
`,
});

const generateSearchResultsFlow = ai.defineFlow(
  {
    name: 'generateSearchResultsFlow',
    inputSchema: GenerateSearchResultsInputSchema,
    outputSchema: GenerateSearchResultsOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
