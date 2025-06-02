
"use client";

import { useState, useEffect } from "react";
import Image from 'next/image';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { processSearchQuery, type SearchActionResult, type ImageResultItem as ActionImageResultItem } from "@/app/actions";
import { Search, Loader2, AlertTriangle, Brain, ListTree, ExternalLink, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  query: z.string().min(3, { message: "Query must be at least 3 characters." }),
});

type FormData = z.infer<typeof formSchema>;

export default function RetroInfoInterface() {
  const [searchResult, setSearchResult] = useState<SearchActionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [titleClickCount, setTitleClickCount] = useState(0);
  const [rainbowModeActive, setRainbowModeActive] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      query: "",
    },
  });

  const handleTitleClick = () => {
    const newClickCount = titleClickCount + 1;
    setTitleClickCount(newClickCount);
    if (newClickCount >= 2) {
      setRainbowModeActive(prev => !prev);
      setTitleClickCount(0); // Reset for next double-click
    }
  };

  useEffect(() => {
    if (rainbowModeActive) {
      document.body.classList.add('rainbow-mode');
    } else {
      document.body.classList.remove('rainbow-mode');
    }
    // Cleanup function to remove class if component unmounts while active
    // or if rainbowModeActive becomes false.
    return () => {
      document.body.classList.remove('rainbow-mode');
    };
  }, [rainbowModeActive]);

  async function onSubmit(values: FormData) {
    setIsLoading(true);
    setSearchResult(null);

    try {
      const response = await processSearchQuery({ query: values.query });
      setSearchResult(response);

      if (response.error) {
        toast({
          variant: "destructive",
          title: "Processing Issue",
          description: response.error,
        });
      } else if (!response.answer?.answer && (!response.searchResults?.webResults || response.searchResults.webResults.length === 0) && (!response.searchResults?.images || response.searchResults.images.length === 0)) {
        toast({
          variant: "default",
          title: "No Specific Results",
          description: "The AI couldn't generate specific content for your query. Try rephrasing.",
        });
      } else {
         toast({
          title: "Search Complete",
          description: "Your query has been processed.",
        });
      }
    } catch (error) {
      console.error("Submission error:", error);
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      setSearchResult({ error: errorMessage });
      toast({
        variant: "destructive",
        title: "Submission Error",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }

  const fetchedImages: ActionImageResultItem[] = searchResult?.searchResults?.images || [];

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8">
      <header className="text-center">
        <h1
          onClick={handleTitleClick}
          className="text-5xl font-bold text-primary mb-2 cursor-pointer select-none"
          title="Try clicking me twice!"
        >
          Xpoxial Search
        </h1>
      </header>

      <Card className="border-primary shadow-lg shadow-primary/20">
        <CardContent className="pt-6">
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
                        placeholder="e.g., 'latest advancements in AI'"
                        {...field}
                        className="text-sm"
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
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-5 w-5" />
                    Search
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex justify-center items-center p-10">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
          <p className="ml-4 text-xl text-muted-foreground">Searching the digital cosmos...</p>
        </div>
      )}

      {searchResult && searchResult.error && !isLoading && (
        <Card className="border-destructive shadow-lg shadow-destructive/20">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-6 w-6" /> Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive-foreground whitespace-pre-wrap">{searchResult.error}</p>
          </CardContent>
        </Card>
      )}

      {searchResult && !searchResult.error && !isLoading && (
        <>
          {(!searchResult.answer?.answer &&
           (!searchResult.searchResults?.webResults || searchResult.searchResults.webResults.length === 0) &&
           fetchedImages.length === 0
          ) ? (
            <Card className="border-primary shadow-lg shadow-primary/20">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2"><Search className="h-6 w-6 text-accent"/> No Specific Results</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-base leading-relaxed">
                  The AI couldn't generate specific content for your query. Try rephrasing or broadening your search.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Main Content Column (AI Answer + Search Results List) */}
              <div className="md:col-span-2 space-y-8">
                {searchResult.answer && searchResult.answer.answer && (
                  <Card className="border-accent shadow-lg shadow-accent/20">
                    <CardHeader>
                      <CardTitle className="text-2xl flex items-center gap-2"><Brain className="h-6 w-6 text-accent"/> AI Answer</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-base leading-relaxed whitespace-pre-wrap">{searchResult.answer.answer}</p>
                    </CardContent>
                  </Card>
                )}

                {searchResult.searchResults && searchResult.searchResults.webResults && searchResult.searchResults.webResults.length > 0 && (
                  <Card className="border-primary shadow-lg shadow-primary/20">
                    <CardHeader>
                      <CardTitle className="text-2xl flex items-center gap-2"><ListTree className="h-6 w-6 text-accent"/> Search Results</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {searchResult.searchResults.webResults.map((item, index) => (
                        <Card key={index} className="bg-card/50 border-border/50 hover:border-accent transition-colors duration-150">
                          <CardContent className="pt-6">
                            <div className="flex-grow">
                              <CardTitle className="text-lg mb-1">
                                <a
                                  href={item.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:text-accent hover:underline flex items-center gap-1 group"
                                >
                                  {item.title}
                                  <ExternalLink className="h-4 w-4 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
                                </a>
                              </CardTitle>
                              <CardDescription className="text-xs text-muted-foreground pt-1 break-all mb-2">{item.link}</CardDescription>
                              <p className="text-sm leading-relaxed mb-2">{item.snippet}</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* New Images Section Column */}
              {fetchedImages.length > 0 && (
                <div className="md:col-span-1 space-y-8">
                  <Card className="border-secondary shadow-lg shadow-secondary/20">
                    <CardHeader>
                      <CardTitle className="text-xl flex items-center gap-2">
                        <ImageIcon className="h-5 w-5 text-accent"/> Images
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        {fetchedImages.map((img, index) => {
                          let hint = "image";
                          const currentQuery = form.getValues("query").split(' ').slice(0, 2).join(' ') || "image query";

                          if (img.imageUrl.includes('placehold.co')) {
                            hint = currentQuery;
                          } else if (img.altText && !img.altText.toLowerCase().startsWith('image related to') && !img.altText.toLowerCase().includes(currentQuery.toLowerCase())) {
                            hint = img.altText.split(' ').slice(0, 2).join(' ');
                          } else {
                            hint = currentQuery;
                          }
                          hint = hint || "image"; // Ensure hint is never empty
                          hint = hint.split(' ').slice(0, 2).join(' '); // Limit to two words

                          return (
                            <div key={index} className="group">
                              <a href={img.sourceUrl || '#'} target="_blank" rel="noopener noreferrer" className="block">
                                <div className="relative w-full aspect-square mb-1">
                                  <Image
                                    src={img.imageUrl}
                                    alt={img.altText || `Image ${index + 1} for ${form.getValues("query")}`}
                                    fill
                                    style={{ objectFit: 'cover' }}
                                    className="rounded-md border border-border shadow-md group-hover:opacity-80 transition-opacity"
                                    data-ai-hint={hint}
                                    priority={index < 4}
                                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                                  />
                                </div>
                              </a>
                              {/* Attribution text removed as per request */}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
