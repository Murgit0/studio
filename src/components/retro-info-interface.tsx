
"use client";

import { useState, useEffect, ChangeEvent, FormEvent } from "react";
import Image from 'next/image';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { processSearchQuery, type SearchActionResult, type ImageResultItem as ActionImageResultItem, type LocationData } from "@/app/actions";
import { Search, Loader2, AlertTriangle, Brain, ListTree, ExternalLink, ImageIcon, MessageCircleMore, History, Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AuthStatus from '@/components/AuthStatus';
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger, PopoverAnchor } from "@/components/ui/popover";

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

const GENERIC_ERROR_MESSAGE = "Contact developer and lodge an issue";


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
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

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
    };
    return () => {
      document.body.classList.remove('rainbow-mode');
    };
  }, [rainbowModeActive]);

  async function onSubmit(values: FormData) {
    setIsLoading(true);
    setSearchResult(null);
    setIsPopoverOpen(false);
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
      setSearchResult({ error: GENERIC_ERROR_MESSAGE });
      toast({
        variant: "destructive",
        title: "Submission Error",
        description: GENERIC_ERROR_MESSAGE,
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
      });
      return newState;
    });
  };

  const handleRecentSearchClick = (searchTerm: string) => {
    form.setValue("query", searchTerm);
    setIsPopoverOpen(false);
    form.handleSubmit(onSubmit)();
  };
  
  const handleQueryInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    form.setValue("query", event.target.value);
    const value = event.target.value;
    if (value.length > 0) {
      setIsPopoverOpen(true);
    } else {
      setIsPopoverOpen(false);
    }
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
        description: GENERIC_ERROR_MESSAGE,
      });
    }
  };


  const fetchedImages: ActionImageResultItem[] = searchResult?.searchResults?.images || [];
  const hasSearched = isLoading || searchResult !== null;

  const SearchFormComponent = ({ isHeader }: { isHeader: boolean }) => (
      <Form {...form}>
        <form 
            onSubmit={form.handleSubmit(onSubmit)} 
            className={cn(
                "w-full flex items-stretch gap-2", 
                isHeader ? "max-w-xl mx-auto flex-row" : "max-w-2xl flex-col"
            )}
        >
          <Popover open={isPopoverOpen && !isHeader} onOpenChange={setIsPopoverOpen}>
            <PopoverAnchor asChild>
                <FormField
                    control={form.control}
                    name="query"
                    render={({ field }) => (
                    <FormItem className="flex-grow w-full">
                        {!isHeader && <FormLabel htmlFor="main-query-input" className="sr-only">Search Query</FormLabel>}
                        <FormControl>
                        <div className="relative">
                            <Input
                                id={isHeader ? "header-query-input" : "main-query-input"}
                                placeholder="e.g., 'latest advancements in AI'"
                                {...field}
                                onChange={handleQueryInputChange}
                                className={cn(
                                    "text-base", 
                                    isHeader ? "h-11 pr-10" : "h-12 bg-input placeholder:text-muted-foreground/80 border-secondary focus:border-accent"
                                )}
                                onFocus={() => setIsPopoverOpen(true)}
                                autoComplete="off"
                            />
                            {field.value && (
                            <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground"
                                onClick={() => {form.setValue('query', ''); form.setFocus('query'); setIsPopoverOpen(true);}}
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
            </PopoverAnchor>
            {recentSearches.length > 0 && (
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                  <div className="flex flex-col gap-1 p-1">
                      <div className="flex items-center justify-between px-2 pt-1 pb-2">
                        <span className="text-sm font-medium text-muted-foreground">Recent Searches</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleClearHistory}
                          title="Clear search history"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Clear search history</span>
                        </Button>
                      </div>
                      {recentSearches.map((searchTerm, index) => (
                        <Button
                          key={index}
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRecentSearchClick(searchTerm)}
                          className="text-sm justify-start hover:bg-accent/10"
                        >
                          <History className="mr-2 h-4 w-4" />
                          {searchTerm}
                        </Button>
                      ))}
                    </div>
                </PopoverContent>
            )}
          </Popover>
          <Button 
            type="submit" 
            disabled={isLoading} 
            className={cn(
                "bg-accent text-accent-foreground hover:bg-accent/90", 
                isHeader ? "h-11" : "h-12 w-full text-lg"
            )}
            onContextMenu={handleSearchButtonContextMenu}
            title="Left-click to search. Right-click to toggle verbose AI logs."
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
            <span className={cn(isHeader && "hidden sm:inline")}>{isHeader ? 'Search' : 'Search'}</span>
            {isVerboseLoggingEnabled && <MessageCircleMore className="absolute top-1 right-1 h-3 w-3 text-background/80" />}
          </Button>
        </form>
      </Form>
  );


  if (!hasSearched) {
      return (
          <div className="flex flex-col min-h-screen">
              <header className="flex justify-end items-center p-4 w-full max-w-7xl mx-auto">
                  <AuthStatus />
              </header>
              <main className="flex-grow flex flex-col items-center justify-center p-4 -mt-24">
                  <div className="w-full max-w-2xl flex flex-col items-center gap-6">
                      <h1 onClick={handleTitleClick} className="text-4xl md:text-5xl font-bold text-primary cursor-pointer select-none" title="Try clicking me twice!">
                          Xpoxial Search
                      </h1>

                      <Card className="w-full bg-card/80 border-primary shadow-lg shadow-primary/20 backdrop-blur-sm">
                          <CardHeader>
                              <CardTitle className="text-primary text-lg">Search Query</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <SearchFormComponent isHeader={false} />
                          </CardContent>
                      </Card>

                      {recentSearches.length > 0 && (
                          <Card className="w-full bg-card/80 border-secondary shadow-lg shadow-secondary/10 backdrop-blur-sm">
                            <CardHeader className="flex-row items-center justify-between">
                               <CardTitle className="text-secondary text-lg flex items-center gap-2">
                                  <History className="h-5 w-5" /> Recent Searches
                               </CardTitle>
                               <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={handleClearHistory}
                                  title="Clear search history"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                {recentSearches.map((searchTerm, index) => (
                                    <Button
                                      key={index}
                                      variant="outline"
                                      onClick={() => handleRecentSearchClick(searchTerm)}
                                      className="text-sm justify-start bg-input border-secondary hover:border-accent hover:text-accent-foreground"
                                    >
                                      {searchTerm}
                                    </Button>
                                ))}
                            </CardContent>
                          </Card>
                      )}
                  </div>
              </main>
          </div>
      );
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="container mx-auto flex items-center gap-4 py-3">
          <h1
            onClick={handleTitleClick}
            className="text-2xl font-bold text-primary cursor-pointer select-none hidden sm:block"
            title="Try clicking me twice!"
          >
            Xpoxial Search
          </h1>
          <div className="flex-grow">
            <SearchFormComponent isHeader={true} />
          </div>
          <AuthStatus />
        </div>
      </header>

      <main className="flex-grow overflow-y-auto p-4 selection:bg-accent selection:text-accent-foreground">
        <div className="w-full max-w-7xl mx-auto space-y-8">
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
      </main>
    </div>
  );
}

    