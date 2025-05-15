// src/app/actions.ts
"use server";

import { z } from "zod";
import { filterAndRankResults, FilterAndRankResultsOutput } from "@/ai/flows/filter-rank-results";
import { summarizeResults, SummarizeResultsOutput } from "@/ai/flows/summarize-results";

const processInformationInputSchema = z.object({
  query: z.string().min(1, "Query is required."),
  // rawInformation is removed
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

  // const { query } = validatedInput.data; // Query is available if needed for future expansion

  // Since rawInformation input is removed, we no longer call filterAndRankResults or summarizeResults here.
  // The UI will not display these sections if the data is not present.
  // This function could be expanded in the future to use the query for other purposes (e.g., fetching data).
  try {
    // The following AI calls depended on rawInformation, which is no longer provided.
    // const rankedResults = await filterAndRankResults({
    //   query,
    //   information: informationArray,
    // });

    // const summary = await summarizeResults({
    //   query,
    //   results: rawInformation, 
    // });

    // Return an empty result for rankedResults and summary as they are no longer computed here.
    return {
      // rankedResults: undefined, // Implicitly undefined
      // summary: undefined,       // Implicitly undefined
    };
  } catch (e) {
    console.error("Error processing information:", e);
    return { error: "An error occurred while processing your request. Please check server logs." };
  }
}
