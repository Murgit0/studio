
"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogIn, LogOut, UserCircle, AlertTriangle, Mail, KeyRound, UserPlus, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AuthStatus() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (!supabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    setLoading(true);
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
        setLoading(false);
        setAuthLoading(false); // Reset auth specific loading
        if (_event === 'SIGNED_IN') {
          toast({ title: "Login Successful", description: `Welcome back, ${newSession?.user?.email || 'user'}!` });
          setEmail(''); // Clear form
          setPassword('');
        } else if (_event === 'SIGNED_OUT') {
          toast({ title: "Logout Successful", description: "You have been logged out." });
        } else if (_event === 'USER_UPDATED') {
          // Could be email confirmation
           toast({ title: "Account Updated", description: `Your account details have been updated.` });
        }
      }
    );

    return () => {
      authListener?.unsubscribe();
    };
  }, [toast]); // supabase and supabaseConfigured are constant after initial load

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

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setAuthLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      toast({ variant: "destructive", title: "Sign Up Error", description: error.message });
    } else {
      toast({ title: "Sign Up Successful", description: "Please check your email to confirm your registration." });
      // Email and password fields are cleared by onAuthStateChange if successful, or kept for correction
    }
    setAuthLoading(false);
  };

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ variant: "destructive", title: "Sign In Error", description: error.message });
    }
    // Success is handled by onAuthStateChange
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    if (!supabase) return;
    setAuthLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ variant: "destructive", title: "Logout Error", description: error.message });
    }
    // Auth listener will update state and setAuthLoading(false)
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
        <Button variant="ghost" size="sm" onClick={handleLogout} disabled={authLoading} className="text-primary hover:text-accent">
          {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="mr-1 h-4 w-4" />} Logout
        </Button>
      </div>
    );
  }

  return (
    <Card className="w-full max-w-sm border-primary shadow-primary/10">
      <CardHeader>
        <CardTitle className="text-xl">Authenticate</CardTitle>
        <CardDescription>Sign in or create an account to continue.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSignIn} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                id="email" 
                type="email" 
                placeholder="you@example.com" 
                value={email}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                required 
                className="pl-10"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                id="password" 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                required 
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button type="submit" disabled={authLoading} className="w-full bg-primary hover:bg-primary/90 flex-1">
              {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />} Sign In
            </Button>
            <Button type="button" variant="outline" onClick={handleSignUp} disabled={authLoading} className="w-full border-accent text-accent hover:bg-accent/10 flex-1">
              {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />} Sign Up
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

