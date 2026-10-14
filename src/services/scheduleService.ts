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
import { Schedule, Acknowledgement, AckStatus, AppUser } from '../types';

export async function verifyGroupLeaderOrAdmin(groupId: string): Promise<boolean> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) return false;

  if (auth.currentUser?.email?.toLowerCase() === 'michaelbacus@sec.edu.ph') return true;
  try {
    const userDoc = await getDoc(doc(db, 'users', currentUid));
    if (userDoc.exists() && userDoc.data()?.role === 'admin') return true;

    const groupDoc = await getDoc(doc(db, 'groups', groupId));
    if (groupDoc.exists() && groupDoc.data()?.ownerId === currentUid) return true;

    // Co-leaders have the same operational capabilities as the leader
    const memberDoc = await getDoc(doc(db, 'groups', groupId, 'members', currentUid));
    if (memberDoc.exists()) {
      const memberRole = memberDoc.data()?.role;
      if (memberRole === 'co-leader' || memberRole === 'owner') return true;
    }
  } catch (e) {
    console.error('Error verifying permissions:', e);
  }
  return false;
}

export function listenGroupSchedules(
  groupId: string,
  onUpdate: (schedules: Schedule[]) => void,
  onError?: (err: unknown) => void
) {
  const path = `groups/${groupId}/schedules`;
  return onSnapshot(
    collection(db, 'groups', groupId, 'schedules'),
    (snapshot) => {
      const schedules: Schedule[] = [];
      snapshot.forEach((d) => {
        schedules.push(d.data() as Schedule);
      });
      // Sort upcoming by start date and time
      schedules.sort((a, b) => {
        const dateA = a.startDate + ' ' + a.startTime;
        const dateB = b.startDate + ' ' + b.startTime;
        return dateA.localeCompare(dateB);
      });
      onUpdate(schedules);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createSchedule(
  groupId: string,
  data: Omit<Schedule, 'id' | 'groupId' | 'createdAt' | 'status' | 'activeAlarmTimestamp'>,
  currentUser: AppUser
): Promise<Schedule> {
  const isAllowed = await verifyGroupLeaderOrAdmin(groupId);
  if (!isAllowed) {
    throw new Error("You don't have permission to do this.");
  }

  const scheduleId = 'sch_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
  const now = new Date().toISOString();

  const newSchedule: Schedule = {
    ...data,
    id: scheduleId,
    groupId,
    status: 'upcoming',
    activeAlarmTimestamp: 0,
    createdAt: now,
    updatedAt: now,
  };

  const cleanPayload = sanitizePayload(newSchedule as unknown as Record<string, unknown>);

  const path = `groups/${groupId}/schedules/${scheduleId}`;
  try {
    await setDoc(doc(db, 'groups', groupId, 'schedules', scheduleId), cleanPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }

  return newSchedule;
}

export async function updateSchedule(
  groupId: string,
  scheduleId: string,
  updates: Partial<Schedule>
) {
  const isAllowed = await verifyGroupLeaderOrAdmin(groupId);
  if (!isAllowed) {
    throw new Error("You don't have permission to do this.");
  }

  const path = `groups/${groupId}/schedules/${scheduleId}`;
  const cleanUpdates = sanitizePayload({
    ...updates,
    updatedAt: new Date().toISOString(),
  } as unknown as Record<string, unknown>);

  try {
    await updateDoc(doc(db, 'groups', groupId, 'schedules', scheduleId), cleanUpdates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export async function deleteSchedule(groupId: string, scheduleId: string) {
  const isAllowed = await verifyGroupLeaderOrAdmin(groupId);
  if (!isAllowed) {
    throw new Error("You don't have permission to do this.");
  }

  const path = `groups/${groupId}/schedules/${scheduleId}`;
  try {
    await deleteDoc(doc(db, 'groups', groupId, 'schedules', scheduleId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

export async function triggerActiveAlarm(
  groupId: string,
  scheduleId: string,
  targetUserIds?: string[]
) {
  const isAllowed = await verifyGroupLeaderOrAdmin(groupId);
  if (!isAllowed) {
    throw new Error("You don't have permission to do this.");
  }

  // 30-second cooldown enforcement between rings
  const scheduleDoc = await getDoc(doc(db, 'groups', groupId, 'schedules', scheduleId));
  if (scheduleDoc.exists()) {
    const lastRing = scheduleDoc.data()?.lastRingTimestamp || 0;
    const elapsed = Date.now() - lastRing;
    if (elapsed < 30000) {
      const waitSeconds = Math.ceil((30000 - elapsed) / 1000);
      throw new Error(`Cooldown active: Please wait ${waitSeconds}s before ringing again.`);
    }
  }

  const path = `groups/${groupId}/schedules/${scheduleId}`;
  try {
    const updatePayload: Record<string, unknown> = {
      activeAlarmTimestamp: Date.now(),
      lastRingTimestamp: Date.now(),
      status: 'active',
      updatedAt: new Date().toISOString(),
    };
    if (targetUserIds && targetUserIds.length > 0) {
      updatePayload.ringTargetUserIds = targetUserIds;
    } else {
      updatePayload.ringTargetUserIds = null;
    }
    await updateDoc(doc(db, 'groups', groupId, 'schedules', scheduleId), sanitizePayload(updatePayload));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export async function stopActiveAlarm(groupId: string, scheduleId: string) {
  const path = `groups/${groupId}/schedules/${scheduleId}`;
  try {
    await updateDoc(doc(db, 'groups', groupId, 'schedules', scheduleId), {
      activeAlarmTimestamp: 0,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function listenAcknowledgements(
  groupId: string,
  scheduleId: string,
  onUpdate: (acks: Acknowledgement[]) => void
) {
  const path = `groups/${groupId}/schedules/${scheduleId}/acknowledgements`;
  return onSnapshot(
    collection(db, 'groups', groupId, 'schedules', scheduleId, 'acknowledgements'),
    (snapshot) => {
      const acks: Acknowledgement[] = [];
      snapshot.forEach((d) => {
        acks.push(d.data() as Acknowledgement);
      });
      onUpdate(acks);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function listenGroupAllAcknowledgements(
  groupId: string,
  scheduleIds: string[],
  onUpdate: (acksByScheduleId: Record<string, Acknowledgement[]>) => void
) {
  if (scheduleIds.length === 0) {
    onUpdate({});
    return () => {};
  }

  const acksMap: Record<string, Acknowledgement[]> = {};
  const unsubs: (() => void)[] = [];

  scheduleIds.forEach((id) => {
    const unsub = onSnapshot(
      collection(db, 'groups', groupId, 'schedules', id, 'acknowledgements'),
      (snapshot) => {
        const acks: Acknowledgement[] = [];
        snapshot.forEach((d) => acks.push(d.data() as Acknowledgement));
        acksMap[id] = acks;
        onUpdate({ ...acksMap });
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `groups/${groupId}/schedules/${id}/acknowledgements`);
      }
    );
    unsubs.push(unsub);
  });

  return () => {
    unsubs.forEach((u) => u());
  };
}

export async function setScheduleAcknowledgement(
  groupId: string,
  scheduleId: string,
  currentUser: AppUser,
  status: AckStatus,
  reason?: string
) {
  const path = `groups/${groupId}/schedules/${scheduleId}/acknowledgements/${currentUser.id}`;
  const ack: Acknowledgement = {
    userId: currentUser.id,
    userName: currentUser.name,
    status,
    acknowledgedAt: new Date().toISOString(),
  };

  if (reason && reason.trim()) {
    ack.reason = reason.trim();
  }

  const cleanAck = sanitizePayload(ack as unknown as Record<string, unknown>);

  try {
    await setDoc(doc(db, 'groups', groupId, 'schedules', scheduleId, 'acknowledgements', currentUser.id), cleanAck);
    if (status === 'coming') {
      markUserConfirmedComing(currentUser.id, scheduleId);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function markUserConfirmedComing(userId: string, scheduleId: string) {
  try {
    const key = `groupalarm_confirmed_coming_${userId}`;
    const raw = localStorage.getItem(key);
    const set = new Set<string>(raw ? JSON.parse(raw) : []);
    set.add(scheduleId);
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch (e) {
    console.error('Error saving confirmed coming state:', e);
  }
}

export function hasUserConfirmedComing(userId: string, scheduleId: string): boolean {
  try {
    const key = `groupalarm_confirmed_coming_${userId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const set = new Set<string>(JSON.parse(raw));
    return set.has(scheduleId);
  } catch {
    return false;
  }
}
