import React, { useState } from 'react';
import { Bell, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginScreen: React.FC = () => {
  const { signInWithGoogle, loading } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      console.error(err);
      setError('Google sign-in popup was cancelled or encountered an error. Please try again.');
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-linear-to-b from-white to-[#F4F7FD]">
      {/* Brand Ring Icon */}
      <div className="w-20 h-20 rounded-full bg-[#DCEAFE] flex items-center justify-center mb-6 shadow-sm">
        <div className="w-10 h-10 rounded-full bg-[#1D4ED8] flex items-center justify-center text-white shadow-xs">
          <Bell className="w-5 h-5 fill-white" />
        </div>
      </div>

      <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
        Group Alarm
      </h2>

      <p className="text-xs text-slate-500 max-w-xs leading-relaxed mb-8">
        Schedules and alarms for your groups — no chat, just what you need to know.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl max-w-xs text-left">
          {error}
        </div>
      )}

      {/* Main Buttons */}
      <div className="w-full max-w-xs space-y-3">
        <button
          onClick={handleGoogleSignIn}
          disabled={signingIn || loading}
          className="w-full py-3.5 px-4 rounded-xl bg-[#1D4ED8] hover:bg-blue-800 active:scale-[0.99] text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-md shadow-blue-800/20 transition-all cursor-pointer disabled:opacity-60"
        >
          <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
            <path d="M12.24 10.285V13.8h6.887C18.2 16.037 15.65 17.6 12.24 17.6c-3.635 0-6.6-2.965-6.6-6.6s2.965-6.6 6.6-6.6c1.65 0 3.15.615 4.3 1.63l2.67-2.67C17.47 1.745 15.02.8 12.24.8 6.03.8 1 5.83 1 12.04s5.03 11.24 11.24 11.24c6.48 0 10.77-4.55 10.77-10.96 0-.74-.08-1.46-.22-2.035H12.24z" />
          </svg>
          <span>{signingIn ? 'Connecting...' : 'Continue with Google'}</span>
        </button>

        <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5 pt-2">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          <span>Authenticated securely via Firebase</span>
        </p>
      </div>
    </div>
  );
};
