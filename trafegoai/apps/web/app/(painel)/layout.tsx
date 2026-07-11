'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token, hydrated, setProfile } = useAuthStore();

  useEffect(() => {
    if (!hydrated) return; // aguarda o persist reidratar antes de decidir
    if (!token) {
      router.replace('/login');
      return;
    }
    api
      .get<{ user: { name: string; email: string }; org: { id: string; name: string; plan: string } }>('/auth/me')
      .then((me) => setProfile(me.user, me.org))
      .catch(() => router.replace('/login'));
  }, [hydrated, token, router, setProfile]);

  // Enquanto não hidrata (ou sem token, antes do redirect), evita flash de conteúdo
  if (!hydrated || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted" aria-live="polite">
        Carregando…
      </div>
    );
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className="min-h-screen flex-1 overflow-x-hidden p-6 lg:p-8">{children}</main>
    </div>
  );
}
