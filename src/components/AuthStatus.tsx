
"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogIn, LogOut, UserCircle, AlertTriangle, Mail, KeyRound, UserPlus, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const GENERIC_ERROR_MESSAGE = "Contact developer and lodge an issue";

export default function AuthStatus() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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
          setIsDialogOpen(false); // Close dialog on successful sign in
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
      authListener?.subscription.unsubscribe();
    };
  }, [toast]); // supabase and supabaseConfigured are constant after initial load

  if (!supabaseConfigured) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative">
              <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" disabled>
                  <UserCircle className="mr-2 h-4 w-4" />
                  Login
              </Button>
              <AlertCircle className="absolute -top-1 -right-1 h-4 w-4 text-destructive bg-background rounded-full" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="end" className="max-w-xs bg-destructive text-destructive-foreground border-destructive-foreground/20">
             <div className="flex items-center gap-2 font-bold mb-2">
                <AlertTriangle className="h-5 w-5" /> Supabase Not Configured
             </div>
             <p className="text-xs">
                Please set your <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in the <code>.env</code> file.
                <br /><br />
                You <strong className="font-bold">MUST restart</strong> your Next.js dev server after saving the file.
             </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setAuthLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      console.error("Sign Up Error:", error);
      toast({ variant: "destructive", title: "Sign Up Error", description: GENERIC_ERROR_MESSAGE });
    } else {
      toast({ title: "Sign Up Successful", description: "Please check your email to confirm your registration." });
      setIsDialogOpen(false);
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
      console.error("Sign In Error:", error);
      toast({ variant: "destructive", title: "Sign In Error", description: GENERIC_ERROR_MESSAGE });
    }
    // Success is handled by onAuthStateChange
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    if (!supabase) return;
    setAuthLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Logout Error:", error);
      toast({ variant: "destructive", title: "Logout Error", description: GENERIC_ERROR_MESSAGE });
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
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-accent text-accent hover:bg-accent/10">
          <UserCircle className="mr-2 h-4 w-4" />
          Login
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-background border-primary">
          <DialogHeader>
              <DialogTitle className="text-xl">Authenticate</DialogTitle>
              <DialogDescription>Sign in or create an account to continue.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
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
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                      <Button type="submit" disabled={authLoading} className="w-full bg-primary hover:bg-primary/90 flex-1">
                          {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />} Sign In
                      </Button>
                      <Button type="button" variant="outline" onClick={handleSignUp} disabled={authLoading} className="w-full border-accent text-accent hover:bg-accent/10 flex-1">
                          {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />} Sign Up
                      </Button>
                  </div>
              </form>
          </div>
      </DialogContent>
    </Dialog>
  );
}
