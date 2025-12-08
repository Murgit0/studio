
'use server';
/**
 * @fileOverview Summarizes a comprehensive set of search results using an advanced AI model.
 *
 * - summarizeAdvancedResults - A function that generates a summary from aggregated search data.
 * - SummarizeAdvancedResultsInput - The input type for the function.
 * - SummarizeAdvancedResultsOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Schemas from perform-advanced-search tool, redefined here to avoid import issues with 'use server'
const WebResultSchema = z.object({
  position: z.number().optional(),
  title: z.string().optional(),
  link: z.string().url().optional(),
  snippet: z.string().optional(),
  engine: z.string().optional(), // Added engine
});

const ImageResultSchema = z.object({
  position: z.number().optional(),
  thumbnail: z.string().url().optional(),
  original: z.string().url().optional(),
  title: z.string().optional(),
  link: z.string().url().optional(),
  source: z.string().optional(),
  engine: z.string().optional(), // Added engine
});

const VideoResultSchema = z.object({
  position: z.number().optional(),
  title: z.string().optional(),
  link: z.string().url().optional(),
  thumbnail: z.string().url().optional(),
  duration: z.string().optional(),
  engine: z.string().optional(), // Added engine
});

const RelatedQuestionSchema = z.object({
  question: z.string().optional(),
  snippet: z.string().optional(),
  title: z.string().optional(),
  link: z.string().url().optional(),
  engine: z.string().optional(), // Added engine
});


// Input Schema for the summarization flow
const SummarizeAdvancedResultsInputSchema = z.object({
  query: z.string().describe("The original user query that prompted the search."),
  webResults: z.array(WebResultSchema).describe("An aggregated list of web search results from multiple engines."),
  imageResults: z.array(ImageResultSchema).describe("An aggregated list of image search results."),
  videoResults: z.array(VideoResultSchema).describe("An aggregated list of video search results."),
  relatedQuestions: z.array(RelatedQuestionSchema).describe("An aggregated list of related questions."),
  verbose: z.boolean().optional().describe('Enable verbose logging for the flow.'),
});
export type SummarizeAdvancedResultsInput = z.infer<typeof SummarizeAdvancedResultsInputSchema>;

// Output Schema for the summarization flow
const SummarizeAdvancedResultsOutputSchema = z.object({
  summary: z.string().describe("A comprehensive, well-structured summary of all the provided search data."),
});
export type SummarizeAdvancedResultsOutput = z.infer<typeof SummarizeAdvancedResultsOutputSchema>;


export async function summarizeAdvancedResults(input: SummarizeAdvancedResultsInput): Promise<SummarizeAdvancedResultsOutput> {
  if (input.verbose) {
    console.log(`[VERBOSE FLOW WRAPPER - summarizeAdvancedResults] Input received for query: "${input.query}"`);
  }
  const result = await summarizeAdvancedResultsFlow(input);
  if (input.verbose) {
    console.log(`[VERBOSE FLOW WRAPPER - summarizeAdvancedResults] Output:`, JSON.stringify(result, null, 2));
  }
  return result;
}


const prompt = ai.definePrompt({
  name: 'summarizeAdvancedResultsPrompt',
  input: {schema: SummarizeAdvancedResultsInputSchema.omit({ verbose: true })},
  output: {schema: SummarizeAdvancedResultsOutputSchema},
  prompt: `You are a world-class AI research assistant. Your task is to synthesize a vast amount of information from multiple search engines into a single, comprehensive, and well-structured summary for the user.

The user's original query was:
"{{{query}}}"

You have been provided with the following data, aggregated from Google, Bing, Yahoo, and DuckDuckGo:
1. A list of web search results (title, snippet, link).
2. A list of related image results.
3. A list of related video results.
4. A list of related questions people also ask.

Your summary should:
- Directly address the user's query.
- Integrate key information from the web result snippets.
- Mention common themes or objects that appear in the image and video results, if relevant.
- Incorporate insights from the related questions to address potential user curiosities.
- Be written in clear, concise, and fluent language.
- Structure the output in well-organized paragraphs. Use markdown for formatting if it enhances readability (e.g., headings, bullet points).
- Do not invent information. Base your summary strictly on the provided data.

Here is the data:

=== Web Results ===
{{{json webResults}}}

=== Image Results (titles and sources) ===
{{{json imageResults}}}

=== Video Results (titles and durations) ===
{{{json videoResults}}}

=== Related Questions ===
{{{json relatedQuestions}}}

Now, generate the comprehensive summary based on all the provided data.
`,
});

const summarizeAdvancedResultsFlow = ai.defineFlow(
  {
    name: 'summarizeAdvancedResultsFlow',
    inputSchema: SummarizeAdvancedResultsInputSchema,
    outputSchema: SummarizeAdvancedResultsOutputSchema,
    // Using gemini-2.5-flash as it's a powerful model suitable for large context summarization
    model: 'googleai/gemini-2.5-flash',
  },
  async (input) => {
    if (input.verbose) {
      console.log(`[VERBOSE FLOW - summarizeAdvancedResultsFlow] Calling prompt for query: "${input.query}"`);
    }

    const { output } = await prompt({
      query: input.query,
      webResults: input.webResults,
      imageResults: input.imageResults,
      videoResults: input.videoResults,
      relatedQuestions: input.relatedQuestions,
    });
    
    if (!output) {
      console.warn(`summarizeAdvancedResultsFlow: AI model returned null output for query "${input.query}".`);
      return { summary: "I'm sorry, I was unable to generate a summary for these search results. Please try again." };
    }

    if (input.verbose) {
      console.log(`[VERBOSE FLOW - summarizeAdvancedResultsFlow] Successfully generated summary.`);
    }

    return output;
  }
);
