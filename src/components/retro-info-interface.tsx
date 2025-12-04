
"use client";

import { useState, useEffect, ChangeEvent } from "react";
import Image from 'next/image';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { processSearchQuery, type SearchActionResult, type ImageResultItem as ActionImageResultItem, type LocationData } from "@/app/actions";
import { Search, Loader2, AlertTriangle, Brain, ListTree, ExternalLink, ImageIcon, MessageCircleMore, MessageCircleOff, History, Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AuthStatus from '@/components/AuthStatus';
import { cn } from "@/lib/utils";

const formSchema = z.object({
  query: z.string().min(3, { message: "Query must be at least 3 characters." }),
});

type FormData = z.infer<typeof formSchema>;

interface DeviceInfo {
  userAgent?: string;
  screenWidth?: number;
  screenHeight?: number;
  os?: string;
}

const MAX_RECENT_SEARCHES = 5;
const LOCAL_STORAGE_RECENT_SEARCHES_KEY = 'xpoxialRecentSearches';

const DEFAULT_LOCATION_INDIA: LocationData = {
  latitude: 28.6139,
  longitude: 77.2090,
};

export default function RetroInfoInterface() {
  const [searchResult, setSearchResult] = useState<SearchActionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [titleClickCount, setTitleClickCount] = useState(0);
  const [rainbowModeActive, setRainbowModeActive] = useState(false);
  const [isVerboseLoggingEnabled, setIsVerboseLoggingEnabled] = useState(false);
  
  const [locationData, setLocationData] = useState<LocationData>(DEFAULT_LOCATION_INDIA); 
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const hasSearched = isLoading || searchResult !== null;
  
  useEffect(() => {
    const userAgent = navigator.userAgent;
    let os = "Unknown OS";
    if (userAgent.indexOf("Win") !== -1) os = "Windows";
    if (userAgent.indexOf("Mac") !== -1) os = "MacOS";
    if (userAgent.indexOf("Android") !== -1) os = "Android";
    else if (userAgent.indexOf("Linux") !== -1) os = "Linux";
    if (userAgent.indexOf("iPhone") !== -1 || userAgent.indexOf("iPad") !== -1) os = "iOS";
    else if (userAgent.indexOf("X11") !== -1 && os === "Unknown OS") os = "UNIX";

    setDeviceInfo({
      userAgent: userAgent,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      os: os,
    });

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocationData({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.warn(`Geolocation error: ${error.message}. Defaulting to India.`);
          setLocationData(DEFAULT_LOCATION_INDIA);
          setTimeout(() => {
             toast({
                variant: "default",
                title: "Location Information",
                description: `Could not determine your precise location. Using a default location (India) for context. Reason: ${error.message}`,
                duration: 7000,
             });
          }, 0);
        }
      );
    } else {
      console.warn("Geolocation is not supported by this browser. Defaulting to India.");
      setLocationData(DEFAULT_LOCATION_INDIA);
      setTimeout(() => {
        toast({
            variant: "default",
            title: "Location Information",
            description: "Geolocation is not supported by this browser. Using a default location (India) for context.",
            duration: 7000,
        });
      }, 0);
    }

    try {
      const storedSearches = localStorage.getItem(LOCAL_STORAGE_RECENT_SEARCHES_KEY);
      if (storedSearches) {
        setRecentSearches(JSON.parse(storedSearches));
      }
    } catch (error) {
      console.error("Failed to load recent searches from localStorage:", error);
    }

  }, [toast]);


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
      setTitleClickCount(0); 
    }
  };

  useEffect(() => {
    if (rainbowModeActive) {
      document.body.classList.add('rainbow-mode');
    } else {
      document.body.classList.remove('rainbow-mode');
    }
    return () => {
      document.body.classList.remove('rainbow-mode');
    };
  }, [rainbowModeActive]);

  async function onSubmit(values: FormData) {
    setIsLoading(true);
    setSearchResult(null);
    const queryToProcess = values.query;

    const updatedRecentSearches = [queryToProcess, ...recentSearches.filter(rs => rs !== queryToProcess)].slice(0, MAX_RECENT_SEARCHES);
    setRecentSearches(updatedRecentSearches);
    try {
      localStorage.setItem(LOCAL_STORAGE_RECENT_SEARCHES_KEY, JSON.stringify(updatedRecentSearches));
    } catch (error) {
      console.error("Failed to save recent searches to localStorage:", error);
    }

    try {
      const response = await processSearchQuery({ 
        query: queryToProcess,
        verbose: isVerboseLoggingEnabled,
        location: locationData, 
        deviceInfo: deviceInfo || undefined,
        recentSearches: updatedRecentSearches,
      });
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

  const handleSearchButtonContextMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsVerboseLoggingEnabled(prev => {
      const newState = !prev;
      toast({
        title: "Verbose Logging",
        description: newState ? "Verbose AI logs enabled." : "Verbose AI logs disabled.",
        icon: newState ? <MessageCircleMore className="h-5 w-5 text-accent" /> : <MessageCircleOff className="h-5 w-5 text-muted-foreground" />
      });
      return newState;
    });
  };

  const handleRecentSearchClick = (searchTerm: string) => {
    form.setValue("query", searchTerm);
    form.handleSubmit(onSubmit)();
  };
  
  const handleQueryInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    form.setValue("query", event.target.value);
  };

  const handleClearHistory = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(LOCAL_STORAGE_RECENT_SEARCHES_KEY);
      toast({
        title: "Search History Cleared",
        description: "Your recent searches have been removed.",
      });
    } catch (error) {
      console.error("Failed to clear recent searches from localStorage:", error);
      toast({
        variant: "destructive",
        title: "Error Clearing History",
        description: "Could not remove search history from local storage.",
      });
    }
  };


  const fetchedImages: ActionImageResultItem[] = searchResult?.searchResults?.images || [];

  return (
    <div className={cn("w-full transition-all duration-500", hasSearched ? "pt-0" : "flex items-center justify-center min-h-[calc(100vh-8rem)]")}>
      <div className="w-full max-w-7xl mx-auto space-y-8">
        
        {/* === Collapsed Header / Search Bar === */}
        <div className={cn(
          "sticky top-0 z-50 w-full bg-background/80 backdrop-blur-sm transition-all duration-300",
          hasSearched ? "opacity-100 py-3" : "opacity-0 -translate-y-full h-0"
        )}>
          <div className="container mx-auto flex items-center gap-4">
            <h1
              onClick={handleTitleClick}
              className="text-2xl font-bold text-primary cursor-pointer select-none"
              title="Try clicking me twice!"
            >
              Xpoxial Search
            </h1>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex-grow flex items-center gap-2">
                <FormField
                  control={form.control}
                  name="query"
                  render={({ field }) => (
                    <FormItem className="flex-grow">
                      <FormControl>
                        <div className="relative">
                           <Input
                            id="collapsed-query"
                            placeholder="Search again..."
                            {...field}
                            onChange={handleQueryInputChange}
                            className="text-sm pr-10"
                          />
                          {field.value && (
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                              onClick={() => form.setValue('query', '')}
                            >
                              <X className="h-4 w-4"/>
                            </Button>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  disabled={isLoading} 
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                  size="icon"
                  onContextMenu={handleSearchButtonContextMenu}
                  title="Left-click to search. Right-click to toggle verbose AI logs."
                >
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                  {isVerboseLoggingEnabled && <MessageCircleMore className="absolute top-0 right-0 h-3 w-3 text-background/80" />}
                </Button>
              </form>
            </Form>
            <AuthStatus />
          </div>
        </div>

        {/* === Initial Fullscreen Search View === */}
        <div className={cn("transition-opacity duration-500", hasSearched ? "opacity-0 h-0 overflow-hidden" : "opacity-100")}>
          <header className="flex justify-between items-center text-center mb-4">
            <div className="flex-1"></div> {/* Spacer */}
            <h1
              onClick={handleTitleClick}
              className="text-5xl font-bold text-primary cursor-pointer select-none flex-grow text-center"
              title="Try clicking me twice!"
            >
              Xpoxial Search
            </h1>
            <div className="flex-1 flex justify-end">
              <AuthStatus />
            </div>
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
                            onChange={handleQueryInputChange} 
                            className="text-sm"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button 
                    type="submit" 
                    disabled={isLoading} 
                    className="w-full bg-accent text-accent-foreground hover:bg-accent/90 text-lg py-6"
                    onContextMenu={handleSearchButtonContextMenu}
                    title="Left-click to search. Right-click to toggle verbose AI logs."
                  >
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
                    {isVerboseLoggingEnabled && <MessageCircleMore className="ml-2 h-4 w-4 text-accent-foreground/70" />}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {recentSearches.length > 0 && (
            <Card className="border-secondary shadow-lg shadow-secondary/20 mt-8">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-accent" />
                  <CardTitle className="text-xl">Recent Searches</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClearHistory}
                  title="Clear search history"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-5 w-5" />
                  <span className="sr-only">Clear search history</span>
                </Button>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {recentSearches.map((searchTerm, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => handleRecentSearchClick(searchTerm)}
                    className="text-sm hover:bg-accent/10"
                  >
                    {searchTerm}
                  </Button>))}
              </CardContent>
            </Card>
          )}
        </div>


        {/* === Search Results View === */}
        {hasSearched && (
          <div className="space-y-8">
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
                                hint = hint || "image"; 
                                hint = hint.split(' ').slice(0, 2).join(' '); 

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
        )}
      </div>
    </div>
  );
}
