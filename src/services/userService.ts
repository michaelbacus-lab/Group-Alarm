import {
  collection,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import { sanitizePayload } from '../lib/sanitize';
import { AppUser } from '../types';

export async function checkCallerIsAdmin(): Promise<boolean> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) return false;
  if (auth.currentUser?.email?.toLowerCase() === 'michaelbacus@sec.edu.ph') return true;
  try {
    const snap = await getDoc(doc(db, 'users', currentUid));
    return snap.exists() && snap.data()?.role === 'admin';
  } catch {
    return false;
  }
}

export function listenAllUsers(
  onUpdate: (users: AppUser[]) => void,
  onError?: (err: unknown) => void
) {
  const path = 'users';
  return onSnapshot(
    collection(db, 'users'),
    (snapshot) => {
      const users: AppUser[] = [];
      snapshot.forEach((d) => {
        users.push(d.data() as AppUser);
      });
      // Sort by creation date descending
      users.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onUpdate(users);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

import { DEFAULT_MAX_MEMBERS_PER_GROUP } from '../types';

export async function logAdminLimitChange(
  actorUid: string,
  actorEmail: string,
  targetUserId: string,
  targetUserEmail: string,
  oldValue: number,
  newValue: number
) {
  try {
    const logId = 'log_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
    const logEntry = {
      id: logId,
      actorUid,
      actorEmail,
      targetUserId,
      targetUserEmail,
      oldValue,
      newValue,
      action: 'UPDATE_MEMBER_LIMIT',
      timestamp: new Date().toISOString(),
    };
    await setDoc(doc(db, 'audit_logs', logId), sanitizePayload(logEntry));
  } catch (err) {
    console.error('Failed to log admin change:', err);
  }
}

export async function updateUser(
  userId: string,
  data: Partial<AppUser>,
  options?: { targetUserEmail?: string; currentLimit?: number }
) {
  const currentUid = auth.currentUser?.uid;
  const currentEmail = auth.currentUser?.email || 'admin@groupalarm.local';
  const isAdmin = await checkCallerIsAdmin();

  // If role or member limit is being changed or someone else's account is being changed, require admin
  if (data.role !== undefined && !isAdmin) {
    throw new Error("You don't have permission to do this.");
  }
  if (data.maxMembersPerGroup !== undefined && !isAdmin) {
    throw new Error("You don't have permission to do this.");
  }
  if (userId !== currentUid && !isAdmin) {
    throw new Error("You don't have permission to do this.");
  }

  // Validate member limit between 2 and 500
  if (data.maxMembersPerGroup !== undefined) {
    const limit = Math.round(Number(data.maxMembersPerGroup));
    if (isNaN(limit) || limit < 2 || limit > 500) {
      throw new Error('Member limit must be a whole number between 2 and 500.');
    }
    data.maxMembersPerGroup = limit;

    // Log the change: who, user, old value, new value
    const oldVal = options?.currentLimit ?? DEFAULT_MAX_MEMBERS_PER_GROUP;
    const targetEmail = options?.targetUserEmail || userId;
    await logAdminLimitChange(
      currentUid || 'unknown_admin',
      currentEmail,
      userId,
      targetEmail,
      oldVal,
      limit
    );
  }

  const path = `users/${userId}`;
  try {
    const clean = sanitizePayload(data as unknown as Record<string, unknown>);
    await updateDoc(doc(db, 'users', userId), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export async function deleteUser(userId: string) {
  const isAdmin = await checkCallerIsAdmin();
  if (!isAdmin) {
    throw new Error("You don't have permission to do this.");
  }

  const path = `users/${userId}`;
  try {
    await deleteDoc(doc(db, 'users', userId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}
