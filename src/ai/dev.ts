import { config } from 'dotenv';
config();

import '@/ai/flows/summarize-results.ts';
import '@/ai/flows/filter-rank-results.ts';
import '@/ai/flows/generate-answer-flow.ts';
import '@/ai/flows/generate-search-results-flow.ts';
