
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
    console.log(`[VERBOSE FLOW WRAPPER - generateAnswer] Input:`, JSON.stringify(input, null, 2));
  }
  const result = await generateAnswerFlow(input);
  if (input.verbose) {
    console.log(`[VERBOSE FLOW WRAPPER - generateAnswer] Output:`, JSON.stringify(result, null, 2));
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

const MAX_AI_ATTEMPTS = 2; // 1 initial + 1 retry
const AI_RETRY_DELAY_MS = 500;

const generateAnswerFlow = ai.defineFlow(
  {
    name: 'generateAnswerFlow',
    inputSchema: GenerateAnswerInputSchema,
    outputSchema: GenerateAnswerOutputSchema,
  },
  async (input) => {
    const promptInput = { query: input.query, recentSearches: input.recentSearches };
    let resultOutput: GenerateAnswerOutput | null = null;
    let lastError: any = null;

    for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt++) {
      try {
        if (input.verbose) {
          if (attempt > 1) {
            console.log(`[VERBOSE FLOW - generateAnswerFlow] Retrying prompt call (attempt ${attempt}/${MAX_AI_ATTEMPTS}) for query: "${input.query}"`);
          }
          // Log prompt call for each attempt if verbose
          console.log(`[VERBOSE FLOW - generateAnswerFlow] Calling prompt (attempt ${attempt}) with input:`, JSON.stringify(promptInput, null, 2));
        }
        
        const { output } = await prompt(promptInput);
        
        if (input.verbose) {
            console.log(`[VERBOSE FLOW - generateAnswerFlow] Prompt output (attempt ${attempt}):`, JSON.stringify(output, null, 2));
        }
        
        resultOutput = output; // output can be null if model returns nothing structured or an empty object for the schema
        
        // Check if the output is satisfactory (e.g., not null and has the expected 'answer' field)
        if (resultOutput && typeof resultOutput.answer === 'string') {
            break; // Successful, exit retry loop
        } else if (attempt < MAX_AI_ATTEMPTS) {
             if (input.verbose) {
                console.log(`[VERBOSE FLOW - generateAnswerFlow] Prompt returned null or invalid output on attempt ${attempt}, retrying.`);
             }
        }

      } catch (error) {
        lastError = error;
        if (input.verbose) {
          console.error(`[VERBOSE FLOW - generateAnswerFlow] Error during prompt call (attempt ${attempt}/${MAX_AI_ATTEMPTS}):`, error);
        }
      }

      if (attempt < MAX_AI_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, AI_RETRY_DELAY_MS));
      }
    }

    if (!resultOutput || typeof resultOutput.answer !== 'string') {
        console.warn(`generateAnswerFlow: AI model did not return expected output after ${MAX_AI_ATTEMPTS} attempts for query "${input.query}". Last error (if any):`, lastError, "Returning empty answer.");
        return { answer: "" }; 
    }
    
    return resultOutput;
  }
);
