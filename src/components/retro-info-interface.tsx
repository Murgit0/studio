
// src/components/retro-info-interface.tsx
"use client";

import { useState } from "react";
import Image from 'next/image';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { processSearchQuery, type SearchActionResult } from "@/app/actions";
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

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      query: "",
    },
  });

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
      } else if (!response.answer?.answer && (!response.searchResults?.results || response.searchResults.results.length === 0) && !response.searchResults?.results?.some(item => item.imageUrl)) {
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

  const allImagesFromResults = searchResult?.searchResults?.results
    ?.filter(item => !!item.imageUrl)
    .map(item => ({
      url: item.imageUrl!,
      alt: `Image for ${item.title}`,
      link: item.link,
      photographerName: item.imagePhotographerName,
      photographerUrl: item.imagePhotographerUrl,
      sourcePlatform: item.imageSourcePlatform,
      sourceUrl: item.imageSourceUrl,
      title: item.title // For data-ai-hint
    })) || [];


  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8">
      <header className="text-center">
        <h1 className="text-5xl font-bold text-primary mb-2">Xpoxial Search</h1>
      </header>

      <Card className="border-primary shadow-lg shadow-primary/20">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2"><Search className="h-6 w-6 text-accent" /> Enter Your Query</CardTitle>
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
           (!searchResult.searchResults?.results || searchResult.searchResults.results.length === 0) &&
           allImagesFromResults.length === 0
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

                {searchResult.searchResults && searchResult.searchResults.results && searchResult.searchResults.results.length > 0 && (
                  <Card className="border-primary shadow-lg shadow-primary/20">
                    <CardHeader>
                      <CardTitle className="text-2xl flex items-center gap-2"><ListTree className="h-6 w-6 text-accent"/> Search Results</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {searchResult.searchResults.results.map((item, index) => (
                        <Card key={index} className="bg-card/50 border-border/50 hover:border-accent transition-colors duration-150">
                          <CardContent className="pt-6 flex flex-col md:flex-row gap-4">
                            {item.imageUrl && (
                              <div className="relative w-full md:w-32 h-32 md:h-24 shrink-0">
                                 <Image
                                  src={item.imageUrl}
                                  alt={`Thumbnail for ${item.title}`}
                                  layout="fill"
                                  objectFit="cover"
                                  className="rounded-md border border-border shadow-md"
                                  data-ai-hint={item.imageUrl.includes('placehold.co') ? item.title.split(' ').slice(0, 2).join(' ') : "search result"}
                                />
                              </div>
                            )}
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
                              {item.imageUrl && (item.imagePhotographerName || item.imageSourcePlatform) && (
                                <p className="text-xs text-muted-foreground/80 mt-1">
                                  {item.imagePhotographerName && (
                                    <>
                                      Photo by{' '}
                                      {item.imagePhotographerUrl ? (
                                        <a href={item.imagePhotographerUrl} target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-accent">
                                          {item.imagePhotographerName}
                                        </a>
                                      ) : (
                                        item.imagePhotographerName
                                      )}
                                    </>
                                  )}
                                  {item.imagePhotographerName && item.imageSourcePlatform && ' on '}
                                  {!item.imagePhotographerName && item.imageSourcePlatform && 'Image via '}
                                  {item.imageSourcePlatform && (
                                    <>
                                      {item.imageSourceUrl ? (
                                        <a href={item.imageSourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-accent">
                                          {item.imageSourcePlatform}
                                        </a>
                                      ) : (
                                        item.imageSourcePlatform
                                      )}
                                    </>
                                  )}
                                </p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* New Images Section Column */}
              {allImagesFromResults.length > 0 && (
                <div className="md:col-span-1 space-y-8">
                  <Card className="border-secondary shadow-lg shadow-secondary/20">
                    <CardHeader>
                      <CardTitle className="text-xl flex items-center gap-2">
                        <ImageIcon className="h-5 w-5 text-accent"/> Images
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        {allImagesFromResults.map((img, index) => (
                          <div key={index} className="group relative">
                            <a href={img.link} target="_blank" rel="noopener noreferrer" className="block">
                              <div className="relative w-full aspect-square mb-1">
                                <Image
                                  src={img.url}
                                  alt={img.alt}
                                  layout="fill"
                                  objectFit="cover"
                                  className="rounded-md border border-border shadow-md group-hover:opacity-80 transition-opacity"
                                  data-ai-hint={img.url.includes('placehold.co') ? img.title.split(' ').slice(0, 2).join(' ') : "search image"}
                                />
                              </div>
                            </a>
                             {(img.photographerName || img.sourcePlatform) && (
                               <p className="text-[0.65rem] leading-tight text-muted-foreground/80 mt-1 text-center">
                                {img.photographerName && (
                                  <>
                                    Photo by{' '}
                                    {img.photographerUrl ? (
                                      <a href={img.photographerUrl} target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-accent">
                                        {img.photographerName}
                                      </a>
                                    ) : (
                                      img.photographerName
                                    )}
                                  </>
                                )}
                                {img.photographerName && img.sourcePlatform && ' on '}
                                {!img.photographerName && img.sourcePlatform && 'Image via '}
                                {img.sourcePlatform && (
                                  <>
                                    {img.sourceUrl ? (
                                      <a href={img.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-accent">
                                        {img.sourcePlatform}
                                      </a>
                                    ) : (
                                      img.sourcePlatform
                                    )}
                                  </>
                                )}
                              </p>
                            )}
                          </div>
                        ))}
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
