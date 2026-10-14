import { createGroup } from './groupService';
import { createSchedule, setScheduleAcknowledgement } from './scheduleService';
import { AppUser, GroupMember } from '../types';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export async function seedDemoGroups(currentUser: AppUser) {
  // 1. Church Fellowship
  const church = await createGroup(
    'Church Fellowship',
    'Community schedules, Sunday services, choir rehearsals, and prayer events.',
    'CF',
    currentUser
  );

  // Add 3 sample group members to Church Fellowship (total 4 members out of 10)
  const sampleMembers: GroupMember[] = [
    {
      userId: 'usr_sarah_j',
      name: 'Sarah Jenkins',
      email: 'sarah.j@fellowship.org',
      role: 'member',
      joinedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      userId: 'usr_david_k',
      name: 'David Kim',
      email: 'david.k@fellowship.org',
      role: 'member',
      joinedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    {
      userId: 'usr_maria_s',
      name: 'Maria Santos',
      email: 'maria.s@fellowship.org',
      role: 'member',
      joinedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    },
  ];

  for (const m of sampleMembers) {
    await setDoc(doc(db, 'groups', church.id, 'members', m.userId), m);
  }
  await updateDoc(doc(db, 'groups', church.id), { memberCount: 4 });

  const sundayService = await createSchedule(
    church.id,
    {
      title: 'Sunday Service',
      location: 'Main Hall',
      description: 'Weekly worship and fellowship service. Please arrive 15 minutes early.',
      scheduleType: 'recurring',
      startDate: new Date().toISOString().split('T')[0],
      startTime: '08:00',
      repeatDays: [0], // Sunday
      reminderMinutes: 30,
      criticalAlert: true,
      creatorId: currentUser.id,
      creatorName: currentUser.name,
    },
    currentUser
  );

  await setScheduleAcknowledgement(church.id, sundayService.id, currentUser, 'coming');

  const choirPractice = await createSchedule(
    church.id,
    {
      title: 'Choir Practice',
      location: 'Room 2',
      description: 'Vocal warmups and preparations for the coming Sunday repertoire.',
      scheduleType: 'single',
      startDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      startTime: '18:30',
      reminderMinutes: 60,
      criticalAlert: true,
      creatorId: currentUser.id,
      creatorName: currentUser.name,
    },
    currentUser
  );

  await setScheduleAcknowledgement(church.id, choirPractice.id, currentUser, 'coming');

  const youthCamp = await createSchedule(
    church.id,
    {
      title: 'Youth Camp',
      location: 'Retreat Hall',
      description: 'Annual youth leadership camp sessions and spiritual workshops.',
      scheduleType: 'range',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
      startTime: '07:00',
      repeatDays: [1, 3, 5], // Mon, Wed, Fri
      reminderMinutes: 30,
      criticalAlert: true,
      creatorId: currentUser.id,
      creatorName: currentUser.name,
    },
    currentUser
  );

  await setScheduleAcknowledgement(church.id, youthCamp.id, currentUser, 'coming');

  // 2. Basketball Barkada
  const basketball = await createGroup(
    'Basketball Barkada',
    'Weekly pickup games, court bookings, and tournament updates.',
    'BB',
    currentUser
  );

  await createSchedule(
    basketball.id,
    {
      title: 'Friday Night Game',
      location: 'Covered Court 1',
      description: 'Bring light and dark jerseys. Winner stays on!',
      scheduleType: 'recurring',
      startDate: new Date().toISOString().split('T')[0],
      startTime: '19:00',
      repeatDays: [5], // Friday
      reminderMinutes: 60,
      criticalAlert: true,
      creatorId: currentUser.id,
      creatorName: currentUser.name,
    },
    currentUser
  );

  // 3. Family Affairs
  const family = await createGroup(
    'Family Affairs',
    'Family reunions, birthdays, and anniversary reminders.',
    'FA',
    currentUser
  );

  await createSchedule(
    family.id,
    {
      title: 'Sunday Family Dinner',
      location: "Grandma's House",
      description: 'Potluck dinner with cousins and grandparents.',
      scheduleType: 'recurring',
      startDate: new Date().toISOString().split('T')[0],
      startTime: '18:00',
      repeatDays: [0], // Sunday
      reminderMinutes: 120,
      criticalAlert: false,
      creatorId: currentUser.id,
      creatorName: currentUser.name,
    },
    currentUser
  );

  return church;
}
