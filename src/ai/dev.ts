import { config } from 'dotenv';
config();

// Import your flows here
// These are not automatically discovered.
// Example: import '@/ai/flows/my-flow.ts';
// import '@/ai/flows/summarize-results.ts'; // Removed as it's not currently used by the main search action
// import '@/ai/flows/filter-rank-results.ts'; // Removed as it's not currently used by the main search action
import '@/ai/flows/generate-answer-flow.ts';
import '@/ai/flows/generate-search-results-flow.ts';

// Import your tools here
import '@/ai/tools/perform-web-search.ts';
