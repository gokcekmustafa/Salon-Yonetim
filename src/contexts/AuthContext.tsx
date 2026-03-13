import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'super_admin' | 'salon_admin' | 'staff';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: AppRole[];
  profile: { full_name: string | null; avatar_url: string | null; phone: string | null } | null;
  currentSalonId: string | null;
  currentBranchId: string | null;
  isSuperAdmin: boolean;
  isSalonAdmin: boolean;
  isStaff: boolean;
  setCurrentSalonId: (id: string | null) => void;
  signOut: () => Promise<void>;
}

const defaultAuthContext: AuthContextType = {
  user: null,
  session: null,
  loading: true,
  roles: [],
  profile: null,
  currentSalonId: null,
  currentBranchId: null,
  isSuperAdmin: false,
  isSalonAdmin: false,
  isStaff: false,
  setCurrentSalonId: () => {},
  signOut: async () => {},
};

const AuthContext = createContext<AuthContextType>(defaultAuthContext);

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [profile, setProfile] = useState<AuthContextType['profile']>(null);
  const [currentSalonId, setCurrentSalonId] = useState<string | null>(null);
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);

  const fetchUserData = useCallback(async (userId: string) => {
    try {
      // Fetch roles and profile in parallel
      const [rolesRes, profileRes] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', userId),
        supabase.from('profiles').select('full_name, avatar_url, phone').eq('user_id', userId).single(),
      ]);

      const userRoles = (rolesRes.data || []).map(r => r.role as AppRole);
      setRoles(userRoles);
      setProfile(profileRes.data);

      // If not super_admin, fetch salon membership
      if (!userRoles.includes('super_admin')) {
        const { data: membership } = await supabase
          .from('salon_members')
          .select('salon_id, branch_id, role')
          .eq('user_id', userId)
          .limit(1)
          .single();

        if (membership) {
          setCurrentSalonId(membership.salon_id);
          setCurrentBranchId(membership.branch_id);
          if (!userRoles.includes(membership.role as AppRole)) {
            setRoles(prev => [...prev, membership.role as AppRole]);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mounted) return;
        
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Fetch user data before setting loading to false
          await fetchUserData(newSession.user.id);
        } else {
          setRoles([]);
          setProfile(null);
          setCurrentSalonId(null);
          setCurrentBranchId(null);
        }
        
        if (mounted) setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      if (!mounted) return;
      
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      
      if (existingSession?.user) {
        await fetchUserData(existingSession.user.id);
      }
      
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRoles([]);
    setProfile(null);
    setCurrentSalonId(null);
  };

  const isSuperAdmin = roles.includes('super_admin');
  const isSalonAdmin = roles.includes('salon_admin');
  const isStaff = roles.includes('staff');

  return (
    <AuthContext.Provider value={{
      user, session, loading, roles, profile,
      currentSalonId, currentBranchId,
      isSuperAdmin, isSalonAdmin, isStaff,
      setCurrentSalonId, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
};