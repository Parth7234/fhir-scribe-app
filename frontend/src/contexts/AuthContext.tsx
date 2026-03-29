import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '../supabase';
import type { User } from '@supabase/supabase-js';
import axios from 'axios';

export type UserRole = 'doctor' | 'patient' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  console.log('[AUTH DEBUG] fetchProfile:', { userId, data, error });

  if (error || !data) return null;

  const profile = {
    uid: data.id,
    email: data.email,
    displayName: data.display_name,
    role: data.role as UserRole,
    createdAt: data.created_at,
  };
  console.log('[AUTH DEBUG] Resolved role:', profile.role);
  return profile;
}

async function createProfileFromPending(user: User): Promise<UserProfile | null> {
  // Try localStorage first (from registration with email confirmation)
  const pendingJson = localStorage.getItem('pending_profile');
  let profileData: any = null;

  if (pendingJson) {
    try {
      profileData = JSON.parse(pendingJson);
    } catch {}
  }

  // Fallback to user_metadata from Supabase Auth
  if (!profileData) {
    const meta = user.user_metadata;
    if (meta?.display_name && meta?.role) {
      profileData = {
        id: user.id,
        email: user.email,
        display_name: meta.display_name,
        role: meta.role,
      };
    }
  }

  if (!profileData) return null;

  const { error } = await supabase.from('profiles').insert({
    id: user.id,
    email: profileData.email || user.email,
    display_name: profileData.display_name,
    role: profileData.role,
  });

  if (error) {
    console.error('Failed to create profile from pending:', error);
    return null;
  }

  localStorage.removeItem('pending_profile');

  return {
    uid: user.id,
    email: profileData.email || user.email || '',
    displayName: profileData.display_name,
    role: profileData.role as UserRole,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Attach Supabase access token to all Axios requests
  useEffect(() => {
    const interceptor = axios.interceptors.request.use(async (config) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token && config.headers) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
      } else {
        console.warn('[AuthContext] No active session — API request will be unauthenticated:', config.url);
      }
      return config;
    });

    return () => {
      axios.interceptors.request.eject(interceptor);
    };
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        let profile = await fetchProfile(currentUser.id);
        // If no profile exists, try creating from pending data or user_metadata
        if (!profile) {
          profile = await createProfileFromPending(currentUser);
        }
        setUserProfile(profile);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          let profile = await fetchProfile(currentUser.id);
          // If no profile exists, try creating from pending data or user_metadata
          if (!profile) {
            profile = await createProfileFromPending(currentUser);
          }
          setUserProfile(profile);
        } else {
          setUserProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const register = async (email: string, password: string, displayName: string, role: UserRole) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName, role } },
    });
    if (error) throw error;
    if (!data.user) throw new Error('Registration failed — no user returned');

    // If Supabase has email confirmation disabled, we get a session immediately
    // and can insert the profile. If email confirmation IS enabled, session is null.
    if (data.session) {
      // User is authenticated — create profile row
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        email,
        display_name: displayName,
        role,
      });
      if (profileError) {
        console.error('Failed to create profile:', profileError);
        throw new Error('Failed to create user profile');
      }

      // Immediately set the profile so the UI can redirect
      setUserProfile({
        uid: data.user.id,
        email,
        displayName,
        role,
      });
    } else {
      // Email confirmation is required — profile will be created on first login
      // Store pending profile data so we can create it after confirmation
      localStorage.setItem('pending_profile', JSON.stringify({
        id: data.user.id,
        email,
        display_name: displayName,
        role,
      }));
      throw new Error('Please check your email to confirm your account before signing in.');
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
