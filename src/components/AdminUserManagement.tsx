import React, { useEffect, useState } from 'react';
import {
  Users,
  Search,
  Shield,
  UserCheck,
  Edit2,
  Trash2,
  X,
  Check,
  AlertCircle,
  Mail,
  Calendar,
} from 'lucide-react';
import { AppUser, UserRole } from '../types';
import { listenAllUsers, updateUser, deleteUser } from '../services/userService';

interface AdminUserManagementProps {
  currentAdmin: AppUser;
}

export const AdminUserManagement: React.FC<AdminUserManagementProps> = ({ currentAdmin }) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('user');
  const [editMaxMembers, setEditMaxMembers] = useState<number>(10);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = listenAllUsers((loadedUsers) => {
      setUsers(loadedUsers);
    });
    return () => unsub();
  }, []);

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleStartEdit = (user: AppUser) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditRole(user.role || 'user');
    setEditMaxMembers(user.maxMembersPerGroup || 10);
    setError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentAdmin.role !== 'admin') {
      alert("You don't have permission to do this.");
      return;
    }
    if (!editingUser) return;

    // Prevent demoting the last admin
    if (editingUser.role === 'admin' && editRole !== 'admin') {
      const otherAdmins = users.filter((u) => u.role === 'admin' && u.id !== editingUser.id);
      if (otherAdmins.length === 0) {
        alert("Cannot demote the last administrator. The system must retain at least one Admin.");
        return;
      }
    }

    const limitVal = Math.round(Number(editMaxMembers));
    if (isNaN(limitVal) || limitVal < 2 || limitVal > 500) {
      setError('Member limit must be a whole number between 2 and 500.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateUser(
        editingUser.id,
        {
          name: editName.trim(),
          role: editRole,
          maxMembersPerGroup: limitVal,
        },
        {
          targetUserEmail: editingUser.email,
          currentLimit: editingUser.maxMembersPerGroup || 10,
        }
      );
      setEditingUser(null);
    } catch (err) {
      console.error(err);
      setError((err as Error)?.message || 'Failed to update user.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId: string, name: string) => {
    if (currentAdmin.role !== 'admin') {
      alert("You don't have permission to do this.");
      return;
    }
    if (userId === currentAdmin.id) {
      alert("You cannot remove your own admin account.");
      return;
    }

    // Prevent removing the last admin
    const targetUser = users.find((u) => u.id === userId);
    if (targetUser?.role === 'admin') {
      const otherAdmins = users.filter((u) => u.role === 'admin' && u.id !== userId);
      if (otherAdmins.length === 0) {
        alert("Cannot remove the last administrator. The system must retain at least one Admin.");
        return;
      }
    }

    if (!confirm(`Are you sure you want to remove user "${name}" (${targetUser?.email})? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteUser(userId);
    } catch (err) {
      console.error(err);
      alert('Failed to remove user.');
    }
  };

  if (currentAdmin.role !== 'admin') {
    return (
      <div className="p-8 text-center text-rose-600 font-bold text-sm bg-rose-50 rounded-2xl border border-rose-200">
        You don't have permission to do this.
      </div>
    );
  }

  const adminCount = users.filter((u) => u.role === 'admin').length;

  return (
    <div className="space-y-4">
      {/* Search & Statistics Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users by name or email..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white"
          />
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 shrink-0">
          <span className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-800 border border-blue-200">
            {users.length} Registered Users
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200">
            {adminCount} {adminCount === 1 ? 'Admin' : 'Admins'}
          </span>
        </div>
      </div>

      {/* Users Table / List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs divide-y divide-slate-100">
        {filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No users found matching your search.
          </div>
        ) : (
          filteredUsers.map((u) => {
            const isSelf = u.id === currentAdmin.id;
            return (
              <div
                key={u.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
              >
                {/* User Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                    {u.avatar ? (
                      <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
                    ) : (
                      u.name.substring(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900 truncate">
                        {u.name}
                      </span>
                      {isSelf && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700">
                          You
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        {u.email}
                      </span>
                      <span>•</span>
                      <span>Joined {new Date(u.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Role, Limit & Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto flex-wrap">
                  {/* Member Limit Badge on Each User Row */}
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                    Limit: {u.maxMembersPerGroup || 10}
                  </span>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 ${
                      u.role === 'admin'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Shield className="w-3 h-3" />
                    <span className="capitalize">{u.role === 'admin' ? 'Admin' : 'User'}</span>
                  </span>

                  <button
                    onClick={() => handleStartEdit(u)}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 transition-colors cursor-pointer"
                    title="Edit user details, limit, and role"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  {!isSelf && (
                    <button
                      onClick={() => handleDeleteUser(u.id, u.name)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                      title="Remove user"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Manage User Account</h3>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  User Email (Read-only)
                </label>
                <input
                  type="text"
                  disabled
                  value={editingUser.email}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 text-xs text-slate-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F4F7FD] text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Max Members per Group (2 – 500)
                </label>
                <input
                  type="number"
                  required
                  min={2}
                  max={500}
                  step={1}
                  value={editMaxMembers}
                  onChange={(e) => setEditMaxMembers(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F4F7FD] text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 min-h-[44px]"
                />
                <p className="text-[10.5px] text-slate-500 mt-1">
                  Groups led by this user will be capped at this member capacity.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  System Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F4F7FD] text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 min-h-[44px]"
                >
                  <option value="user">User (Standard account)</option>
                  <option value="admin">Admin (System administrator)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="min-h-[44px] flex-1 py-2 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[44px] flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-xs cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
