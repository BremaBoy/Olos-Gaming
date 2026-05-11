'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface UsernameModalProps {
  onComplete: (username: string) => void;
}

export default function UsernameModal({ onComplete }: UsernameModalProps) {
  const { user } = useAuth();
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = username.trim().length >= 3 && /^[a-zA-Z0-9_]+$/.test(username.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !user?.id) return;

    setIsLoading(true);
    setError(null);

    const trimmed = username.trim().toLowerCase();

    // Check if username is already taken
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', trimmed)
      .maybeSingle();

    if (existing) {
      setError('That username is already taken. Please try another.');
      setIsLoading(false);
      return;
    }

    // Update the profile in Supabase
    const { error: updateError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        username: trimmed,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (updateError) {
      setError(updateError.message || 'Failed to save username. Please try again.');
      setIsLoading(false);
      return;
    }

    onComplete(trimmed);
  };

  return (
    // Backdrop
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-black/70 backdrop-blur-md animate-fade-in">
      {/* Modal Card */}
      <div className="w-full max-w-[440px] bg-[#0B1121] border border-white/10 rounded-[32px] p-8 flex flex-col items-center gap-6 shadow-2xl shadow-black/60 animate-fade-in">

        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-[#3B82F6]/10 border border-[#3B82F6]/20 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>

        {/* Header */}
        <div className="text-center">
          <h2 className="text-2xl font-black text-white tracking-tight mb-2">
            Pick your username
          </h2>
          <p className="text-sm text-gray-400 font-medium leading-relaxed">
            This is how other players will see you on the leaderboard and in matches.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-bold">
              {error}
            </div>
          )}

          <div className="relative">
            {/* @ prefix */}
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm select-none">
              @
            </span>
            <input
              id="modal-username-input"
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError(null);
              }}
              placeholder="your_username"
              autoFocus
              autoComplete="off"
              maxLength={20}
              disabled={isLoading}
              className="w-full h-12 pl-8 pr-4 bg-black/50 border border-[#3B82F6]/20 focus:border-[#3B82F6] rounded-xl text-sm text-white font-bold placeholder:text-gray-600 focus:outline-none transition-all disabled:opacity-50"
            />
          </div>

          {/* Validation hints */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-1">
            <Hint met={username.length >= 3} label="3+ characters" />
            <Hint met={/^[a-zA-Z0-9_]*$/.test(username) && username.length > 0} label="Letters, numbers & _" />
            <Hint met={username.length <= 20} label="Max 20 chars" />
          </div>

          <button
            type="submit"
            id="username-modal-submit-btn"
            disabled={!isValid || isLoading}
            className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-bold rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              'Set Username'
            )}
          </button>
        </form>

        <p className="text-[11px] text-gray-600 font-bold text-center">
          You can update your username later in your profile settings.
        </p>
      </div>
    </div>
  );
}

function Hint({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-1 h-1 rounded-full transition-colors ${met ? 'bg-[#3B82F6]' : 'bg-white/10'}`} />
      <span className={`text-[9px] font-bold uppercase tracking-widest transition-colors ${met ? 'text-[#3B82F6]' : 'text-gray-600'}`}>
        {label}
      </span>
    </div>
  );
}
