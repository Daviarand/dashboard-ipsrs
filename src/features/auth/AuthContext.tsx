import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { LOGIN_EMAIL_DOMAIN } from '@/lib/constants';
import type { Database } from '@/types/database';
import { INACTIVITY_TIMEOUT_MS } from '@/lib/constants';

export type UserProfile = Database['public']['Tables']['profiles']['Row'];
export type UserRole = Database['public']['Enums']['user_role'];

interface AuthContextType {
  profile: UserProfile | null;
  role: UserRole | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const lastActivityAt = useRef(Date.now());

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      throw error;
    }
    if (!data || !data.is_active) {
      await supabase.auth.signOut();
      setProfile(null);
      return null;
    }

    setProfile(data);
    return data;
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      setProfile(null);
      return;
    }
    await fetchProfile(session.user.id);
  }, [fetchProfile]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) {
        return fetchProfile(session.user.id).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
      return undefined;
    }).catch((err: unknown) => {
      console.error('Initial session check failed:', err);
      setIsLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) {
        queueMicrotask(() => {
          void fetchProfile(session.user.id).catch((err: unknown) => {
            console.error('Session profile refresh failed:', err);
          }).finally(() => setIsLoading(false));
        });
      } else {
        setProfile(null);
        setIsLoading(false);
      }
    });

    const refreshOnFocus = () => {
      if (document.visibilityState === 'visible') {
        void refreshProfile().catch((err: unknown) => console.error('Profile refresh failed:', err));
      }
    };
    const refreshInterval = window.setInterval(() => {
      void refreshProfile().catch((err: unknown) => console.error('Profile refresh failed:', err));
    }, 60_000);
    window.addEventListener('focus', refreshOnFocus);

    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', refreshOnFocus);
      subscription.unsubscribe();
    };
  }, [fetchProfile, refreshProfile]);

  const login = async (username: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    if (!isSupabaseConfigured) {
      return { ok: false, error: 'Konfigurasi Supabase belum lengkap' };
    }

    try {
      const cleanUsername = username.trim().toLowerCase();
      const email = `${cleanUsername}@${LOGIN_EMAIL_DOMAIN}`;

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user) {
        return { ok: false, error: 'Username atau kata sandi tidak valid' };
      }

      const userProfile = await fetchProfile(authData.user.id);

      if (!userProfile) {
        await supabase.auth.signOut();
        return { ok: false, error: 'Akun Anda dinonaktifkan atau belum terdaftar di sistem.' };
      }

      return { ok: true };
    } catch (err: unknown) {
      console.error('Login error:', err);
      return { ok: false, error: 'Terjadi kesalahan saat masuk. Coba lagi.' };
    }
  };

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    if (!profile) return;
    lastActivityAt.current = Date.now();
    const recordActivity = () => {
      lastActivityAt.current = Date.now();
    };
    const activityEvents: Array<keyof WindowEventMap> = [
      'pointerdown',
      'keydown',
      'touchstart',
      'scroll',
    ];
    for (const eventName of activityEvents) {
      window.addEventListener(eventName, recordActivity, { passive: true });
    }
    const timer = window.setInterval(() => {
      if (Date.now() - lastActivityAt.current >= INACTIVITY_TIMEOUT_MS) {
        void logout();
      }
    }, 15_000);
    return () => {
      window.clearInterval(timer);
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, recordActivity);
      }
    };
  }, [profile?.id, logout]);

  const value: AuthContextType = {
    profile,
    role: profile?.role ?? null,
    isLoading,
    isAuthenticated: Boolean(profile && profile.is_active),
    login,
    logout,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
