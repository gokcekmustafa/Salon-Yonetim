import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
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
  isManagingSalon: boolean;
  setCurrentSalonId: (id: string | null) => void;
  startManagingSalon: (id: string) => void;
  stopManagingSalon: () => void;
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
  isManagingSalon: false,
  setCurrentSalonId: () => {},
  startManagingSalon: () => {},
  stopManagingSalon: () => {},
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
  const [isManagingSalon, setIsManagingSalon] = useState(false);
  const fetchIdRef = useRef(0); // Track latest fetch to ignore stale results

  const fetchUserData = useCallback(async (userId: string, fetchId: number) => {
    try {
      const [rolesRes, profileRes] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', userId),
        supabase.from('profiles').select('full_name, avatar_url, phone').eq('user_id', userId).maybeSingle(),
      ]);

      // If a newer fetch started, discard this result
      if (fetchId !== fetchIdRef.current) return;

      const roleSet = new Set<AppRole>((rolesRes.data || []).map(r => r.role as AppRole));
      setProfile(profileRes.data ?? null);

      if (!roleSet.has('super_admin')) {
        const { data: memberships } = await supabase
          .from('salon_members')
          .select('salon_id, branch_id, role')
          .eq('user_id', userId)
          .order('created_at', { ascending: true });

        if (fetchId !== fetchIdRef.current) return;

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

      if (fetchId !== fetchIdRef.current) return;
      setRoles(Array.from(roleSet));
    } catch (err) {
      console.error('Error fetching user data:', err);
      if (fetchId !== fetchIdRef.current) return;
      setRoles([]);
      setProfile(null);
      setCurrentSalonId(null);
      setCurrentBranchId(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Single source of truth: onAuthStateChange handles both initial session and changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!mounted) return;

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Increment fetch ID so any in-flight fetch is discarded
          const id = ++fetchIdRef.current;
          // Keep loading true until roles are fetched
          setLoading(true);
          // Use setTimeout to avoid Supabase auth deadlock
          setTimeout(() => {
            if (!mounted) return;
            fetchUserData(newSession.user.id, id).finally(() => {
              if (mounted && id === fetchIdRef.current) {
                setLoading(false);
              }
            });
          }, 0);
        } else {
          fetchIdRef.current++;
          setRoles([]);
          setProfile(null);
          setCurrentSalonId(null);
          setCurrentBranchId(null);
          if (mounted) setLoading(false);
        }
      }
    );

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
