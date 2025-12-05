
'use server';
/**
 * @fileOverview Filters a list of articles based on a specified category to exclude, using an AI model.
 *
 * - filterArticles - A function that removes articles belonging to a certain category.
 * - FilterArticlesInput - The input type for the filterArticles function.
 * - FilterArticlesOutput - The return type for the filterArticles function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Schema for a single news article item, must match other definitions
const NewsArticleItemSchema = z.object({
  title: z.string().describe('The headline or title of the news article.'),
  description: z.string().nullable().describe('A brief description of the news article.'),
  url: z.string().url().describe('The direct URL to the news article.'),
  source: z.string().describe('The name of the news source (e.g., "The New York Times").'),
  publishedAt: z.string().describe('The publication date of the article in ISO 8601 format.'),
});
export type NewsArticleItem = z.infer<typeof NewsArticleItemSchema>;


const FilterArticlesInputSchema = z.object({
  articles: z.array(NewsArticleItemSchema).describe('The list of news articles to be filtered.'),
  categoryToExclude: z.string().describe('The category of articles to remove (e.g., "finance").'),
  verbose: z.boolean().optional().describe('Enable verbose logging for the flow.'),
});
export type FilterArticlesInput = z.infer<typeof FilterArticlesInputSchema>;


const FilterArticlesOutputSchema = z.object({
  filteredArticles: z.array(NewsArticleItemSchema).describe('The list of articles after filtering out the specified category.'),
});
export type FilterArticlesOutput = z.infer<typeof FilterArticlesOutputSchema>;


export async function filterArticles(input: FilterArticlesInput): Promise<FilterArticlesOutput> {
   if (input.verbose) {
    console.log(`[VERBOSE FLOW WRAPPER - filterArticles] Input:`, JSON.stringify(input, null, 2));
  }

  if (input.articles.length === 0) {
    if (input.verbose) {
        console.log(`[VERBOSE FLOW WRAPPER - filterArticles] Skipping filter for 0 articles.`);
    }
    return { filteredArticles: [] };
  }
  const result = await filterArticlesFlow(input);
  if (input.verbose) {
    console.log(`[VERBOSE FLOW WRAPPER - filterArticles] Output:`, JSON.stringify(result, null, 2));
  }
  return result;
}

const prompt = ai.definePrompt({
  name: 'filterArticlesPrompt',
  input: {schema: FilterArticlesInputSchema.omit({ verbose: true })},
  output: {schema: FilterArticlesOutputSchema},
  prompt: `You are an AI content moderator for a news feed.
Your task is to filter a list of news articles and remove any that are related to the category: '{{{categoryToExclude}}}'.
Analyze the title and description of each article to determine if it belongs to the excluded category.
For example, if the category is 'finance', you should remove articles about stocks, markets, investments, corporate earnings, and economic reports.

You will be given a JSON array of article objects.
Your output MUST be a JSON array containing ONLY the articles that DO NOT BELONG to the excluded category.
It is critical that you return the exact same article objects that you keep, without adding, removing, or changing any fields.
Ensure all original articles that are not in the excluded category are present in your output.

Original Articles (JSON array):
{{{json articles}}}

Return ONLY the JSON array of the filtered articles.
`,
});


const MAX_AI_ATTEMPTS = 2;
const AI_RETRY_DELAY_MS = 500;

const filterArticlesFlow = ai.defineFlow(
  {
    name: 'filterArticlesFlow',
    inputSchema: FilterArticlesInputSchema,
    outputSchema: FilterArticlesOutputSchema,
  },
  async (input) => {
    const promptInput = {
        articles: input.articles,
        categoryToExclude: input.categoryToExclude,
    };

    let finalOutput: FilterArticlesOutput | null = null;
    let lastError: any = null;

    for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt++) {
        try {
            if (input.verbose) {
                if (attempt > 1) {
                    console.log(`[VERBOSE FLOW - filterArticlesFlow] Retrying prompt call (attempt ${attempt}/${MAX_AI_ATTEMPTS})`);
                }
                console.log(`[VERBOSE FLOW - filterArticlesFlow] Calling prompt (attempt ${attempt}) with input:`, JSON.stringify(promptInput, null, 2));
            }
            
            const { output } = await prompt(promptInput);

            if (input.verbose) {
                console.log(`[VERBOSE FLOW - filterArticlesFlow] Prompt output (attempt ${attempt}):`, JSON.stringify(output, null, 2));
            }

            if (output && Array.isArray(output.filteredArticles)) {
                // Basic validation passed, accept the output.
                finalOutput = output;
                break;
            } else {
                 if (input.verbose) console.log(`[VERBOSE FLOW - filterArticlesFlow] AI model output was null or malformed on attempt ${attempt}.`);
                 lastError = new Error("AI output null or malformed.");
                 if (attempt < MAX_AI_ATTEMPTS) continue;
            }

        } catch (error) {
            lastError = error;
            if (input.verbose) {
                console.error(`[VERBOSE FLOW - filterArticlesFlow] Error during prompt call (attempt ${attempt}/${MAX_AI_ATTEMPTS}):`, error);
            }
        }

        if (attempt < MAX_AI_ATTEMPTS) {
            await new Promise(resolve => setTimeout(resolve, AI_RETRY_DELAY_MS));
        }
    }

    if (!finalOutput) {
        console.warn(`filterArticlesFlow: AI model did not return valid output after ${MAX_AI_ATTEMPTS} attempts. Returning original articles. Last error:`, lastError);
        return { filteredArticles: input.articles }; // Failsafe: return original articles
    }
    
    return finalOutput;
  }
);
