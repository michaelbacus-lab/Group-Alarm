import React, { useEffect, useState } from 'react';
import {
  Bell,
  Search,
  Calendar,
  Clock,
  MapPin,
  Play,
  Edit3,
  Users,
  Shield,
} from 'lucide-react';
import { Group, Schedule, AppUser, Acknowledgement } from '../types';
import { listenGroupSchedules, listenGroupAllAcknowledgements, triggerActiveAlarm } from '../services/scheduleService';
import { listenGroupMembers } from '../services/groupService';

interface AdminGlobalSchedulesProps {
  groups: Group[];
  currentUser: AppUser;
  onSelectSchedule: (schedule: Schedule, group: Group) => void;
  onTriggerAlarm: (schedule: Schedule) => void;
}

interface ScheduleWithGroup extends Schedule {
  group: Group;
}

export const AdminGlobalSchedules: React.FC<AdminGlobalSchedulesProps> = ({
  groups,
  currentUser,
  onSelectSchedule,
  onTriggerAlarm,
}) => {
  const [allSchedules, setAllSchedules] = useState<ScheduleWithGroup[]>([]);
  const [search, setSearch] = useState('');
  const [acksMap, setAcksMap] = useState<Record<string, Acknowledgement[]>>({});
  const [groupMembersCount, setGroupMembersCount] = useState<Record<string, number>>({});

  useEffect(() => {
    if (groups.length === 0) return;

    const unsubs: (() => void)[] = [];
    const schedulesByGroup: Record<string, Schedule[]> = {};

    groups.forEach((grp) => {
      // Listen to members count
      const unsubMembers = listenGroupMembers(grp.id, (m) => {
        setGroupMembersCount((prev) => ({ ...prev, [grp.id]: m.length }));
      });
      unsubs.push(unsubMembers);

      // Listen to schedules
      const unsubSched = listenGroupSchedules(grp.id, (scheds) => {
        schedulesByGroup[grp.id] = scheds;

        // Flatten all
        const flattened: ScheduleWithGroup[] = [];
        groups.forEach((g) => {
          const list = schedulesByGroup[g.id] || [];
          list.forEach((s) => {
            flattened.push({ ...s, group: g, groupName: g.name });
          });
        });
        setAllSchedules(flattened);

        // Listen to acknowledgements
        const schedIds = scheds.map((s) => s.id);
        const unsubAcks = listenGroupAllAcknowledgements(grp.id, schedIds, (acks) => {
          setAcksMap((prev) => ({ ...prev, ...acks }));
        });
        unsubs.push(unsubAcks);
      });
      unsubs.push(unsubSched);
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [groups]);

  const filtered = allSchedules.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.group.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.location && s.location.toLowerCase().includes(search.toLowerCase()))
  );

  if (currentUser.role !== 'admin') {
    return (
      <div className="p-8 text-center text-rose-600 font-bold text-sm bg-rose-50 rounded-2xl border border-rose-200">
        You don't have permission to do this.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search all group alarms by title, group, or location..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white"
          />
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 shrink-0">
          <span className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-800 border border-blue-200">
            {allSchedules.length} Total Schedules
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-purple-50 text-purple-800 border border-purple-200">
            {groups.length} Groups Monitored
          </span>
        </div>
      </div>

      {/* Schedules Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filtered.length === 0 ? (
          <div className="col-span-full p-8 text-center text-slate-500 text-xs bg-white rounded-2xl border border-slate-200">
            No group alarm schedules found.
          </div>
        ) : (
          filtered.map((sch) => {
            const totalMembers = Math.min(10, groupMembersCount[sch.groupId] || sch.group.memberCount || 1);
            const acks = acksMap[sch.id] || [];
            const comingCount = acks.filter((a) => a.status === 'coming').length;
            const dismissedCount = acks.filter((a) => a.status === 'dismissed').length;
            const pendingCount = Math.max(0, totalMembers - comingCount - dismissedCount);
            const isCreator = sch.creatorId === currentUser.id;

            return (
              <div
                key={sch.id}
                onClick={() => onSelectSchedule(sch, sch.group)}
                className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {/* Top tags */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 truncate">
                      {sch.group.name}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isCreator ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {isCreator ? 'Created by me' : 'Joined'}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 leading-snug">
                    {sch.title}
                  </h3>

                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-2">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      {sch.startDate}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      {sch.startTime}
                    </span>
                  </div>

                  {sch.location && (
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1 truncate">
                      <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="truncate">{sch.location}</span>
                    </div>
                  )}
                </div>

                {/* Real Member Attendance Row */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      ✓ {comingCount} coming
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      ⏳ {pendingCount} pending
                    </span>
                    {dismissedCount > 0 && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                        ✕ {dismissedCount} Can't make it
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTriggerAlarm(sch);
                    }}
                    className="p-1.5 rounded-xl bg-blue-100 hover:bg-blue-600 hover:text-white text-blue-700 transition-colors shrink-0 flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                    title="Simulate / Trigger Alarm"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Ring</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
