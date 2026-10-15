import React, { useRef, useState } from 'react';
import {
  X,
  Camera,
  Shield,
  User,
  Mail,
  Calendar,
  CreditCard,
  LogOut,
  Check,
  Sparkles,
  Users,
  Smartphone,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOnlineStatus } from '../lib/useOnlineStatus';

interface UserProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenGooglePlayModal?: () => void;
}

export const UserProfilePanel: React.FC<UserProfilePanelProps> = ({
  isOpen,
  onClose,
  onOpenGooglePlayModal,
}) => {
  const { user, updateUserProfile, logout } = useAuth();
  const isOnline = useOnlineStatus();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !user) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      setError('Please choose a profile image under 500KB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setAvatar(result);
        setError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError('Display name cannot be empty.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateUserProfile(displayName.trim(), avatar || undefined);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error(err);
      setError('Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    onClose();
    await logout();
  };

  const formattedDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Recent';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div>
          <div className="bg-[#1D4ED8] text-white px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 ring-2 ring-white/20 flex items-center justify-center font-bold text-white shrink-0 overflow-hidden shadow-xs text-sm">
                {avatar ? (
                  <img src={avatar} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span>{user.name.substring(0, 1).toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold tracking-tight truncate max-w-[200px]">
                    {user.name}
                  </h2>
                  {/* Status indicator (online/offline) dot */}
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-white/30 ${
                      isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
                    }`}
                    title={isOnline ? 'Online' : 'Offline'}
                  />
                </div>
                <div className="text-[11px] text-blue-200 font-medium flex items-center gap-1.5">
                  <span>{user.role === 'admin' ? 'Administrator' : 'Standard User'}</span>
                  <span>•</span>
                  <span className={isOnline ? 'text-emerald-300 font-bold' : 'text-slate-300 font-medium'}>
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-white/10 text-white/90 transition-colors cursor-pointer"
              title="Close Profile"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                {error}
              </div>
            )}

            {savedSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Profile updated successfully!</span>
              </div>
            )}

            {/* Photo Avatar Section */}
            <div className="flex flex-col items-center text-center">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-blue-100 ring-4 ring-blue-50 shadow-md flex items-center justify-center text-2xl font-black text-blue-800">
                  {avatar ? (
                    <img src={avatar} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <span>{user.name.substring(0, 2).toUpperCase()}</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-transform hover:scale-110 cursor-pointer"
                  title="Upload profile photo"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              <div className="mt-3 flex flex-col items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-500">
                  Tap camera icon to upload photo (under 500KB)
                </span>
                {avatar && (
                  <button
                    type="button"
                    onClick={() => setAvatar('')}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                  >
                    Remove Photo
                  </button>
                )}
              </div>
            </div>

            {/* Editable Name Form */}
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Display Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-[#F4F7FD] text-sm text-slate-900 font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white"
                  />
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </form>

            {/* Account Details Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <h3 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                Account Details
              </h3>

              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Email</span>
                </span>
                <span className="font-semibold text-slate-900 truncate max-w-[200px]">
                  {user.email}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Role</span>
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    user.role === 'admin'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {user.role === 'admin' ? 'Admin' : 'User'}
                </span>
              </div>

              {/* Network Status Row */}
              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isOnline ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-slate-400 ring-2 ring-slate-200'
                    }`}
                  />
                  <span>Connection Status</span>
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${
                    isOnline
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                      : 'bg-slate-100 text-slate-600 border border-slate-300'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>

              {/* Read-only Max Members per Group */}
              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Group Member Limit</span>
                </span>
                <span className="font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-full text-[11px]">
                  {user.maxMembersPerGroup || 10} members
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Member Since</span>
                </span>
                <span className="font-semibold text-slate-900">{formattedDate}</span>
              </div>
            </div>

            {/* Subscription Plan Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/60 border border-blue-200 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-900 flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  <span>Subscription Plan</span>
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  Active
                </span>
              </div>

              <div className="text-slate-700">
                <div className="font-bold text-slate-900 text-sm">
                  {user.plan || (user.role === 'admin' ? 'Admin Plan' : 'Standard Plan')}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Real-time high-urgency alarms, synchronized RSVP tracking, and custom alarm ringtone uploads.
                </div>
              </div>
            </div>

            {/* Google Play Store Packaging Card */}
            {onOpenGooglePlayModal && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white space-y-2.5 shadow-md border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-300 flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Android Distribution</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-400/30">
                    Ready to Pack
                  </span>
                </div>

                <div>
                  <div className="text-xs font-bold text-white">Google Play Store Hub</div>
                  <div className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                    Generate your Android App Bundle (.aab), configure TWA Digital AssetLinks, and follow the publication checklist.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenGooglePlayModal();
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <span>Open Packaging & Publish Guide</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Footer with Logout */}
        <div className="p-6 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={handleLogout}
            className="w-full py-3 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center gap-2 border border-rose-200 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out of Group Alarm</span>
          </button>
        </div>
      </div>
    </div>
  );
};
