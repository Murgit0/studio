
'use server';
/**
 * @fileOverview A tool for performing a news search using the NewsAPI.
 *
 * - performNewsSearch - A function that wraps the tool to fetch news articles.
 * - PerformNewsSearchInput - The input type for the performNewsSearch function.
 * - NewsArticleItem - The type for a single news article item.
 * - PerformNewsSearchOutput - The return type for the performNewsSearch function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Schema for the tool's input
const PerformNewsSearchInputSchema = z.object({
  query: z.string().describe('The search query for news articles.'),
  verbose: z.boolean().optional().describe('Enable verbose logging for the tool.'),
});
export type PerformNewsSearchInput = z.infer<typeof PerformNewsSearchInputSchema>;

// Schema for a single news article item
const NewsArticleItemSchema = z.object({
  title: z.string().describe('The headline or title of the news article.'),
  description: z.string().nullable().describe('A brief description of the news article.'),
  url: z.string().url().describe('The direct URL to the news article.'),
  source: z.string().describe('The name of the news source (e.g., "The New York Times").'),
  publishedAt: z.string().describe('The publication date of the article in ISO 8601 format.'),
});
export type NewsArticleItem = z.infer<typeof NewsArticleItemSchema>;

// Schema for the tool's output
const PerformNewsSearchOutputSchema = z.object({
  articles: z.array(NewsArticleItemSchema).describe('An array of news articles relevant to the query.'),
});
export type PerformNewsSearchOutput = z.infer<typeof PerformNewsSearchOutputSchema>;

/**
 * Wrapper function to call the performNewsSearchTool's logic.
 */
export async function performNewsSearch(input: PerformNewsSearchInput): Promise<PerformNewsSearchOutput> {
  if (input.verbose) {
    console.log(`[VERBOSE TOOL - performNewsSearch wrapper] Input:`, JSON.stringify(input, null, 2));
  }
  const result = await performNewsSearchToolHandler(input);
  if (input.verbose) {
    console.log(`[VERBOSE TOOL - performNewsSearch wrapper] Output:`, JSON.stringify(result, null, 2));
  }
  return result;
}

const MAX_ARTICLES = 10;
const MAX_API_ATTEMPTS = 2;
const RETRY_DELAY_MS = 500;

async function performNewsSearchToolHandler(input: PerformNewsSearchInput): Promise<PerformNewsSearchOutput> {
  if (input.verbose) {
    console.log(`[VERBOSE TOOL - performNewsSearchToolHandler] Starting for query: "${input.query}"`);
  }
  const newsApiKey = process.env.NEWS_API_KEY;

  if (!newsApiKey || newsApiKey === 'YOUR_NEWS_API_KEY') {
    let warningMessage = 'NewsAPI not configured: ';
    if (!newsApiKey) warningMessage += 'NEWS_API_KEY missing. ';
    if (newsApiKey === 'YOUR_NEWS_API_KEY') warningMessage += 'NEWS_API_KEY is a placeholder. ';
    console.warn(`${warningMessage}Skipping news search.`);
    if (input.verbose) console.log(`[VERBOSE TOOL] ${warningMessage}`);
    return { articles: getMockNews(input.query).articles }; // Return mock news if not configured
  }

  let articles: NewsArticleItem[] = [];
  let attempts = 0;

  while (attempts < MAX_API_ATTEMPTS && articles.length === 0) {
    attempts++;
    if (input.verbose && attempts > 1) {
      console.log(`[VERBOSE TOOL] Retrying NewsAPI (attempt ${attempts}/${MAX_API_ATTEMPTS}) for query: "${input.query}"`);
    }

    try {
      // Using NewsAPI.org's 'everything' endpoint.
      const newsApiUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(input.query)}&apiKey=${newsApiKey}&pageSize=${MAX_ARTICLES}&sortBy=publishedAt`;
      if (input.verbose) console.log(`[VERBOSE TOOL] NewsAPI URL (attempt ${attempts}): ${newsApiUrl}`);
      
      const response = await fetch(newsApiUrl);

      if (!response.ok) {
        const errorData = await response.text();
        console.error(`NewsAPI request failed on attempt ${attempts}/${MAX_API_ATTEMPTS} with status ${response.status}: ${errorData}`);
        if (input.verbose) console.log(`[VERBOSE TOOL] NewsAPI error response text (attempt ${attempts}): ${errorData}`);
        // If it's a 4xx error (like invalid key), don't retry.
        if (response.status >= 400 && response.status < 500) break;
      } else {
        const newsData = await response.json();
        if (input.verbose) console.log(`[VERBOSE TOOL] NewsAPI Raw Response (attempt ${attempts}):`, JSON.stringify(newsData, null, 2));

        if (newsData.articles && newsData.articles.length > 0) {
          articles = newsData.articles
            .filter((item: any) => item.title && item.url && item.source?.name && item.publishedAt && item.title !== '[Removed]')
            .map((item: any): NewsArticleItem => ({
              title: item.title,
              description: item.description || null,
              url: item.url,
              source: item.source.name,
              publishedAt: item.publishedAt,
            }));
          console.log(`Fetched ${articles.length} news article(s) from NewsAPI (attempt ${attempts}/${MAX_API_ATTEMPTS}).`);
          break; // Success, exit retry loop
        } else {
          console.log(`No news articles found on NewsAPI after ${attempts} attempts for "${input.query}".`);
        }
      }
    } catch (error) {
      console.error(`Error fetching news from NewsAPI on attempt ${attempts}/${MAX_API_ATTEMPTS}:`, error);
      if (input.verbose) console.log(`[VERBOSE TOOL] Exception during NewsAPI call (attempt ${attempts}):`, error);
    }
    if (articles.length === 0 && attempts < MAX_API_ATTEMPTS) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  if (articles.length === 0) {
    console.warn('No news articles returned from NewsAPI. Returning mock articles.');
    if (input.verbose) console.log('[VERBOSE TOOL] Using mock news articles.');
    articles = getMockNews(input.query).articles;
  }

  return { articles };
}

function getMockNews(query: string): PerformNewsSearchOutput {
  const safeQuery = query || "mock";
  return {
    articles: Array.from({ length: 10 }).map((_, i) => ({
      title: `Mock News ${i + 1}: ${safeQuery}`,
      description: `This is mock news article ${i+1}. To get real news, please provide a valid NEWS_API_KEY in your environment variables.`,
      url: `https://example.com/mock-news${i+1}`,
      source: "Mock News Provider",
      publishedAt: new Date().toISOString(),
    })),
  };
}

const performNewsSearchTool = ai.defineTool(
  {
    name: 'performNewsSearch',
    description: 'Performs a news search using the NewsAPI to find recent, relevant articles.',
    inputSchema: PerformNewsSearchInputSchema,
    outputSchema: PerformNewsSearchOutputSchema,
  },
  performNewsSearchToolHandler
);
