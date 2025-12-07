
'use server';
/**
 * @fileOverview Generates a conversational response from an AI chatbot.
 *
 * - generateChatResponse - A function that returns a response based on conversation history.
 * - GenerateChatResponseInput - The input type for the generateChatResponse function.
 * - GenerateChatResponseOutput - The return type for the generateChatResponse function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Schema for a single chat message
const ChatMessageSchema = z.object({
  role: z.enum(['user', 'model']).describe("The role of the message sender, either 'user' or 'model'."),
  content: z.string().describe("The text content of the message."),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// Schema for the flow's input
const GenerateChatResponseInputSchema = z.object({
  history: z.array(ChatMessageSchema).describe("The history of the conversation so far."),
  message: z.string().describe("The new message from the user."),
  verbose: z.boolean().optional().describe('Enable verbose logging for the flow.'),
});
export type GenerateChatResponseInput = z.infer<typeof GenerateChatResponseInputSchema>;

// Schema for the flow's output
const GenerateChatResponseOutputSchema = z.object({
  response: z.string().describe("The chatbot's response message."),
});
export type GenerateChatResponseOutput = z.infer<typeof GenerateChatResponseOutputSchema>;


export async function generateChatResponse(input: GenerateChatResponseInput): Promise<GenerateChatResponseOutput> {
  if (input.verbose) {
    console.log(`[VERBOSE FLOW WRAPPER - generateChatResponse] Input:`, JSON.stringify(input, null, 2));
  }
  const result = await generateChatResponseFlow(input);
  if (input.verbose) {
    console.log(`[VERBOSE FLOW WRAPPER - generateChatResponse] Output:`, JSON.stringify(result, null, 2));
  }
  return result;
}

const prompt = ai.definePrompt({
  name: 'generateChatResponsePrompt',
  input: {schema: GenerateChatResponseInputSchema.omit({ verbose: true })},
  output: {schema: GenerateChatResponseOutputSchema},
  prompt: `You are a helpful and friendly AI assistant for Xpoxial Search.
Your role is to engage in a conversation with the user, answering their questions and responding to their statements.
Use the provided conversation history to maintain context.

{{#each history}}
{{#if (eq role 'user')}}
User: {{{content}}}
{{else}}
Model: {{{content}}}
{{/if}}
{{/each}}

User: {{{message}}}
Model:`,
});

const generateChatResponseFlow = ai.defineFlow(
  {
    name: 'generateChatResponseFlow',
    inputSchema: GenerateChatResponseInputSchema,
    outputSchema: GenerateChatResponseOutputSchema,
  },
  async (input) => {
    const { output } = await prompt({
      history: input.history,
      message: input.message,
    });
    
    if (!output) {
      return { response: "I'm sorry, I couldn't generate a response. Please try again." };
    }

    return { response: output.response };
  }
);
