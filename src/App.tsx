import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Group, Schedule, GroupMember } from './types';
import {
  listenUserParticipatingGroups,
  listenGroupMembers,
} from './services/groupService';
import {
  listenGroupSchedules,
  triggerActiveAlarm,
  hasUserConfirmedComing,
} from './services/scheduleService';
import { LoginScreen } from './components/LoginScreen';
import { GroupList } from './components/GroupList';
import { ScheduleList } from './components/ScheduleList';
import { ScheduleFormModal } from './components/ScheduleFormModal';
import { ScheduleDetailModal } from './components/ScheduleDetailModal';
import { CreateGroupModal } from './components/CreateGroupModal';
import { JoinGroupModal } from './components/JoinGroupModal';
import { AlarmOverlay } from './components/AlarmOverlay';
import { UserProfilePanel } from './components/UserProfilePanel';
import { AdminUserManagement } from './components/AdminUserManagement';
import { AdminGlobalSchedules } from './components/AdminGlobalSchedules';
import { UserPersonalSchedules } from './components/UserPersonalSchedules';
import { alarmAudio } from './lib/alarmAudio';
import {
  Bell,
  Shield,
  Users,
  Calendar,
  Layers,
  ChevronRight,
  UserCheck,
  Plus,
  KeyRound,
  Eye,
} from 'lucide-react';

type AdminTab = 'groups' | 'schedules' | 'users';
type AdminViewMode = 'leader' | 'member';

function MainApp() {
  const { user, loading } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  // Admin tabs & mode
  const [adminTab, setAdminTab] = useState<AdminTab>('groups');
  const [adminViewMode, setAdminViewMode] = useState<AdminViewMode>('leader');
  const [userSubTab, setUserSubTab] = useState<'groups' | 'schedules'>('groups');

  // Modals
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isJoinGroupOpen, setIsJoinGroupOpen] = useState(false);
  const [isCreateScheduleOpen, setIsCreateScheduleOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [activeRingingSchedule, setActiveRingingSchedule] = useState<Schedule | null>(null);

  const isAdmin = user?.role === 'admin';

  // Listen to participating groups in real-time
  // Regular users ONLY receive groups they created or joined
  // Admins in Leader view receive all groups, or their own in Member view
  useEffect(() => {
    if (!user) {
      setGroups([]);
      setSelectedGroup(null);
      return;
    }

    const isAdminOversight = isAdmin && adminViewMode === 'leader';
    const unsub = listenUserParticipatingGroups(
      user.id,
      isAdminOversight,
      (loadedGroups) => {
        setGroups(loadedGroups);
        // Keep selected group updated
        if (selectedGroup) {
          const updated = loadedGroups.find((g) => g.id === selectedGroup.id);
          if (updated) setSelectedGroup(updated);
        }
      }
    );
    return () => unsub();
  }, [user, isAdmin, adminViewMode, selectedGroup?.id]);

  // Listen to members of selected group (only if user is authenticated)
  useEffect(() => {
    if (!user || !selectedGroup) {
      setGroupMembers([]);
      return;
    }
    const unsub = listenGroupMembers(selectedGroup.id, (members) => {
      setGroupMembers(members);
    });
    return () => unsub();
  }, [user, selectedGroup?.id]);

  // Listen to schedules of selected group for displaying in ScheduleList
  useEffect(() => {
    if (!user || !selectedGroup) {
      setSchedules([]);
      return;
    }
    const unsub = listenGroupSchedules(selectedGroup.id, (loadedSchedules) => {
      setSchedules(loadedSchedules);
    });
    return () => unsub();
  }, [user, selectedGroup?.id]);

  // Tracking refs to avoid stale loops or duplicate triggers
  const dismissedAlarmsRef = useRef<Map<string, number>>(new Map());
  const allGroupsSchedulesRef = useRef<Record<string, Schedule[]>>({});
  const triggeredKeysRef = useRef<Set<string>>(new Set());

  // Global Active Alarm Listener:
  // Listens across ALL groups the user belongs to so alarms ring in real-time for EVERY member
  useEffect(() => {
    if (!user || groups.length === 0) return;

    const unsubs: (() => void)[] = [];

    groups.forEach((grp) => {
      const unsub = listenGroupSchedules(grp.id, (loadedSchedules) => {
        allGroupsSchedulesRef.current[grp.id] = loadedSchedules;

        const now = Date.now();
        const ringing = loadedSchedules.find((s) => {
          if (!s.activeAlarmTimestamp) return false;
          const isRecent = s.activeAlarmTimestamp > now - 180000;
          const lastDismissed = dismissedAlarmsRef.current.get(s.id) || 0;
          const isNotDismissed = s.activeAlarmTimestamp > lastDismissed;
          if (!isRecent || !isNotDismissed) return false;

          // A member who confirms "I'm Coming" stops ringing immediately and never sees the full-screen alarm again
          if (hasUserConfirmedComing(user.id, s.id)) {
            return false;
          }

          // Smart Ring: skip members if ring targets only pending users and this user is not targeted
          if (s.ringTargetUserIds && Array.isArray(s.ringTargetUserIds)) {
            if (!s.ringTargetUserIds.includes(user.id)) {
              return false;
            }
          }

          return true;
        });

        if (ringing) {
          setActiveRingingSchedule({ ...ringing, groupName: grp.name });
        }
      });
      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [user, groups]);

  // Automatic Scheduled Time Checker:
  // Checks every 5 seconds if any scheduled alarm is due (startDate, startTime, repeatDays, reminderMinutes)
  // When due, group leader broadcasts to all members in Firestore; members ring locally
  useEffect(() => {
    if (!user || groups.length === 0) return;

    const checkScheduledAlarms = () => {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const todayDateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const currentDayOfWeek = now.getDay();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      groups.forEach((grp) => {
        const scheds = allGroupsSchedulesRef.current[grp.id] || [];
        const isLeaderOrAdmin = grp.ownerId === user.id || user.role === 'admin';

        scheds.forEach((sch) => {
          if (!sch.startTime) return;
          const [sh, sm] = sch.startTime.split(':').map(Number);
          if (isNaN(sh) || isNaN(sm)) return;
          const eventMinutes = sh * 60 + sm;
          const reminderOffset = sch.reminderMinutes || 0;
          const triggerMinutes = (eventMinutes - reminderOffset + 1440) % 1440;

          // Date check
          let dateMatches = false;
          if (sch.scheduleType === 'single') {
            dateMatches = todayDateStr === sch.startDate;
          } else if (sch.scheduleType === 'recurring') {
            const afterStart = todayDateStr >= sch.startDate;
            const beforeEnd = !sch.endDate || todayDateStr <= sch.endDate;
            const dayInWeek = (sch.repeatDays || [0, 1, 2, 3, 4, 5, 6]).includes(currentDayOfWeek);
            dateMatches = afterStart && beforeEnd && dayInWeek;
          } else {
            const afterStart = todayDateStr >= sch.startDate;
            const beforeEnd = !sch.endDate || todayDateStr <= sch.endDate;
            dateMatches = afterStart && beforeEnd;
          }

          if (!dateMatches) return;

          // Time check: match current minute
          if (currentMinutes === triggerMinutes) {
            const triggerKey = `${sch.id}_${todayDateStr}_${triggerMinutes}`;
            if (triggeredKeysRef.current.has(triggerKey)) return;
            triggeredKeysRef.current.add(triggerKey);

            if (isLeaderOrAdmin) {
              triggerActiveAlarm(grp.id, sch.id).catch((err) => {
                console.error('Auto-trigger schedule error:', err);
              });
            } else {
              setActiveRingingSchedule({ ...sch, groupName: grp.name });
            }
          }
        });
      });
    };

    const intervalId = window.setInterval(checkScheduledAlarms, 5000);
    checkScheduledAlarms();

    return () => window.clearInterval(intervalId);
  }, [user, groups]);

  // Unlock web audio context on user gesture anywhere on screen
  useEffect(() => {
    const handleGesture = () => {
      alarmAudio.unlockAudio();
    };
    window.addEventListener('click', handleGesture, { once: false });
    window.addEventListener('touchstart', handleGesture, { once: false });
    window.addEventListener('keydown', handleGesture, { once: false });
    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('touchstart', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
  }, []);

  // Keep selected schedule updated with real-time edits from Firestore
  useEffect(() => {
    if (!selectedSchedule) return;
    const unsub = listenGroupSchedules(selectedSchedule.groupId, (loaded) => {
      const match = loaded.find((s) => s.id === selectedSchedule.id);
      if (match) setSelectedSchedule(match);
    });
    return () => unsub();
  }, [selectedSchedule?.id, selectedSchedule?.groupId]);

  // Broadcast alarm to ALL members across devices via Firestore and open overlay
  // Enforces strictly that only group leader or admin can trigger
  const handleTriggerAlarm = async (schedule: Schedule, targetUserIds?: string[]) => {
    const grp =
      groups.find((g) => g.id === schedule.groupId) ||
      (selectedGroup?.id === schedule.groupId ? selectedGroup : null);
    const isLeader = Boolean(grp && grp.ownerId === user?.id);
    const isPermitted = isLeader || user?.role === 'admin';

    if (!isPermitted) {
      alert("You don't have permission to do this.");
      return;
    }

    try {
      await triggerActiveAlarm(schedule.groupId, schedule.id, targetUserIds);
      setActiveRingingSchedule({ ...schedule, groupName: grp?.name || 'Group Event' });
    } catch (err: unknown) {
      console.error('Trigger alarm broadcast error:', err);
      alert((err as Error)?.message || "You don't have permission to do this.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EEF2F8] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-blue-900 tracking-wider">Loading Group Alarm...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EEF2F8] flex flex-col items-center justify-start py-3 sm:py-6 px-3 sm:px-6">
      {/* Top Application Navigation Bar */}
      <header className="w-full max-w-5xl px-4 sm:px-6 py-3 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white rounded-2xl shadow-xs border border-slate-200">
        {/* Left: Brand Identity */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1D4ED8] flex items-center justify-center text-white shadow-2xs">
              <Bell className="w-5 h-5 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black text-slate-900 leading-tight">
                  Group Alarm
                </h1>
                {user && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isAdmin
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {isAdmin ? 'Admin' : 'User'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                {isAdmin
                  ? 'Administrator Master Oversight & Group Management'
                  : 'Schedules & synchronized alarms with RSVP tracking'}
              </p>
            </div>
          </div>
        </div>

        {/* Center: Admin Tab Navigation (Admin only) */}
        {user && isAdmin && (
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start md:self-auto border border-slate-200/80">
            <button
              onClick={() => {
                setAdminTab('groups');
                setSelectedGroup(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                adminTab === 'groups'
                  ? 'bg-white text-blue-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Groups</span>
            </button>
            <button
              onClick={() => {
                setAdminTab('schedules');
                setSelectedGroup(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                adminTab === 'schedules'
                  ? 'bg-white text-blue-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>All Schedules</span>
            </button>
            <button
              onClick={() => {
                setAdminTab('users');
                setSelectedGroup(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                adminTab === 'users'
                  ? 'bg-white text-blue-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Users</span>
            </button>
          </div>
        )}

        {/* Right Navigation Controls */}
        <div className="flex items-center gap-2.5 self-end md:self-auto">
          {/* Admin Flow Mode Toggle (Leader View vs Member View) */}
          {user && isAdmin && adminTab === 'groups' && (
            <button
              onClick={() =>
                setAdminViewMode(adminViewMode === 'leader' ? 'member' : 'leader')
              }
              title="Switch between Group Leader view and Member view"
              className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold flex items-center gap-1.5 border border-blue-200 transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-blue-600" />
              <span>{adminViewMode === 'leader' ? 'Leader View' : 'Member View'}</span>
            </button>
          )}

          {/* User Profile Panel Trigger */}
          {user && (
            <button
              onClick={() => setIsProfileOpen(true)}
              className="flex items-center gap-2 p-1.5 pl-2.5 pr-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/90 transition-all cursor-pointer group"
              title="Open Account Profile"
            >
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  user.name.substring(0, 1).toUpperCase()
                )}
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-xs font-bold text-slate-800 group-hover:text-blue-700 transition-colors leading-tight">
                  {user.name}
                </div>
                <div className="text-[10px] text-slate-400 capitalize">
                  {user.role} Account
                </div>
              </div>
            </button>
          )}
        </div>
      </header>

      {/* Main App Container */}
      <main className="w-full max-w-5xl bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col min-h-[580px]">
        {!user ? (
          <LoginScreen />
        ) : isAdmin && adminTab === 'users' ? (
          /* Admin View 1: User Management */
          <div className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">User Management</h2>
                <p className="text-xs text-slate-500">
                  Manage registered users, update roles, or deactivate accounts.
                </p>
              </div>
            </div>
            <AdminUserManagement currentAdmin={user} />
          </div>
        ) : isAdmin && adminTab === 'schedules' ? (
          /* Admin View 2: All Group Alarm Schedules Oversight */
          <div className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  All Group Alarm Schedules Oversight
                </h2>
                <p className="text-xs text-slate-500">
                  Master view of all alarm events across all groups in the system.
                </p>
              </div>
            </div>
            <AdminGlobalSchedules
              groups={groups}
              currentUser={user}
              onSelectSchedule={(sch, grp) => {
                setSelectedGroup(grp);
                setSelectedSchedule(sch);
              }}
              onTriggerAlarm={handleTriggerAlarm}
            />
          </div>
        ) : selectedGroup ? (
          /* Group Schedules View (Leader / Member View) */
          <ScheduleList
            group={selectedGroup}
            schedules={schedules}
            members={groupMembers}
            currentUser={user}
            onBack={() => setSelectedGroup(null)}
            onOpenCreateSchedule={() => setIsCreateScheduleOpen(true)}
            onSelectSchedule={(sch) => setSelectedSchedule(sch)}
            onTriggerAlarm={handleTriggerAlarm}
          />
        ) : (
          /* Personal Dashboard (Regular User or Admin in Groups Tab) */
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Dashboard Welcome Header */}
            <div className="bg-[#1D4ED8] text-white px-6 py-5 shadow-xs shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black tracking-tight">
                    {isAdmin
                      ? adminViewMode === 'leader'
                        ? 'Group Leader Dashboard'
                        : 'Member Dashboard'
                      : 'Personal Dashboard'}
                  </h2>
                </div>
                <p className="text-xs text-blue-100 mt-0.5">
                  {isAdmin && adminViewMode === 'leader'
                    ? 'Manage groups and create coordinated alarm events.'
                    : 'Your active groups and synchronized alarm schedules.'}
                </p>
              </div>

              {/* Sub-tab Navigation: My Groups vs My Schedules */}
              <div className="flex items-center gap-1 bg-blue-900/40 p-1 rounded-xl self-start sm:self-auto border border-blue-400/20">
                <button
                  onClick={() => setUserSubTab('groups')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    userSubTab === 'groups'
                      ? 'bg-white text-blue-900 shadow-xs'
                      : 'text-blue-100 hover:text-white'
                  }`}
                >
                  My Groups ({groups.length})
                </button>
                <button
                  onClick={() => setUserSubTab('schedules')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    userSubTab === 'schedules'
                      ? 'bg-white text-blue-900 shadow-xs'
                      : 'text-blue-100 hover:text-white'
                  }`}
                >
                  My Alarm Schedules
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsJoinGroupOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Join with Code</span>
                </button>
                <button
                  onClick={() => setIsCreateGroupOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 active:scale-95 text-[#1D4ED8] font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Create Group</span>
                </button>
              </div>
            </div>

            {/* Dashboard Content: Groups or Personal Schedules */}
            {userSubTab === 'groups' ? (
              <GroupList
                groups={groups}
                currentUser={user}
                onSelectGroup={(g) => setSelectedGroup(g)}
                onOpenCreateGroup={() => setIsCreateGroupOpen(true)}
                onOpenJoinGroup={() => setIsJoinGroupOpen(true)}
              />
            ) : (
              <UserPersonalSchedules
                groups={groups}
                currentUser={user}
                onSelectSchedule={(sch, grp) => {
                  setSelectedGroup(grp);
                  setSelectedSchedule(sch);
                }}
                onTriggerAlarm={handleTriggerAlarm}
                onOpenCreateGroup={() => setIsCreateGroupOpen(true)}
                onOpenJoinGroup={() => setIsJoinGroupOpen(true)}
              />
            )}
          </div>
        )}
      </main>

      {/* User Profile Slide-Over Panel */}
      {user && (
        <UserProfilePanel
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
        />
      )}

      {/* Group Creation Modal (enforces max 10 members) */}
      {user && isCreateGroupOpen && (
        <CreateGroupModal
          currentUser={user}
          isOpen={isCreateGroupOpen}
          onClose={() => setIsCreateGroupOpen(false)}
          onCreated={(newGrp) => {
            setSelectedGroup(newGrp);
          }}
        />
      )}

      {/* Join Group Modal */}
      {user && isJoinGroupOpen && (
        <JoinGroupModal
          currentUser={user}
          isOpen={isJoinGroupOpen}
          onClose={() => setIsJoinGroupOpen(false)}
          onJoined={(joinedGrp) => {
            setSelectedGroup(joinedGrp);
          }}
        />
      )}

      {/* Schedule Form Modal */}
      {user && selectedGroup && isCreateScheduleOpen && (
        <ScheduleFormModal
          groupId={selectedGroup.id}
          currentUser={user}
          isOpen={isCreateScheduleOpen}
          onClose={() => setIsCreateScheduleOpen(false)}
        />
      )}

      {/* Schedule Detail Modal with Edit & Dismissal Reasons */}
      {user && selectedSchedule && (
        <ScheduleDetailModal
          schedule={selectedSchedule}
          currentUser={user}
          members={groupMembers}
          group={selectedGroup || groups.find((g) => g.id === selectedSchedule.groupId)}
          isOpen={Boolean(selectedSchedule)}
          onClose={() => setSelectedSchedule(null)}
          onTestAlarm={handleTriggerAlarm}
        />
      )}

      {/* High-urgency incoming alarm overlay */}
      {user && activeRingingSchedule && (
        <AlarmOverlay
          schedule={activeRingingSchedule}
          groupName={
            activeRingingSchedule.groupName ||
            selectedGroup?.name ||
            groups.find((g) => g.id === activeRingingSchedule.groupId)?.name ||
            'Group Event'
          }
          currentUser={user}
          onClose={() => {
            if (activeRingingSchedule) {
              dismissedAlarmsRef.current.set(
                activeRingingSchedule.id,
                activeRingingSchedule.activeAlarmTimestamp || Date.now()
              );
            }
            setActiveRingingSchedule(null);
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
