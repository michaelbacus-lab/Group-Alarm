import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import { sanitizePayload } from '../lib/sanitize';
import { Group, GroupMember, AppUser, MemberRole, DEFAULT_MAX_MEMBERS_PER_GROUP } from '../types';

export async function createGroup(
  name: string,
  description: string,
  avatarInitials: string,
  currentUser: AppUser,
  imageUrl?: string
): Promise<Group> {
  const groupId = 'grp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const now = new Date().toISOString();
  const leaderLimit = currentUser.maxMembersPerGroup || DEFAULT_MAX_MEMBERS_PER_GROUP;

  const initials = avatarInitials.trim().toUpperCase().slice(0, 4) || name.substring(0, 2).toUpperCase();

  const newGroup: Group = {
    id: groupId,
    name: name.trim(),
    description: description.trim() || undefined,
    ownerId: currentUser.id,
    avatarInitials: initials,
    imageUrl: imageUrl?.trim() || undefined,
    inviteCode,
    memberCount: 1,
    maxMembers: leaderLimit,
    upcomingCount: 0,
    createdAt: now,
  };

  const groupPath = `groups/${groupId}`;
  try {
    const cleanGroup = sanitizePayload(newGroup as unknown as Record<string, unknown>);
    await setDoc(doc(db, 'groups', groupId), cleanGroup);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, groupPath);
  }

  // Add creator as owner member
  const memberPath = `groups/${groupId}/members/${currentUser.id}`;
  const ownerMember: GroupMember = {
    userId: currentUser.id,
    name: currentUser.name,
    email: currentUser.email,
    role: 'owner',
    joinedAt: now,
  };

  try {
    const cleanMember = sanitizePayload(ownerMember as unknown as Record<string, unknown>);
    await setDoc(doc(db, 'groups', groupId, 'members', currentUser.id), cleanMember);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, memberPath);
  }

  return newGroup;
}

export function listenAllGroups(
  onUpdate: (groups: Group[]) => void,
  onError?: (err: unknown) => void
) {
  const path = 'groups';
  return onSnapshot(
    collection(db, 'groups'),
    (snapshot) => {
      const groups: Group[] = [];
      snapshot.forEach((d) => {
        groups.push(d.data() as Group);
      });
      onUpdate(groups);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function listenUserParticipatingGroups(
  userId: string,
  isAdmin: boolean,
  onUpdate: (groups: Group[]) => void,
  onError?: (err: unknown) => void
) {
  const path = 'groups';
  return onSnapshot(
    collection(db, 'groups'),
    async (snapshot) => {
      const allGroups: Group[] = [];
      snapshot.forEach((d) => {
        allGroups.push(d.data() as Group);
      });

      if (isAdmin) {
        onUpdate(allGroups);
        return;
      }

      // For regular users: strictly filter to groups they created or joined
      const memberChecks = await Promise.all(
        allGroups.map(async (grp) => {
          if (grp.ownerId === userId) return { grp, isMember: true };
          try {
            const memberDoc = await getDoc(doc(db, 'groups', grp.id, 'members', userId));
            return { grp, isMember: memberDoc.exists() };
          } catch {
            return { grp, isMember: false };
          }
        })
      );

      const userGroups = memberChecks
        .filter((item) => item.isMember)
        .map((item) => item.grp);

      onUpdate(userGroups);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function listenGroupMembers(
  groupId: string,
  onUpdate: (members: GroupMember[]) => void
) {
  const path = `groups/${groupId}/members`;
  return onSnapshot(
    collection(db, 'groups', groupId, 'members'),
    (snapshot) => {
      const members: GroupMember[] = [];
      snapshot.forEach((d) => {
        members.push(d.data() as GroupMember);
      });
      onUpdate(members);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function joinGroupByCode(
  code: string,
  currentUser: AppUser
): Promise<Group> {
  const path = 'groups';
  const cleanCode = code.trim().toUpperCase();

  let targetGroup: Group | null = null;
  try {
    const q = query(collection(db, 'groups'), where('inviteCode', '==', cleanCode));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      throw new Error(`No group found with invite code "${cleanCode}".`);
    }
    targetGroup = snapshot.docs[0].data() as Group;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }

  if (!targetGroup) {
    throw new Error('Group not found');
  }

  const memberPath = `groups/${targetGroup.id}/members/${currentUser.id}`;
  try {
    const memberDoc = await getDoc(doc(db, 'groups', targetGroup.id, 'members', currentUser.id));
    
    // Check if user is already a member
    if (memberDoc.exists()) {
      return targetGroup;
    }

    // Look up leader's current max members limit
    let leaderLimit = targetGroup.maxMembers || DEFAULT_MAX_MEMBERS_PER_GROUP;
    try {
      const leaderDoc = await getDoc(doc(db, 'users', targetGroup.ownerId));
      if (leaderDoc.exists() && leaderDoc.data()?.maxMembersPerGroup) {
        leaderLimit = leaderDoc.data()?.maxMembersPerGroup;
      }
    } catch {
      // fallback to targetGroup.maxMembers
    }

    // Check members constraint
    const membersSnap = await getDocs(collection(db, 'groups', targetGroup.id, 'members'));
    if (membersSnap.size >= leaderLimit) {
      throw new Error('This group has reached its member limit.');
    }

    const newMember: GroupMember = {
      userId: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      avatar: currentUser.avatar,
      role: 'member',
      joinedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'groups', targetGroup.id, 'members', currentUser.id), sanitizePayload(newMember as unknown as Record<string, unknown>));

    // Update member count and ensure group's maxMembers is kept synced with leader's limit
    const updatedCount = membersSnap.size + 1;
    await updateDoc(doc(db, 'groups', targetGroup.id), {
      memberCount: updatedCount,
      maxMembers: leaderLimit,
    });
    targetGroup.memberCount = updatedCount;
    targetGroup.maxMembers = leaderLimit;
  } catch (error) {
    if (error instanceof Error && error.message.includes('member limit')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, memberPath);
  }

  return targetGroup;
}

export async function leaveGroup(groupId: string, userId: string) {
  const path = `groups/${groupId}/members/${userId}`;
  try {
    await deleteDoc(doc(db, 'groups', groupId, 'members', userId));
    const membersSnap = await getDocs(collection(db, 'groups', groupId, 'members'));
    await updateDoc(doc(db, 'groups', groupId), {
      memberCount: membersSnap.size,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function removeGroupMember(groupId: string, memberId: string) {
  const path = `groups/${groupId}/members/${memberId}`;
  try {
    await deleteDoc(doc(db, 'groups', groupId, 'members', memberId));
    const membersSnap = await getDocs(collection(db, 'groups', groupId, 'members'));
    await updateDoc(doc(db, 'groups', groupId), {
      memberCount: membersSnap.size,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncGroupMemberCount(groupId: string): Promise<number> {
  const path = `groups/${groupId}/members`;
  try {
    const membersSnap = await getDocs(collection(db, 'groups', groupId, 'members'));
    const actualCount = membersSnap.size;
    await updateDoc(doc(db, 'groups', groupId), {
      memberCount: actualCount,
    });
    return actualCount;
  } catch (error) {
    console.error('Error syncing group member count:', error);
    return 1;
  }
}

export async function updateGroupMemberRole(
  groupId: string,
  memberId: string,
  newRole: MemberRole,
  callerUser?: AppUser
) {
  const currentUid = auth.currentUser?.uid || callerUser?.id;
  if (!currentUid) throw new Error("Authentication required. Please sign in again.");

  const groupDoc = await getDoc(doc(db, 'groups', groupId));
  const isOwner = (groupDoc.exists() && groupDoc.data()?.ownerId === currentUid) || callerUser?.id === groupDoc.data()?.ownerId;
  const isAdmin = callerUser?.role === 'admin';

  if (!isOwner && !isAdmin) {
    // If not immediately resolved from callerUser, check user doc
    try {
      const userDoc = await getDoc(doc(db, 'users', currentUid));
      if (!userDoc.exists() || userDoc.data()?.role !== 'admin') {
        throw new Error("Only the original group leader can manage co-leader roles.");
      }
    } catch {
      throw new Error("Only the original group leader can manage co-leader roles.");
    }
  }

  if (groupDoc.exists() && groupDoc.data()?.ownerId === memberId) {
    throw new Error("Cannot change the role of the original group leader.");
  }

  const memberPath = `groups/${groupId}/members/${memberId}`;
  try {
    await updateDoc(doc(db, 'groups', groupId, 'members', memberId), {
      role: newRole,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, memberPath);
    throw error;
  }
}

export async function updateGroupBadge(
  groupId: string,
  badgeData: { avatarInitials?: string; imageUrl?: string }
) {
  const path = `groups/${groupId}`;
  try {
    await updateDoc(doc(db, 'groups', groupId), sanitizePayload(badgeData as unknown as Record<string, unknown>));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export async function updateGroupSettings(
  groupId: string,
  settings: {
    name?: string;
    description?: string;
    avatarInitials?: string;
    imageUrl?: string | null;
  }
) {
  const path = `groups/${groupId}`;
  try {
    const updateData: Record<string, unknown> = {};
    if (settings.name !== undefined) updateData.name = settings.name.trim();
    if (settings.description !== undefined) updateData.description = settings.description.trim() || '';
    if (settings.avatarInitials !== undefined) {
      updateData.avatarInitials = settings.avatarInitials.trim().slice(0, 4).toUpperCase();
    }
    if (settings.imageUrl !== undefined) {
      updateData.imageUrl = settings.imageUrl ? settings.imageUrl.trim() : '';
    }

    await updateDoc(doc(db, 'groups', groupId), sanitizePayload(updateData));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export async function deleteGroup(groupId: string, callerUser?: AppUser) {
  const currentUid = auth.currentUser?.uid || callerUser?.id;
  if (!currentUid) throw new Error("Unauthorized");

  const groupDoc = await getDoc(doc(db, 'groups', groupId));
  const isOwner = (groupDoc.exists() && groupDoc.data()?.ownerId === currentUid) || callerUser?.id === groupDoc.data()?.ownerId;
  const isAdmin = callerUser?.role === 'admin';

  if (!isOwner && !isAdmin) {
    try {
      const userDoc = await getDoc(doc(db, 'users', currentUid));
      if (!userDoc.exists() || userDoc.data()?.role !== 'admin') {
        throw new Error("Only the original leader who created the group can delete it.");
      }
    } catch {
      throw new Error("Only the original leader who created the group can delete it.");
    }
  }

  const path = `groups/${groupId}`;
  try {
    await deleteDoc(doc(db, 'groups', groupId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}
