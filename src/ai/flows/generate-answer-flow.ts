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
});
// Type for internal use, inferred from the internal schema
type GenerateAnswerInput = z.infer<typeof GenerateAnswerInputSchema>;


// Internal schema for the flow's output structure, not exported
const GenerateAnswerOutputSchema = z.object({
  answer: z.string().describe('A balanced and informative answer to the user query, without references.'),
});
// Type for internal use, inferred from the internal schema
type GenerateAnswerOutput = z.infer<typeof GenerateAnswerOutputSchema>;


export async function generateAnswer(input: GenerateAnswerInput): Promise<GenerateAnswerOutput> {
  return generateAnswerFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateAnswerPrompt',
  input: {schema: GenerateAnswerInputSchema},
  output: {schema: GenerateAnswerOutputSchema},
  prompt: `You are an AI assistant for Xpoxial Search. Your task is to provide a well-balanced and informative answer to the user's query.
The answer should be comprehensive enough to be useful, but concise and easy to understand.
Avoid overly technical jargon unless necessary for the query, and explain it if used.
Do not include any references, citations, or links in your answer.

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
    const {output} = await prompt(input);
    return output!;
  }
);
