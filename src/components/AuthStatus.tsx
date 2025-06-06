
"use client";

import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut, Github, UserCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function AuthStatus() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        if (_event === 'SIGNED_IN') {
          toast({ title: "Login Successful", description: `Welcome back, ${session?.user?.email || 'user'}!` });
        } else if (_event === 'SIGNED_OUT') {
          toast({ title: "Logout Successful", description: "You have been logged out." });
        }
      }
    );

    return () => {
      authListener?.unsubscribe();
    };
  }, [toast]);

  const handleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: window.location.origin, // Or a specific callback page
      },
    });
    if (error) {
      toast({ variant: "destructive", title: "Login Error", description: error.message });
      setLoading(false);
    }
    // Supabase handles the redirect
  };

  const handleLogout = async () => {
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
