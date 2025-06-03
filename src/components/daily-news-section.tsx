
"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { fetchDailyHeadlines, type HeadlineItem } from '@/app/actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Newspaper, AlertTriangle, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const MAX_HEADLINES_DISPLAY = 5;

export default function DailyNewsSection() {
  const [headlines, setHeadlines] = useState<HeadlineItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadHeadlines() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchDailyHeadlines();
        if (result.error) {
          setError(result.error);
          setHeadlines([]);
        } else {
          setHeadlines(result.headlines.slice(0, MAX_HEADLINES_DISPLAY));
        }
      } catch (e) {
        console.error("Failed to load headlines in component:", e);
        setError(e instanceof Error ? e.message : "An unexpected error occurred.");
        setHeadlines([]);
      } finally {
        setIsLoading(false);
      }
    }
    loadHeadlines();
  }, []);

  if (isLoading) {
    return (
      <Card className="border-primary shadow-lg shadow-primary/20 mt-8">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-accent" /> Today's Headlines
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <Skeleton className="h-16 w-24 rounded-md" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-[250px]" />
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-3 w-[150px]" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive shadow-lg shadow-destructive/20 mt-8">
        <CardHeader>
          <CardTitle className="text-destructive text-xl flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" /> News Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">Could not load headlines: {error}</p>
          <p className="text-xs text-muted-foreground mt-1">Please ensure the NEWS_API_KEY is correctly configured.</p>
        </CardContent>
      </Card>
    );
  }

  if (headlines.length === 0) {
    return (
      <Card className="border-primary shadow-lg shadow-primary/20 mt-8">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-accent" /> Today's Headlines
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No news headlines available at the moment.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary shadow-lg shadow-primary/20 mt-8">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-accent" /> Today's Headlines
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-3"> {/* Adjust height as needed */}
          <div className="space-y-6">
            {headlines.map((headline, index) => (
              <a
                key={index}
                href={headline.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 rounded-lg border bg-card/30 hover:bg-card/70 hover:border-accent transition-all group"
              >
                <article className="flex flex-col sm:flex-row gap-4">
                  {headline.urlToImage && (
                    <div className="relative w-full sm:w-32 h-32 sm:h-20 shrink-0 rounded-md overflow-hidden border border-border">
                      <Image
                        src={headline.urlToImage}
                        alt={headline.title || 'Headline image'}
                        fill
                        style={{ objectFit: 'cover' }}
                        sizes="(max-width: 640px) 100vw, 128px"
                        data-ai-hint="news article"
                      />
                    </div>
                  )}
                  <div className="flex-grow">
                    <h3 className="text-md font-semibold leading-tight text-primary group-hover:text-accent group-hover:underline mb-1 flex items-start gap-1">
                      {headline.title}
                      <ExternalLink className="h-3 w-3 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity mt-1" />
                    </h3>
                    {headline.description && (
                      <p className="text-xs text-muted-foreground mb-1 line-clamp-2">
                        {headline.description}
                      </p>
                    )}
                    <div className="text-xs text-muted-foreground/80 flex items-center gap-2">
                      <span>{headline.sourceName || 'Unknown Source'}</span>
                      {headline.publishedAt && (
                        <>
                          <span>&bull;</span>
                          <time dateTime={headline.publishedAt}>
                            {formatDistanceToNow(new Date(headline.publishedAt), { addSuffix: true })}
                          </time>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              </a>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
