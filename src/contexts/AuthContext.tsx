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
        supabase.from('profiles').select('full_name, avatar_url, phone').eq('user_id', userId).maybeSingle(),
      ]);

      const roleSet = new Set<AppRole>((rolesRes.data || []).map(r => r.role as AppRole));
      setProfile(profileRes.data ?? null);

      // Fetch all salon memberships for non-super-admin users
      if (!roleSet.has('super_admin')) {
        const { data: memberships } = await supabase
          .from('salon_members')
          .select('salon_id, branch_id, role')
          .eq('user_id', userId)
          .order('created_at', { ascending: true });

        const firstMembership = memberships?.[0];

        if (firstMembership) {
          setCurrentSalonId(firstMembership.salon_id);
          setCurrentBranchId(firstMembership.branch_id);
        } else {
          setCurrentSalonId(null);
          setCurrentBranchId(null);
        }

        (memberships || []).forEach(m => roleSet.add(m.role as AppRole));
      } else {
        setCurrentSalonId(null);
        setCurrentBranchId(null);
      }

      setRoles(Array.from(roleSet));
    } catch (err) {
      console.error('Error fetching user data:', err);
      setRoles([]);
      setProfile(null);
      setCurrentSalonId(null);
      setCurrentBranchId(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let initialSessionHandled = false;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!mounted) return;
        
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Use setTimeout to avoid Supabase auth deadlock
          setTimeout(() => {
            if (!mounted) return;
            fetchUserData(newSession.user.id).finally(() => {
              if (mounted) setLoading(false);
            });
          }, 0);
        } else {
          setRoles([]);
          setProfile(null);
          setCurrentSalonId(null);
          setCurrentBranchId(null);
          if (mounted) setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      if (!mounted || initialSessionHandled) return;
      initialSessionHandled = true;
      
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      
      if (existingSession?.user) {
        fetchUserData(existingSession.user.id).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        if (mounted) setLoading(false);
      }
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