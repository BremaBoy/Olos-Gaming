'use client';

import { useAuth } from "@/context/AuthContext";
import UsernameModal from '@/components/UsernameModal';

export function GlobalAuthHandler() {
  const { needsUsername, completeUsername } = useAuth();

  if (!needsUsername) return null;

  return <UsernameModal onComplete={completeUsername} />;
}
