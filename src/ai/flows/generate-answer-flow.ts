
'use server';
/**
 * @fileOverview Generates a concise answer to a user's query.
 *
 * - generateAnswer - A function that uses an AI model to generate an answer.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Internal schema for the flow's input, not exported
const GenerateAnswerInputSchema = z.object({
  query: z.string().describe('The user query for which to generate an answer.'),
  verbose: z.boolean().optional().describe('Enable verbose logging for the flow.'),
  recentSearches: z.array(z.string()).optional().describe('A list of recent search queries by the user, for context.'),
});
// Type for internal use, inferred from the internal schema
export type GenerateAnswerInput = z.infer<typeof GenerateAnswerInputSchema>;


// Internal schema for the flow's output structure, not exported
const GenerateAnswerOutputSchema = z.object({
  answer: z.string().describe('A balanced and informative answer to the user query, without references.'),
});
// Type for internal use, inferred from the internal schema
export type GenerateAnswerOutput = z.infer<typeof GenerateAnswerOutputSchema>;


export async function generateAnswer(input: GenerateAnswerInput): Promise<GenerateAnswerOutput> {
  if (input.verbose) {
    console.log(`[VERBOSE FLOW - generateAnswer] Input:`, JSON.stringify(input, null, 2));
  }
  const result = await generateAnswerFlow(input);
  if (input.verbose) {
    console.log(`[VERBOSE FLOW - generateAnswer] Output:`, JSON.stringify(result, null, 2));
  }
  return result;
}

const prompt = ai.definePrompt({
  name: 'generateAnswerPrompt',
  input: {schema: GenerateAnswerInputSchema.omit({ verbose: true })}, // verbose not needed by prompt itself
  output: {schema: GenerateAnswerOutputSchema},
  prompt: `You are an AI assistant for Xpoxial Search. Your task is to provide a well-balanced and informative answer to the user's query.
The answer should be comprehensive enough to be useful, but concise and easy to understand.
Avoid overly technical jargon unless necessary for the query, and explain it if used.
Do not include any references, citations, or links in your answer.

{{#if recentSearches}}
To help understand the user's current train of thought or ongoing interest, here are some of their recent searches:
{{#each recentSearches}}
- {{{this}}}
{{/each}}
Use this contextual information if it seems relevant to the current query to provide a more tailored answer.
{{/if}}

User Query: {{{query}}}
`,
});

const generateAnswerFlow = ai.defineFlow(
  {
    name: 'generateAnswerFlow',
    inputSchema: GenerateAnswerInputSchema,
    outputSchema: GenerateAnswerOutputSchema,
  },
  async (input) => {
    const promptInput = { query: input.query, recentSearches: input.recentSearches };
    if (input.verbose) {
        console.log(`[VERBOSE FLOW - generateAnswerFlow] Calling prompt with input (excluding verbose):`, JSON.stringify(promptInput, null, 2));
    }
    const {output} = await prompt(promptInput); // Pass only relevant fields to prompt
    if (input.verbose) {
        console.log(`[VERBOSE FLOW - generateAnswerFlow] Prompt output:`, JSON.stringify(output, null, 2));
    }
    return output!;
  }
);
