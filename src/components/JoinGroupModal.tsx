import React, { useState } from 'react';
import { X, KeyRound, AlertCircle } from 'lucide-react';
import { AppUser, Group } from '../types';
import { joinGroupByCode } from '../services/groupService';

interface JoinGroupModalProps {
  currentUser: AppUser;
  isOpen: boolean;
  onClose: () => void;
  onJoined: (group: Group) => void;
}

export const JoinGroupModal: React.FC<JoinGroupModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onJoined,
}) => {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Please enter a 6-character invite code');
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const group = await joinGroupByCode(code, currentUser);
      onJoined(group);
      onClose();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to join group with this code.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        <div className="bg-[#1D4ED8] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-blue-200" />
            <h2 className="text-base font-bold">Join Group by Code</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-slate-800">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              6-Character Invite Code
            </label>
            <input
              type="text"
              maxLength={10}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. 7X8K2M"
              className="w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-[#F4F7FD] text-lg text-center tracking-widest font-mono font-bold text-blue-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white uppercase"
            />
            <p className="text-[11px] text-slate-500 mt-1.5 text-center">
              Ask your group admin or fellowship leader for the invite code.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting || !code.trim()}
              className="w-full py-3.5 px-4 rounded-xl bg-[#1D4ED8] hover:bg-blue-800 text-white font-bold text-sm shadow-md shadow-blue-800/20 transition-all cursor-pointer disabled:opacity-60"
            >
              {submitting ? 'Joining...' : 'Join Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
