
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
import { processSearchQuery, performAdvancedSearch, getNewsFeed, getStockImages, summarizeAdvancedResultsAction, type SearchActionResult, type ImageResultItem as ActionImageResultItem, type LocationData, type NewsArticleItem } from "@/app/actions";
import { Search, Loader2, AlertTriangle, Brain, ListTree, ExternalLink, ImageIcon, MessageCircleMore, History, Trash2, X, Newspaper, Image as ImageIconLucide, ArrowLeft, MessageSquare, Rocket, Video, HelpCircle, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AuthStatus from '@/components/AuthStatus';
import Chatbot from '@/components/Chatbot';
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow } from 'date-fns';
import type { PerformAdvancedSearchOutput } from "@/ai/tools/perform-advanced-search";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";

const formSchema = z.object({
  query: z.string().min(3, { message: "Query must be at least 3 characters." }),
});

type FormData = z.infer<typeof formSchema>;
type ViewType = 'search' | 'news' | 'images' | 'chatbot' | 'advanced-search';

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
  const [currentView, setCurrentView] = useState<ViewType>('search');
  const [searchResult, setSearchResult] = useState<SearchActionResult | null>(null);
  const [news, setNews] = useState<NewsArticleItem[]>([]);
  const [stockImages, setStockImages] = useState<ActionImageResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = useState(false);

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
          // Check if the error is due to network location provider failure, which might be a temporary issue or a CSP block.
          if (error.code === error.POSITION_UNAVAILABLE) {
            console.warn("Geolocation service failed, possibly due to network location provider. Using default.");
          }
          setLocationData(DEFAULT_LOCATION_INDIA);
          setTimeout(() => {
             toast({
                variant: "default",
                title: "Location Information",
                description: `Could not determine your precise location. Using a default location (India) for context. Reason: ${error.message}`,
                duration: 7000,
             });
          }, 0);
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 0 } // Standard options
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
    setTitleClickCount(prev => {
      const newClickCount = prev + 1;
      if (newClickCount >= 2) {
        setRainbowModeActive(prevMode => !prevMode);
        return 0;
      }
      return newClickCount;
    });
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
  
  const addQueryToRecent = (query: string) => {
    const updatedRecentSearches = [query, ...recentSearches.filter(rs => rs !== query)].slice(0, MAX_RECENT_SEARCHES);
    setRecentSearches(updatedRecentSearches);
    try {
      localStorage.setItem(LOCAL_STORAGE_RECENT_SEARCHES_KEY, JSON.stringify(updatedRecentSearches));
    } catch (error) {
      console.error("Failed to save recent searches to localStorage:", error);
    }
  }

  async function onSearchSubmit(values: FormData) {
    setIsLoading(true);
    setSearchResult(null);
    setCurrentView('search');
    setIsPopoverOpen(false);
    
    addQueryToRecent(values.query);

    try {
      const response = await processSearchQuery({ 
        query: values.query,
        verbose: isVerboseLoggingEnabled,
        location: locationData, 
        deviceInfo: deviceInfo || undefined,
        recentSearches: recentSearches,
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

  async function onAdvancedSearchSubmit(values: FormData) {
    setIsLoading(true);
    setSearchResult(null);
    setAiSummary(null);
    setCurrentView('advanced-search');
    setIsPopoverOpen(false);

    addQueryToRecent(values.query);

    try {
      const response = await performAdvancedSearch({
        query: values.query,
        verbose: isVerboseLoggingEnabled,
      });
      setSearchResult(response);

      if (response.error) {
        toast({
          variant: "destructive",
          title: "Advanced Search Error",
          description: response.error,
        });
      } else {
        toast({
          title: "Advanced Search Complete",
          description: "Your advanced query has been processed.",
        });
      }
    } catch (error) {
      console.error("Advanced search submission error:", error);
      setSearchResult({ error: GENERIC_ERROR_MESSAGE });
      toast({
        variant: "destructive",
        title: "Advanced Search Error",
        description: GENERIC_ERROR_MESSAGE,
      });
    } finally {
      setIsLoading(false);
    }
  }


  const handleFetchNews = async () => {
    setIsLoading(true);
    setCurrentView('news');
    setNews([]);
    try {
      const response = await getNewsFeed({ verbose: isVerboseLoggingEnabled });
      setNews(response.articles);
      toast({ title: "News Feed Loaded" });
    } catch (error) {
      toast({ variant: "destructive", title: "Failed to load news", description: GENERIC_ERROR_MESSAGE });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchImages = async () => {
    setIsLoading(true);
    setCurrentView('images');
    setStockImages([]);
    try {
      const response = await getStockImages({ verbose: isVerboseLoggingEnabled });
      setStockImages(response.images || []);
      toast({ title: "Stock Images Loaded" });
    } catch (error) {
      toast({ variant: "destructive", title: "Failed to load images", description: GENERIC_ERROR_MESSAGE });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleChatbotView = () => {
    setCurrentView('chatbot');
    setIsLoading(false); // No initial loading for chatbot view
  };


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
    form.handleSubmit(onSearchSubmit)();
  };
  
  const handleQueryInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    form.setValue("query", event.target.value);
    const value = event.target.value;
    if (value.length > 0 && recentSearches.length > 0) {
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

  const handleBackToSearch = () => {
    setCurrentView('search');
    setSearchResult(null); // Clear previous results
  };


  const fetchedImages: ActionImageResultItem[] = searchResult?.searchResults?.images || [];
  const hasSearched = isLoading || searchResult !== null;

  const SearchFormComponent = ({ isHeader }: { isHeader: boolean }) => (
      <Form {...form}>
        <form 
            onSubmit={form.handleSubmit(onSearchSubmit)} 
            className={cn(
                "w-full flex items-stretch gap-2", 
                isHeader ? "max-w-xl mx-auto flex-row" : "max-w-2xl flex-col"
            )}
        >
          <div className="relative flex-grow w-full">
            <Popover open={isPopoverOpen && !isHeader && recentSearches.length > 0} onOpenChange={setIsPopoverOpen}>
              <PopoverTrigger asChild>
                <div />
              </PopoverTrigger>
              <FormField
                  control={form.control}
                  name="query"
                  render={({ field }) => (
                  <FormItem className="w-full">
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
                              onFocus={() => setIsPopoverOpen(true && !isHeader && recentSearches.length > 0)}
                              autoComplete="off"
                          />
                          {field.value && (
                          <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground"
                              onClick={() => {form.setValue('query', ''); form.setFocus('query'); setIsPopoverOpen(true && !isHeader && recentSearches.length > 0);}}
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
              {recentSearches.length > 0 && (
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" asChild>
                    <div className="w-full">
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
                    </div>
                  </PopoverContent>
              )}
            </Popover>
          </div>
          <div className={cn("flex gap-2", isHeader ? "flex-row" : "flex-col sm:flex-row mt-4")}>
            <Button 
              type="submit" 
              disabled={isLoading} 
              className={cn(
                  "bg-accent text-accent-foreground hover:bg-accent/90", 
                  isHeader ? "h-11" : "h-12 text-lg",
                  "flex-1"
              )}
              onContextMenu={handleSearchButtonContextMenu}
              title="Left-click to search. Right-click to toggle verbose AI logs."
            >
              {isLoading && currentView === 'search' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
              <span className={cn(isHeader && "hidden sm:inline")}>Search</span>
              {isVerboseLoggingEnabled && <MessageCircleMore className="absolute top-1 right-1 h-3 w-3 text-background/80" />}
            </Button>
            <Button
              type="button"
              onClick={form.handleSubmit(onAdvancedSearchSubmit)}
              disabled={isLoading}
              className={cn(
                  "bg-primary text-primary-foreground hover:bg-primary/90",
                  isHeader ? "h-11" : "h-12 text-lg",
                  "flex-1"
              )}
              title="Perform an advanced multi-engine search"
            >
              {isLoading && currentView === 'advanced-search' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Rocket className="h-5 w-5" />}
              <span>Advanced</span>
            </Button>
          </div>
        </form>
      </Form>
  );


  if (!hasSearched && (currentView === 'search' || currentView === 'advanced-search')) {
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
                      
                       <Card className="w-full bg-card/80 border-secondary shadow-lg shadow-secondary/10 backdrop-blur-sm">
                          <CardContent className="pt-6 flex flex-col sm:flex-row gap-4">
                              <Button onClick={handleFetchNews} disabled={isLoading} className="flex-1 h-12 text-lg" variant="outline">
                                  {isLoading && currentView === 'news' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Newspaper className="mr-2 h-5 w-5" />}
                                  News Feed
                              </Button>
                              <Button onClick={handleFetchImages} disabled={isLoading} className="flex-1 h-12 text-lg" variant="outline">
                                  {isLoading && currentView === 'images' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ImageIconLucide className="mr-2 h-5 w-5" />}
                                  Stock Images
                              </Button>
                          </CardContent>
                           <CardContent className="pt-0 flex justify-center">
                              <Button onClick={handleChatbotView} disabled={isLoading} className="w-full sm:w-auto h-12 text-lg px-8" variant="outline">
                                  {isLoading && currentView === 'chatbot' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <MessageSquare className="mr-2 h-5 w-5" />}
                                  Chatbot
                              </Button>
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

  const renderAdvancedSearchResults = () => {
    if (!searchResult?.advancedSearchResults) return null;

    const data: PerformAdvancedSearchOutput = searchResult.advancedSearchResults;
    const engines = Object.keys(data) as (keyof typeof data)[];

    const allWebResults = engines.flatMap(engine => 
      data[engine]?.webResults?.map(res => ({ ...res, engine })) || []
    ).filter(res => res.title && res.link);

    const allImageResults = engines.flatMap(engine => 
        data[engine]?.imageResults?.map(res => ({ ...res, engine })) || []
    ).filter(res => res.thumbnail && res.original);

    const allVideoResults = engines.flatMap(engine => 
        data[engine]?.videoResults?.map(res => ({ ...res, engine })) || []
    ).filter(res => res.thumbnail && res.link);

    const allRelatedQuestions = engines.flatMap(engine => 
        data[engine]?.relatedQuestions?.map(res => ({ ...res, engine })) || []
    ).filter(res => res.question);
    
    const tabs = [
        { name: 'Web', icon: Search, data: allWebResults },
        { name: 'Images', icon: ImageIcon, data: allImageResults },
        { name: 'Videos', icon: Video, data: allVideoResults },
        { name: 'Related Questions', icon: HelpCircle, data: allRelatedQuestions },
    ];
    
    const handleSummarize = async () => {
      setIsSummaryDialogOpen(true);
      setIsSummarizing(true);
      setAiSummary(null);
      try {
        const response = await summarizeAdvancedResultsAction({
          query: form.getValues('query'),
          webResults: allWebResults,
          imageResults: allImageResults,
          videoResults: allVideoResults,
          relatedQuestions: allRelatedQuestions,
          verbose: isVerboseLoggingEnabled,
        });

        if (response.summary) {
          setAiSummary(response.summary);
        } else {
          throw new Error("Failed to get summary from AI.");
        }
      } catch (error) {
        console.error("Error summarizing results:", error);
        setAiSummary(`Sorry, an error occurred while generating the summary. Please try again. \n\n${GENERIC_ERROR_MESSAGE}`);
        toast({
          variant: "destructive",
          title: "Summarization Failed",
          description: GENERIC_ERROR_MESSAGE,
        });
      } finally {
        setIsSummarizing(false);
      }
    };
    
    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>Advanced Search Results</CardTitle>
                    <CardDescription>Aggregated results from multiple search engines.</CardDescription>
                </div>
                <Dialog open={isSummaryDialogOpen} onOpenChange={setIsSummaryDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={handleSummarize} disabled={isSummarizing}>
                            {isSummarizing && isSummaryDialogOpen ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                            Summarize with AI
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
                        <DialogHeader>
                            <DialogTitle className="text-2xl">AI Summary</DialogTitle>
                            <DialogDescription>
                                A comprehensive summary of the search results for "{form.getValues('query')}".
                            </DialogDescription>
                        </DialogHeader>
                        <ScrollArea className="flex-grow">
                            <div className="prose prose-invert prose-p:text-base prose-li:text-base prose-h2:text-xl prose-h3:text-lg whitespace-pre-wrap p-1">
                                {isSummarizing ? (
                                    <div className="flex items-center justify-center h-full pt-10">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        <p className="ml-4 text-muted-foreground">The AI is analyzing the results...</p>
                                    </div>
                                ) : aiSummary ? (
                                    <p>{aiSummary}</p>
                                ) : (
                                    <div className="text-center pt-10 text-muted-foreground">
                                        <p>The summary will appear here once generated.</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="Web" className="w-full">
                    <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
                        {tabs.map(tab => (
                            <TabsTrigger key={tab.name} value={tab.name} disabled={tab.data.length === 0}>
                                <tab.icon className="mr-2 h-4 w-4" />
                                {tab.name} ({tab.data.length})
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    <TabsContent value="Web">
                        <div className="space-y-6 pt-4">
                            {allWebResults.map((item, index) => (
                                <div key={`web-${index}-${item.engine}`}>
                                    <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-lg text-primary hover:underline">{item.title}</a>
                                    <p className="text-sm text-muted-foreground mt-1">{item.snippet}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-green-400/70 break-all">{item.link}</span>
                                        <span className="text-xs text-white bg-secondary px-1.5 py-0.5 rounded">{item.engine}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="Images">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 pt-4">
                            {allImageResults.map((item, index) => (
                                <a key={`img-${index}-${item.engine}`} href={item.link || item.original} target="_blank" rel="noopener noreferrer" className="group block relative">
                                    <div className="relative w-full">
                                        <Image src={item.thumbnail!} alt={item.title!} layout="responsive" width={200} height={200} className="rounded-md object-cover group-hover:opacity-80 transition-opacity border-2 border-transparent group-hover:border-accent"/>
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate mt-1 group-hover:text-accent">{item.title}</p>
                                    <span className="absolute top-1 left-1 text-xs text-white bg-black/60 px-1.5 py-0.5 rounded">{item.engine}</span>
                                </a>
                            ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="Videos">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
                            {allVideoResults.map((item, index) => (
                                <a key={`video-${index}-${item.engine}`} href={item.link} target="_blank" rel="noopener noreferrer" className="group block relative">
                                    <div className="relative">
                                        <Image src={item.thumbnail!} alt={item.title!} width={300} height={170} className="rounded-md object-cover aspect-video group-hover:opacity-80 transition-opacity border-2 border-transparent group-hover:border-accent"/>
                                        {item.duration && <span className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded-sm">{item.duration}</span>}
                                        <span className="absolute top-1 left-1 text-xs text-white bg-black/60 px-1.5 py-0.5 rounded">{item.engine}</span>
                                    </div>
                                    <p className="text-sm font-medium text-muted-foreground truncate mt-2 group-hover:text-accent">{item.title}</p>
                                </a>
                            ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="Related Questions">
                        <div className="space-y-4 pt-4">
                            {allRelatedQuestions.map((item, index) => (
                                <div key={`related-${index}-${item.engine}`} className="p-4 border rounded-lg bg-card/50">
                                    <p className="font-semibold text-lg flex justify-between">
                                        {item.question}
                                        <span className="text-xs text-white bg-secondary px-1.5 py-0.5 rounded">{item.engine}</span>
                                    </p>
                                    {item.snippet && <p className="text-base text-muted-foreground mt-2">{item.snippet}</p>}
                                    {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-sm text-primary/80 hover:underline mt-2 block">{item.title}</a>}
                                </div>
                            ))}
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
  };

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
          {(currentView !== 'search' && currentView !== 'advanced-search') && (
            <Button variant="outline" onClick={handleBackToSearch}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Search
            </Button>
          )}
          <div className="flex-grow">
            {(currentView === 'search' || currentView === 'advanced-search') && <SearchFormComponent isHeader={true} />}
          </div>
          <AuthStatus />
        </div>
      </header>

      <main className="flex-grow overflow-y-auto p-4 selection:bg-accent selection:text-accent-foreground">
        <div className="w-full max-w-7xl mx-auto space-y-8 h-full">
          {isLoading && (
            <div className="flex justify-center items-center p-10">
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
              <p className="ml-4 text-xl text-muted-foreground">
                {currentView === 'news' ? 'Fetching news feed...' : currentView === 'images' ? 'Loading stock images...' : 'Searching the digital cosmos...'}
              </p>
            </div>
          )}

          {currentView === 'advanced-search' && searchResult && !isLoading && (
            renderAdvancedSearchResults()
          )}

          {(currentView === 'search' || currentView === 'advanced-search') && searchResult && searchResult.error && !isLoading && (
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

          {currentView === 'search' && searchResult && !searchResult.error && !isLoading && (
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
                <Tabs defaultValue="search" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="search" disabled={!searchResult.answer?.answer && (!searchResult.searchResults?.webResults || searchResult.searchResults.webResults.length === 0)}>
                      <ListTree className="mr-2 h-4 w-4"/>
                      Search
                    </TabsTrigger>
                    <TabsTrigger value="images" disabled={fetchedImages.length === 0}>
                      <ImageIcon className="mr-2 h-4 w-4"/>
                      Images ({fetchedImages.length})
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="search" className="mt-4">
                    <div className="space-y-8">
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
                  </TabsContent>
                  <TabsContent value="images" className="mt-4">
                     {fetchedImages.length > 0 && (
                      <div className="md:col-span-1 space-y-8">
                        <Card className="border-secondary shadow-lg shadow-secondary/20">
                          <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-2">
                              <ImageIcon className="h-5 w-5 text-accent"/> Images
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
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
                                      <div className="relative w-full">
                                        <Image
                                          src={img.imageUrl}
                                          alt={img.altText || `Image ${index + 1} for ${form.getValues("query")}`}
                                          layout="responsive"
                                          width={500}
                                          height={500}
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
                  </TabsContent>
                </Tabs>
              )}
            </>
          )}

          {currentView === 'news' && !isLoading && (
              <Card className="border-primary shadow-lg shadow-primary/20">
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2"><Newspaper className="h-6 w-6 text-accent"/> News Feed</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {news.map((article, index) => (
                    <Card key={index} className="bg-card/50 border-border/50 hover:border-accent transition-colors duration-150">
                        <CardContent className="pt-6">
                        <div className="flex-grow">
                            <CardDescription className="text-xs text-muted-foreground mb-2">
                                {article.source} &bull; {formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })}
                            </CardDescription>
                            <CardTitle className="text-lg mb-1">
                            <a
                                href={article.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:text-accent hover:underline flex items-center gap-1 group"
                            >
                                {article.title}
                                <ExternalLink className="h-4 w-4 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
                            </a>
                            </CardTitle>
                            {article.description && <p className="text-sm leading-relaxed mt-2">{article.description}</p>}
                        </div>
                        </CardContent>
                    </Card>
                    ))}
                </CardContent>
              </Card>
          )}

          {currentView === 'images' && !isLoading && (
              <Card className="border-secondary shadow-lg shadow-secondary/20">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <ImageIcon className="h-5 w-5 text-accent"/> Stock Images
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {stockImages.map((img, index) => (
                        <div key={index} className="group">
                          <a href={img.sourceUrl || '#'} target="_blank" rel="noopener noreferrer" className="block">
                            <div className="relative w-full aspect-square mb-1">
                              <Image
                                src={img.imageUrl}
                                alt={img.altText || `Stock image ${index + 1}`}
                                fill
                                style={{ objectFit: 'cover' }}
                                className="rounded-md border border-border shadow-md group-hover:opacity-80 transition-opacity"
                                data-ai-hint={img.altText?.split(' ').slice(0, 2).join(' ') || 'photo'}
                                priority={index < 10}
                                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                              />
                            </div>
                          </a>
                        </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
          )}

          {currentView === 'chatbot' && !isLoading && (
            <div className="h-full">
              <Chatbot isVerboseLoggingEnabled={isVerboseLoggingEnabled} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
