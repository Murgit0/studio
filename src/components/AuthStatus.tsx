
"use client";

import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut, Github, UserCircle, AlertTriangle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AuthStatus() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!supabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    setLoading(true); // Set loading true only if configured and attempting to get session
    const getSession = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false); // Update loading state on auth change
        if (_event === 'SIGNED_IN') {
          toast({ title: "Login Successful", description: `Welcome back, ${newSession?.user?.email || 'user'}!` });
        } else if (_event === 'SIGNED_OUT') {
          toast({ title: "Logout Successful", description: "You have been logged out." });
        }
      }
    );

    return () => {
      authListener?.unsubscribe();
    };
  }, [supabase, toast, supabaseConfigured]); // supabaseConfigured ensures effect re-evaluates if it could change (it's module-level, so once)

  if (!supabaseConfigured) {
    return (
      <Card className="border-destructive bg-destructive/10 text-destructive-foreground mt-4 max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> Supabase Not Configured
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="text-destructive-foreground/90 text-sm">
            Please set your <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in the <code>.env</code> file at the root of your project.
            <br /><br />
            After saving the <code>.env</code> file, you <strong className="text-destructive font-bold">MUST restart</strong> your Next.js development server (usually by stopping it with Ctrl+C and running <code>npm run dev</code> again).
            <br /><br />
            Also ensure these variables are set in your Netlify deployment environment if applicable.
          </CardDescription>
        </CardContent>
      </Card>
    );
  }

  const handleLogin = async () => {
    if (!supabase) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      toast({ variant: "destructive", title: "Login Error", description: error.message });
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!supabase) return;
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ variant: "destructive", title: "Logout Error", description: error.message });
    }
    // Auth listener will update state
    setLoading(false);
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading auth...</div>;
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={user.user_metadata?.avatar_url} alt={user.email || 'User avatar'} />
          <AvatarFallback>
            <UserCircle className="h-5 w-5" />
          </AvatarFallback>
        </Avatar>
        <span className="text-sm text-muted-foreground hidden sm:inline">
          {user.email}
        </span>
        <Button variant="ghost" size="sm" onClick={handleLogout} disabled={loading} className="text-primary hover:text-accent">
          <LogOut className="mr-1 h-4 w-4" /> Logout
        </Button>
      </div>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={handleLogin} disabled={loading} className="border-accent text-accent hover:bg-accent/10">
      <Github className="mr-2 h-4 w-4" /> Login with GitHub
    </Button>
  );
}
