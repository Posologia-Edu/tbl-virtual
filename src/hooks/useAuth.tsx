import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getPlanByProductId, PlanKey } from '@/lib/stripe-plans';

type AppRole = 'teacher' | 'student' | 'admin';

interface SubscriptionState {
  subscribed: boolean;
  plan: PlanKey | null;
  subscriptionEnd: string | null;
  aiUsedThisMonth: number;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  profile: { full_name: string; is_approved?: boolean; is_blocked?: boolean } | null;
  isAdmin: boolean;
  loading: boolean;
  subscription: SubscriptionState;
  checkSubscription: () => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role: AppRole) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<{ full_name: string; is_approved?: boolean; is_blocked?: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionState>({
    subscribed: false,
    plan: null,
    subscriptionEnd: null,
    aiUsedThisMonth: 0,
  });

  const checkSubscription = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) return;
      if (data) {
        setSubscription({
          subscribed: data.subscribed ?? false,
          plan: data.product_id ? getPlanByProductId(data.product_id) : null,
          subscriptionEnd: data.subscription_end ?? null,
          aiUsedThisMonth: data.ai_used_this_month ?? 0,
        });
      }
    } catch {
      // silently fail
    }
  }, []);

  const fetchUserData = async (userId: string) => {
    const [{ data: roleData }, { data: profileData }] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', userId).single(),
      supabase.from('profiles').select('full_name, is_approved, is_blocked').eq('id', userId).single(),
    ]);
    if (roleData) setRole(roleData.role as AppRole);
    if (profileData) setProfile(profileData as any);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => fetchUserData(session.user.id), 0);
        setTimeout(() => checkSubscription(), 100);
      } else {
        setRole(null);
        setProfile(null);
        setSubscription({ subscribed: false, plan: null, subscriptionEnd: null, aiUsedThisMonth: 0 });
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
        checkSubscription();
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string, role: AppRole) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName, role },
      },
    });
    if (error) throw error;
    if (data.user) {
      setRole(role);
      setProfile({ full_name: fullName });
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
    setProfile(null);
  };

  const isAdmin = role === 'admin';

  return (
    <AuthContext.Provider value={{ user, session, role, profile, isAdmin, loading, subscription, checkSubscription, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
