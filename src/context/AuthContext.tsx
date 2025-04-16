import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  setupEmailMFA: () => Promise<void>;
  verifyEmailMFA: (token: string) => Promise<boolean>;
  isEmailMFAEnabled: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEmailMFAEnabled, setIsEmailMFAEnabled] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkMFAStatus(session.user);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkMFAStatus(session.user);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkMFAStatus = async (user: User) => {
    try {
      // First check if a record exists
      const { data: existingData, error: checkError } = await supabase
        .from('user_mfa')
        .select('enabled')
        .eq('user_id', user.id)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking MFA status:', checkError);
        setIsEmailMFAEnabled(false);
        return;
      }

      // If no record exists, create one with default values
      if (!existingData) {
        const { error: insertError } = await supabase
          .from('user_mfa')
          .insert({
            user_id: user.id,
            enabled: false
          });

        if (insertError) {
          console.error('Error creating MFA record:', insertError);
          setIsEmailMFAEnabled(false);
          return;
        }

        setIsEmailMFAEnabled(false);
      } else {
        setIsEmailMFAEnabled(existingData.enabled ?? false);
      }
    } catch (error) {
      console.error('Error checking MFA status:', error);
      setIsEmailMFAEnabled(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      toast.success('Successfully logged in!');
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Error logging in');
      throw error;
    }
  };

  const signup = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;
      toast.success('Successfully signed up! You can now log in.');
    } catch (error) {
      console.error('Signup error:', error);
      toast.error('Error signing up');
      throw error;
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success('Successfully logged out!');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Error logging out');
      throw error;
    }
  };

  const setupEmailMFA = async () => {
    try {
      if (!user) throw new Error('No user logged in');

      // Generate a verification code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // Store the code and timestamp in the database
      const { error: storeError } = await supabase
        .from('mfa_codes')
        .insert({
          user_id: user.id,
          code,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes expiry
        });

      if (storeError) throw storeError;

      // Send verification email using edge function
      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/send-notification`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabase.supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'security',
          userId: user.id,
          subject: 'Your 2FA Verification Code',
          content: `Your verification code is: ${code}\nThis code will expire in 10 minutes.`
        })
      });

      if (!response.ok) throw new Error('Failed to send verification email');

      return true;
    } catch (error) {
      console.error('Error setting up email MFA:', error);
      throw error;
    }
  };

  const verifyEmailMFA = async (code: string): Promise<boolean> => {
    try {
      if (!user) throw new Error('No user logged in');

      // Verify the code
      const { data, error } = await supabase
        .from('mfa_codes')
        .select('*')
        .eq('user_id', user.id)
        .eq('code', code)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        throw new Error('Invalid or expired code');
      }

      // Enable MFA for the user
      const { error: enableError } = await supabase
        .from('user_mfa')
        .upsert({
          user_id: user.id,
          enabled: true,
          updated_at: new Date().toISOString()
        });

      if (enableError) throw enableError;

      // Delete the used code
      await supabase
        .from('mfa_codes')
        .delete()
        .eq('user_id', user.id);

      setIsEmailMFAEnabled(true);
      return true;
    } catch (error) {
      console.error('Error verifying email MFA:', error);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      signup, 
      logout, 
      loading,
      setupEmailMFA,
      verifyEmailMFA,
      isEmailMFAEnabled
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}