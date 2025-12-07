
"use client";

import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { sendChatMessage, type ChatMessage } from '@/app/actions';
import { Send, Loader2, Bot, User, CornerDownLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

const formSchema = z.object({
  message: z.string().min(1, { message: "Message cannot be empty." }),
});

type FormData = z.infer<typeof formSchema>;

interface ChatbotProps {
  isVerboseLoggingEnabled: boolean;
}

const GENERIC_ERROR_MESSAGE = "Contact developer and lodge an issue";

export default function Chatbot({ isVerboseLoggingEnabled }: ChatbotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      message: "",
    },
  });

  useEffect(() => {
    // Scroll to the bottom whenever messages change
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);

  async function onSubmit(values: FormData) {
    setIsSending(true);
    const userMessage: ChatMessage = { role: 'user', content: values.message };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    form.reset();

    try {
      const response = await sendChatMessage({
        history: messages,
        message: values.message,
        verbose: isVerboseLoggingEnabled,
      });

      const botMessage: ChatMessage = { role: 'model', content: response.response };
      setMessages([...newMessages, botMessage]);

    } catch (error) {
      console.error("Chat submission error:", error);
      toast({
        variant: "destructive",
        title: "Chat Error",
        description: GENERIC_ERROR_MESSAGE,
      });
      // Optionally remove the user's message or add an error message to the chat
      const errorMessage: ChatMessage = { role: 'model', content: "Sorry, I encountered an error. Please try again." };
      setMessages([...newMessages, errorMessage]);
    } finally {
      setIsSending(false);
    }
  }

  const handleTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.handleSubmit(onSubmit)();
    }
  };

  return (
    <Card className="w-full h-full flex flex-col border-primary shadow-lg shadow-primary/20 bg-background/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center gap-2">
          <Bot className="h-6 w-6 text-accent" /> Chat with AI
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col gap-4 overflow-hidden">
        <ScrollArea className="flex-grow pr-4 -mr-4" ref={scrollAreaRef}>
          <div className="space-y-6">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground pt-10">
                <p>No messages yet. Say hello!</p>
              </div>
            )}
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-start gap-3",
                  message.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                {message.role === 'model' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center">
                    <Bot className="h-5 w-5" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[75%] rounded-lg px-4 py-3",
                    message.role === 'user'
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
                 {message.role === 'user' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
                    <User className="h-5 w-5" />
                  </div>
                )}
              </div>
            ))}
             {isSending && (
                <div className="flex items-start gap-3 justify-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                    <div className="max-w-[75%] rounded-lg px-4 py-3 bg-card border">
                        <p className="text-sm text-muted-foreground">Thinking...</p>
                    </div>
                </div>
             )}
          </div>
        </ScrollArea>
        <div className="mt-auto pt-4 border-t border-border/50">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-start gap-2">
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem className="flex-grow">
                    <FormControl>
                      <Textarea
                        placeholder="Type your message..."
                        {...field}
                        rows={1}
                        className="min-h-[48px] resize-none"
                        onKeyDown={handleTextareaKeyDown}
                        disabled={isSending}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isSending} size="lg" className="h-[48px]">
                {isSending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
                <span className="sr-only">Send</span>
              </Button>
            </form>
             <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <CornerDownLeft className="h-3 w-3" /> <span> for new line, </span> 
                <span className="font-bold">Enter</span> <span> to send</span>
            </p>
          </Form>
        </div>
      </CardContent>
    </Card>
  );
}
