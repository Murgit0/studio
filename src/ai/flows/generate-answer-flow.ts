'use server';
/**
 * @fileOverview Generates a concise answer to a user's query.
 *
 * - generateAnswer - A function that uses an AI model to generate an answer.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateAnswerInputSchema = z.object({
  query: z.string().describe('The user query for which to generate an answer.'),
});
type GenerateAnswerInput = z.infer<typeof GenerateAnswerInputSchema>;

const GenerateAnswerOutputSchema = z.object({
  answer: z.string().describe('A concise, helpful answer to the user query.'),
});
type GenerateAnswerOutput = z.infer<typeof GenerateAnswerOutputSchema>;

export async function generateAnswer(input: GenerateAnswerInput): Promise<GenerateAnswerOutput> {
  return generateAnswerFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateAnswerPrompt',
  input: {schema: GenerateAnswerInputSchema},
  output: {schema: GenerateAnswerOutputSchema},
  prompt: `You are an AI assistant for Xpoxial Search. Your task is to provide a direct and concise answer to the user's query.
If the query is a question, answer it. If it's a topic, provide a brief summary.
Focus on being helpful and informative.

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
