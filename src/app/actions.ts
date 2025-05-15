// src/app/actions.ts
"use server";

import { z } from "zod";
import { filterAndRankResults, FilterAndRankResultsOutput } from "@/ai/flows/filter-rank-results";
import { summarizeResults, SummarizeResultsOutput } from "@/ai/flows/summarize-results";

const processInformationInputSchema = z.object({
  query: z.string().min(1, "Query is required."),
  rawInformation: z.string().min(1, "Raw information is required."),
});

export type ProcessInformationInput = z.infer<typeof processInformationInputSchema>;

export interface ProcessInformationResult {
  rankedResults?: FilterAndRankResultsOutput;
  summary?: SummarizeResultsOutput;
  error?: string;
}

export async function processInformation(
  input: ProcessInformationInput
): Promise<ProcessInformationResult> {
  const validatedInput = processInformationInputSchema.safeParse(input);

  if (!validatedInput.success) {
    return { error: validatedInput.error.errors.map(e => e.message).join(", ") };
  }

  const { query, rawInformation } = validatedInput.data;

  // Split raw information by newlines for filterAndRankResults
  // Filter out empty lines
  const informationArray = rawInformation.split(/\r?\n/).filter(line => line.trim() !== "");

  if (informationArray.length === 0) {
    return { error: "Raw information must contain at least one non-empty line." };
  }

  try {
    const rankedResults = await filterAndRankResults({
      query,
      information: informationArray,
    });

    const summary = await summarizeResults({
      query,
      results: rawInformation, // Summarize the original full text
    });

    return { rankedResults, summary };
  } catch (e) {
    console.error("Error processing information with AI:", e);
    // It's good practice to not expose raw error messages to the client.
    // Log the detailed error on the server and return a generic message.
    return { error: "An error occurred while processing your request with AI. Please check server logs." };
  }
}
