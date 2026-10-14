export type UserRole = 'admin' | 'user';

export const DEFAULT_MAX_MEMBERS_PER_GROUP = 10;

export interface AppUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  phoneNumber?: string;
  role: UserRole;
  plan?: string;
  maxMembersPerGroup?: number;
  createdAt: string;
  isOnline?: boolean;
  lastSeen?: string;
}

export type MemberRole = 'owner' | 'co-leader' | 'admin' | 'member';

export interface GroupMember {
  userId: string;
  name: string;
  email: string;
  avatar?: string;
  role: MemberRole;
  joinedAt: string;
  isOnline?: boolean;
  lastSeen?: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  avatarInitials: string;
  imageUrl?: string;
  inviteCode: string;
  memberCount?: number;
  maxMembers?: number;
  upcomingCount?: number;
  createdAt: string;
}

export type ScheduleType = 'single' | 'range' | 'recurring';
export type ScheduleStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';
export type AlarmSoundType = 'chime' | 'siren' | 'radar' | 'marimba' | 'church' | 'custom';

export interface Schedule {
  id: string;
  groupId: string;
  groupName?: string;
  title: string;
  location?: string;
  description?: string;
  scheduleType: ScheduleType;
  startDate: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  startTime: string; // HH:mm
  repeatDays?: number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  reminderMinutes: number;
  criticalAlert?: boolean;
  alarmSoundType?: AlarmSoundType;
  customSoundName?: string;
  customSoundData?: string;
  creatorId: string;
  creatorName: string;
  status: ScheduleStatus;
  activeAlarmTimestamp?: number;
  lastRingTimestamp?: number;
  ringTargetUserIds?: string[];
  createdAt: string;
  updatedAt?: string;
}

export type AckStatus = 'coming' | 'dismissed' | 'pending';

export interface Acknowledgement {
  userId: string;
  userName: string;
  status: AckStatus;
  reason?: string;
  acknowledgedAt: string;
}

export interface ScheduleOccurrence {
  id: string;
  scheduleId: string;
  schedule: Schedule;
  dateStr: string;
  dayOfWeek: string;
  dayNumber: number;
  formattedDate: string;
  title: string;
  startTime: string;
  location: string;
  reminderText: string;
  isToday: boolean;
  isUpcoming: boolean;
  comingCount: number;
  pendingCount: number;
  dismissedCount: number;
  totalMembers: number;
  ownershipLabel: 'Created by me' | 'Joined';
}
