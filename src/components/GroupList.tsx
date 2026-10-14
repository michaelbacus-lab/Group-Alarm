import React, { useState } from 'react';
import { Plus, Users, KeyRound, ChevronRight, Search } from 'lucide-react';
import { Group, AppUser } from '../types';

interface GroupListProps {
  groups: Group[];
  currentUser: AppUser;
  onSelectGroup: (group: Group) => void;
  onOpenCreateGroup: () => void;
  onOpenJoinGroup: () => void;
}

export const GroupList: React.FC<GroupListProps> = ({
  groups,
  currentUser,
  onSelectGroup,
  onOpenCreateGroup,
  onOpenJoinGroup,
}) => {
  const [search, setSearch] = useState('');

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    (g.description && g.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="relative flex-1 flex flex-col h-full bg-white overflow-hidden">
      {/* Top action bar: Search & Quick Join */}
      <div className="p-4 bg-slate-50/70 border-b border-slate-200/80 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search groups..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
          />
        </div>
        <button
          onClick={onOpenJoinGroup}
          title="Join with invite code"
          className="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-blue-300 text-blue-700 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors shrink-0 min-h-[44px] cursor-pointer"
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>Code</span>
        </button>
      </div>

      {/* Group List Body */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 pb-20">
        {filteredGroups.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center my-auto">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">No Groups Found</h3>
            <p className="text-xs text-slate-500 max-w-xs mb-6">
              Create a group for your church, team, or barkada to coordinate schedules and alarms.
            </p>
            <div className="flex flex-col gap-2.5 w-full max-w-xs">
              <button
                onClick={onOpenCreateGroup}
                className="w-full py-3 px-4 rounded-xl bg-[#1D4ED8] hover:bg-blue-800 text-white font-bold text-xs shadow-sm transition-all cursor-pointer min-h-[44px]"
              >
                + Create New Group
              </button>
            </div>
          </div>
        ) : (
          filteredGroups.map((group) => {
            const isOwner = group.ownerId === currentUser.id;
            const initials = (() => {
              if (group.avatarInitials) return group.avatarInitials;
              const letters = group.name
                .trim()
                .split(/\s+/)
                .map((w) => w[0])
                .filter((ch) => ch && /[a-zA-Z]/.test(ch));
              if (letters.length >= 2) return (letters[0] + letters[1]).toUpperCase();
              return group.name.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() || 'GA';
            })();

            return (
              <div
                key={group.id}
                onClick={() => onSelectGroup(group)}
                className="flex items-center gap-3.5 p-4 hover:bg-slate-50/80 active:bg-slate-100 transition-colors cursor-pointer group min-h-[56px]"
              >
                {/* Avatar Badge: Group logo image or initials */}
                <div className="w-11 h-11 rounded-xl bg-[#DCEAFE] text-[#1D4ED8] font-black text-sm flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform overflow-hidden border border-blue-200/50">
                  {group.imageUrl ? (
                    <img src={group.imageUrl} alt={group.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="tracking-tight text-center px-1 truncate text-xs sm:text-sm">
                      {group.avatarInitials || initials}
                    </span>
                  )}
                </div>

                {/* Meta details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-sm font-bold text-slate-900 truncate">
                      {group.name}
                    </h3>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        isOwner
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-purple-100 text-purple-800 border border-purple-200'
                      }`}
                    >
                      {isOwner ? 'Created by me' : 'Joined'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 truncate flex items-center gap-2">
                    <span className="font-semibold text-slate-700">
                      {group.memberCount || 1} / {group.maxMembers || 10} members
                    </span>
                    <span>•</span>
                    <span>Code: {group.inviteCode}</span>
                  </p>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
              </div>
            );
          })
        )}
      </div>

      {/* Floating Action Button (+) */}
      <button
        onClick={onOpenCreateGroup}
        aria-label="Create group"
        className="absolute right-5 bottom-6 w-13 h-13 rounded-2xl bg-[#1D4ED8] hover:bg-blue-800 text-white flex items-center justify-center shadow-lg shadow-blue-800/35 hover:scale-105 active:scale-95 transition-all cursor-pointer z-10"
      >
        <Plus className="w-7 h-7 stroke-[2.5]" />
      </button>
    </div>
  );
};
