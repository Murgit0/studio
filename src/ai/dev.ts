import { config } from 'dotenv';
config();

// Import your flows here
// These are not automatically discovered.
// Example: import '@/ai/flows/my-flow.ts';
import '@/ai/flows/generate-answer-flow.ts';
import '@/ai/flows/generate-search-results-flow.ts';
import '@/ai/flows/generate-image-flow.ts'; // Added new image generation flow

// Import your tools here
import '@/ai/tools/perform-web-search.ts';

