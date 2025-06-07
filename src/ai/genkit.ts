import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

const geminiApiKey = process.env.GEMINI_API_KEY;

if (geminiApiKey === 'YOUR_GEMINI_API_KEY_HERE') {
  console.warn(
    '[Genkit] GEMINI_API_KEY is set to the placeholder value. ' +
    'The Google AI plugin might not function correctly or may fall back to other authentication methods if available. ' +
    'Please update it in your .env file and restart your server, or set it in your deployment environment.'
  );
} else if (!geminiApiKey) {
  console.info(
    '[Genkit] GEMINI_API_KEY is not set in the environment. ' +
    'The Google AI plugin will attempt to use Application Default Credentials or other available authentication methods.'
  );
}


export const ai = genkit({
  plugins: [
    googleAI(geminiApiKey && geminiApiKey !== 'YOUR_GEMINI_API_KEY_HERE' ? {apiKey: geminiApiKey} : undefined),
  ],
  model: 'googleai/gemini-2.0-flash',
});
