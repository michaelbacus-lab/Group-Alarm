import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile as updateFbProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import { sanitizePayload } from '../lib/sanitize';
import { AppUser, UserRole, DEFAULT_MAX_MEMBERS_PER_GROUP } from '../types';

interface AuthContextType {
  user: AppUser | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithDemoUser: (name: string, email: string) => Promise<void>;
  updateUserProfile: (name: string, avatar?: string) => Promise<void>;
  updateUserRole: (userId: string, newRole: UserRole) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Sync Firebase User with Firestore Profile
  const syncUserProfile = async (fbUser: FirebaseUser, fallbackName?: string, fallbackEmail?: string) => {
    const userPath = `users/${fbUser.uid}`;
    try {
      const userRef = doc(db, 'users', fbUser.uid);
      const userSnap = await getDoc(userRef);

      const displayName = fbUser.displayName || fallbackName || 'Group Member';
      const email = fbUser.email || fallbackEmail || `${fbUser.uid.substring(0, 8)}@groupalarm.local`;

      // Determine default role: admin if user email is michaelbacus@sec.edu.ph
      const isDefaultAdmin = email.toLowerCase() === 'michaelbacus@sec.edu.ph';

      if (userSnap.exists()) {
        const data = userSnap.data() as AppUser;
        // If it's michaelbacus@sec.edu.ph and not yet admin, upgrade to admin
        if (isDefaultAdmin && data.role !== 'admin') {
          const updated: AppUser = {
            ...data,
            role: 'admin',
            plan: 'Pro Plan',
            maxMembersPerGroup: data.maxMembersPerGroup || DEFAULT_MAX_MEMBERS_PER_GROUP,
          };
          await updateDoc(userRef, { role: 'admin', plan: 'Pro Plan' });
          setUser(updated);
        } else {
          setUser({
            ...data,
            maxMembersPerGroup: data.maxMembersPerGroup || DEFAULT_MAX_MEMBERS_PER_GROUP,
          });
        }
      } else {
        const initialRole: UserRole = isDefaultAdmin ? 'admin' : 'user';
        const initialPlan = isDefaultAdmin ? 'Pro Plan' : 'Free Plan';

        const newUser: AppUser = {
          id: fbUser.uid,
          name: displayName,
          email,
          avatar: fbUser.photoURL || undefined,
          role: initialRole,
          plan: initialPlan,
          maxMembersPerGroup: DEFAULT_MAX_MEMBERS_PER_GROUP,
          createdAt: new Date().toISOString(),
        };
        const cleanUser = sanitizePayload(newUser as unknown as Record<string, unknown>);
        await setDoc(userRef, cleanUser);
        setUser(newUser);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, userPath);
    }
  };

  useEffect(() => {
    let userUnsub: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setFirebaseUser(currentUser);
      if (userUnsub) {
        userUnsub();
        userUnsub = null;
      }

      if (currentUser) {
        await syncUserProfile(currentUser);
        // Real-time server-side synchronization of user document & role
        const userRef = doc(db, 'users', currentUser.uid);
        userUnsub = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setUser(docSnap.data() as AppUser);
          }
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      if (userUnsub) userUnsub();
      unsubscribe();
    };
  }, []);

  // Sync real-time online presence and heartbeat to Firestore
  useEffect(() => {
    if (!firebaseUser) return;

    const setPresence = async (online: boolean) => {
      try {
        const userRef = doc(db, 'users', firebaseUser.uid);
        await updateDoc(userRef, {
          isOnline: online,
          lastSeen: new Date().toISOString(),
        });
      } catch {
        // Non-fatal presence error
      }
    };

    // Mark online immediately
    setPresence(true);

    // Heartbeat every 30 seconds while browser is active and online
    const interval = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        setPresence(true);
      }
    }, 30000);

    const handleOnline = () => setPresence(true);
    const handleOffline = () => setPresence(false);
    const handleBeforeUnload = () => {
      setPresence(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      setPresence(false);
    };
  }, [firebaseUser]);

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      await syncUserProfile(res.user);
    } catch (error: unknown) {
      console.error('Google sign-in error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signInWithDemoUser = async (_name: string, _email: string) => {
    await signInWithGoogle();
  };

  const updateUserProfile = async (name: string, avatar?: string) => {
    if (!user || !firebaseUser) return;
    try {
      const userRef = doc(db, 'users', user.id);
      const updates: Partial<AppUser> = {
        name: name.trim(),
      };
      if (avatar !== undefined) {
        updates.avatar = avatar;
      }

      await updateDoc(userRef, sanitizePayload(updates as unknown as Record<string, unknown>));

      // Also update auth profile if possible
      try {
        await updateFbProfile(firebaseUser, {
          displayName: name.trim(),
          photoURL: avatar || null,
        });
      } catch {
        // ignore auth profile update error if any
      }

      setUser((prev) => (prev ? { ...prev, ...updates } : null));
    } catch (err) {
      console.error('Failed to update profile:', err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.id}`);
    }
  };

  const updateUserRole = async (targetUserId: string, newRole: UserRole) => {
    // Role update can ONLY be performed by an existing Admin
    if (user?.role !== 'admin') {
      alert("You don't have permission to do this.");
      throw new Error("You don't have permission to do this.");
    }
    try {
      const userRef = doc(db, 'users', targetUserId);
      await updateDoc(userRef, {
        role: newRole,
        plan: newRole === 'admin' ? 'Admin Plan' : 'Standard Plan',
      });
      if (user && user.id === targetUserId) {
        setUser((prev) => (prev ? { ...prev, role: newRole } : null));
      }
    } catch (err) {
      console.error('Failed to update user role:', err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUserId}`);
    }
  };

  const logout = async () => {
    try {
      await fbSignOut(auth);
      setUser(null);
      setFirebaseUser(null);
    } catch (error) {
      console.error('Sign-out error:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        signInWithGoogle,
        signInWithDemoUser,
        updateUserProfile,
        updateUserRole,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
