// src/components/retro-info-interface.tsx
"use client";

import { useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { processInformation, type ProcessInformationResult } from "@/app/actions";
import { Search, Loader2, AlertTriangle, ListChecks, ScrollText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  query: z.string().min(3, { message: "Query must be at least 3 characters." }),
  rawInformation: z.string().min(10, { message: "Raw information must be at least 10 characters." }),
});

type FormData = z.infer<typeof formSchema>;

export default function RetroInfoInterface() {
  const [result, setResult] = useState<ProcessInformationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      query: "",
      rawInformation: "",
    },
  });

  async function onSubmit(values: FormData) {
    setIsLoading(true);
    setResult(null); // Clear previous results

    try {
      const response = await processInformation(values);
      setResult(response);
      if (response.error) {
        toast({
          variant: "destructive",
          title: "Processing Error",
          description: response.error,
        });
      } else {
         toast({
          title: "Processing Complete",
          description: "Information processed successfully.",
        });
      }
    } catch (error) {
      console.error("Submission error:", error);
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      setResult({ error: errorMessage });
      toast({
        variant: "destructive",
        title: "Submission Error",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8">
      <header className="text-center">
        <h1 className="text-5xl font-bold text-primary mb-2">RetroInfo</h1>
        <p className="text-muted-foreground text-lg">AI-Powered Information Discovery</p>
      </header>

      <Card className="border-primary shadow-lg shadow-primary/20">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2"><Search className="h-6 w-6 text-accent" /> Input Your Data</CardTitle>
          <CardDescription>Provide a query and raw information to filter, rank, and summarize.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="query"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="query" className="text-lg">Search Query</FormLabel>
                    <FormControl>
                      <Input
                        id="query"
                        placeholder="e.g., 'benefits of exercise'"
                        {...field}
                        className="text-base"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rawInformation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="rawInformation" className="text-lg">Raw Information</FormLabel>
                    <FormDescription>Paste the text data you want to process. Each line can be treated as a separate snippet.</FormDescription>
                    <FormControl>
                      <Textarea
                        id="rawInformation"
                        placeholder="Paste your raw text data here..."
                        rows={10}
                        {...field}
                        className="text-base leading-relaxed"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 text-lg py-6">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-5 w-5" />
                    Discover Information
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {result && result.error && (
        <Card className="border-destructive shadow-lg shadow-destructive/20">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-6 w-6" /> Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive-foreground">{result.error}</p>
          </CardContent>
        </Card>
      )}

      {result && !result.error && (
        <div className="space-y-8">
          {result.rankedResults && result.rankedResults.length > 0 && (
            <Card className="border-primary shadow-lg shadow-primary/20">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2"><ListChecks className="h-6 w-6 text-accent"/> Filtered & Ranked Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.rankedResults.map((item, index) => (
                  <Card key={index} className="bg-card/50 border-border/50">
                    <CardHeader>
                      <CardTitle className="text-lg text-primary">Snippet {index + 1}</CardTitle>
                      <CardDescription>Relevance Score: <span className="font-bold text-accent">{(item.relevanceScore * 100).toFixed(0)}%</span></CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed">{item.snippet}</p>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          )}

          {result.summary && (
            <Card className="border-primary shadow-lg shadow-primary/20">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2"><ScrollText className="h-6 w-6 text-accent"/> AI Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-base leading-relaxed whitespace-pre-wrap">{result.summary.summary}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
