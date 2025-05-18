'use server';
/**
 * @fileOverview Generates an image based on a user's query.
 *
 * - generateImage - A function that uses an AI model to generate an image.
 * - GenerateImageInput - Input type for the image generation.
 * - GenerateImageOutput - Output type for the image generation (data URI).
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateImageInputSchema = z.object({
  query: z.string().describe('The user query for which to generate an image.'),
});
export type GenerateImageInput = z.infer<typeof GenerateImageInputSchema>;

const GenerateImageOutputSchema = z.object({
  imageDataUri: z.string().optional().describe('The generated image as a data URI (e.g., data:image/png;base64,...), or undefined if no image could be generated.'),
});
export type GenerateImageOutput = z.infer<typeof GenerateImageOutputSchema>;

export async function generateImage(input: GenerateImageInput): Promise<GenerateImageOutput> {
  return generateImageFlow(input);
}

// Note: Image generation with gemini-2.0-flash-exp can be experimental.
// The prompt needs to be clear about expecting an image.
const generateImageFlow = ai.defineFlow(
  {
    name: 'generateImageFlow',
    inputSchema: GenerateImageInputSchema,
    outputSchema: GenerateImageOutputSchema,
  },
  async (input) => {
    try {
      const {media} = await ai.generate({
        model: 'googleai/gemini-2.0-flash-exp', // IMPORTANT: Must use this model for image generation
        prompt: `Generate a single, visually appealing image that creatively represents the concept: "${input.query}".`,
        config: {
          responseModalities: ['IMAGE', 'TEXT'], // Must include IMAGE. TEXT is also good practice.
          // Optional: Add safety settings if needed, e.g.
          // safetySettings: [
          //   { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
          // ],
        },
      });

      if (media && media.url) {
        return { imageDataUri: media.url };
      }
      return { imageDataUri: undefined };
    } catch (error) {
      console.error('Error during image generation flow:', error);
      // It's better to return undefined than to let the whole flow fail if only image gen has an issue.
      return { imageDataUri: undefined }; 
    }
  }
);
