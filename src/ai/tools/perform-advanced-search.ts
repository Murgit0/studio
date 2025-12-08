'use server';
/**
 * @fileOverview A tool for performing an advanced search using SerpApi to query multiple search engines.
 *
 * - performAdvancedSearch - A function that wraps the tool to fetch search results.
 * - PerformAdvancedSearchInput - The input type for the performAdvancedSearch function.
 * - PerformAdvancedSearchOutput - The return type for the performAdvancedSearch function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getJson, type SerpAPIParameters } from 'serpapi';

// --- Input Schema ---
const PerformAdvancedSearchInputSchema = z.object({
  query: z.string().describe('The search query.'),
  verbose: z.boolean().optional().describe('Enable verbose logging for the tool.'),
});
export type PerformAdvancedSearchInput = z.infer<typeof PerformAdvancedSearchInputSchema>;


// --- Output Schemas ---
const WebResultSchema = z.object({
  position: z.number().optional(),
  title: z.string().optional(),
  link: z.string().url().optional(),
  snippet: z.string().optional(),
});

const ImageResultSchema = z.object({
  position: z.number().optional(),
  thumbnail: z.string().url().optional(),
  original: z.string().url().optional(),
  title: z.string().optional(),
  link: z.string().url().optional(),
  source: z.string().optional(),
});

const VideoResultSchema = z.object({
  position: z.number().optional(),
  title: z.string().optional(),
  link: z.string().url().optional(),
  thumbnail: z.string().url().optional(),
  duration: z.string().optional(),
});

const RelatedQuestionSchema = z.object({
  question: z.string().optional(),
  snippet: z.string().optional(),
  title: z.string().optional(),
  link: z.string().url().optional(),
});

const EngineResultSchema = z.object({
  webResults: z.array(WebResultSchema).optional(),
  imageResults: z.array(ImageResultSchema).optional(),
  videoResults: z.array(VideoResultSchema).optional(),
  relatedQuestions: z.array(RelatedQuestionSchema).optional(),
  error: z.string().optional(),
});

const PerformAdvancedSearchOutputSchema = z.object({
  google: EngineResultSchema.optional(),
  duckduckgo: EngineResultSchema.optional(),
  yahoo: EngineResultSchema.optional(),
  bing: EngineResultSchema.optional(),
});
export type PerformAdvancedSearchOutput = z.infer<typeof PerformAdvancedSearchOutputSchema>;


/**
 * Wrapper function to call the performAdvancedSearchTool's logic.
 */
export async function performAdvancedSearch(input: PerformAdvancedSearchInput): Promise<PerformAdvancedSearchOutput> {
  if (input.verbose) {
    console.log(`[VERBOSE TOOL - performAdvancedSearch wrapper] Input:`, JSON.stringify(input, null, 2));
  }
  const result = await performAdvancedSearchToolHandler(input);
  if (input.verbose) {
    console.log(`[VERBOSE TOOL - performAdvancedSearch wrapper] Output:`, JSON.stringify(result, null, 2));
  }
  return result;
}

const engines = ['google', 'duckduckgo', 'yahoo', 'bing'];

async function searchEngine(engine: string, query: string, apiKey: string, isVerbose: boolean): Promise<EngineResultSchema> {
  if (isVerbose) {
    console.log(`[VERBOSE TOOL] Querying ${engine} for "${query}"`);
  }
  try {
    const params: SerpAPIParameters = {
      q: query,
      engine: engine,
      api_key: apiKey,
    };
    
    const response = await getJson(params);
    
    if (isVerbose) {
      console.log(`[VERBOSE TOOL] Raw response from ${engine}:`, JSON.stringify(response, null, 2));
    }

    return {
      webResults: response.organic_results?.map((r: any) => ({
        position: r.position,
        title: r.title,
        link: r.link,
        snippet: r.snippet,
      })),
      imageResults: response.images_results?.map((r: any) => ({
        position: r.position,
        thumbnail: r.thumbnail,
        original: r.original,
        title: r.title,
        link: r.link,
        source: r.source,
      })),
      videoResults: response.video_results?.map((r: any) => ({
        position: r.position,
        title: r.title,
        link: r.link,
        thumbnail: r.thumbnail,
        duration: r.duration,
      })),
      relatedQuestions: response.related_questions?.map((r: any) => ({
        question: r.question,
        snippet: r.snippet,
        title: r.title,
        link: r.link,
      })),
    };
  } catch (error: any) {
    console.error(`Error searching with ${engine}:`, error);
    if (isVerbose) {
        console.log(`[VERBOSE TOOL] Error for ${engine}:`, error);
    }
    return { error: error.message || 'An unknown error occurred' };
  }
}

async function performAdvancedSearchToolHandler(input: PerformAdvancedSearchInput): Promise<PerformAdvancedSearchOutput> {
  const { query, verbose = false } = input;
  const apiKey = process.env.SERP_API_KEY;

  if (!apiKey || apiKey === 'YOUR_SERP_API_KEY_HERE') {
    console.warn('SERP_API_KEY is not configured. Please set it in your .env file. Returning empty results.');
    return {};
  }
  
  const searchPromises = engines.map(engine => searchEngine(engine, query, apiKey, verbose));
  
  const results = await Promise.all(searchPromises);
  
  const output: PerformAdvancedSearchOutput = {};
  engines.forEach((engine, index) => {
    output[engine as keyof PerformAdvancedSearchOutput] = results[index];
  });
  
  return output;
}

const performAdvancedSearchTool = ai.defineTool(
  {
    name: 'performAdvancedSearch',
    description: 'Performs an advanced search across Google, DuckDuckGo, Yahoo, and Bing using SerpApi.',
    inputSchema: PerformAdvancedSearchInputSchema,
    outputSchema: PerformAdvancedSearchOutputSchema,
  },
  performAdvancedSearchToolHandler
);
