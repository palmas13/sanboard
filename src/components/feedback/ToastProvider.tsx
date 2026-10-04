'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

type ToastTone = 'success' | 'error' | 'info';
interface ToastItem { id: number; message: string; tone: ToastTone; exiting: boolean }
interface ToastContextValue { showToast: (message: string, tone?: ToastTone) => void }

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const dismiss = useCallback((id: number) => {
    setToasts((items) => items.map((item) => item.id === id ? { ...item, exiting: true } : item));
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 280);
  }, []);
  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    const normalized = message.trim();
    if (!normalized) return;
    const id = ++nextId.current;
    setToasts((items) => {
      if (items.some((item) => !item.exiting && item.message === normalized && item.tone === tone)) return items;
      return [...items.filter((item) => !item.exiting).slice(-2), { id, message: normalized, tone, exiting: false }];
    });
    window.setTimeout(() => dismiss(id), 4200);
  }, [dismiss]);
  const value = useMemo(() => ({ showToast }), [showToast]);

  return <ToastContext.Provider value={value}>
    {children}
    <div data-testid="global-toast-region" className="pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-3 z-[120] flex w-[calc(100vw-1.5rem)] max-w-sm flex-col gap-2 sm:left-5 sm:w-full" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? AlertCircle : Info;
        return <div key={toast.id} data-toast-state={toast.exiting ? 'exit' : 'enter'} role={toast.tone === 'error' ? 'alert' : 'status'} className={`sanboard-toast pointer-events-auto flex items-start gap-3 rounded-xl border bg-[var(--bg-surface)] p-3.5 text-sm text-[var(--text-main)] shadow-2xl ${toast.tone === 'error' ? 'border-red-400/30' : 'border-[var(--border-app)]'} ${toast.exiting ? 'sanboard-toast-exit' : 'sanboard-toast-enter'}`}>
          <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${toast.tone === 'success' ? 'text-[var(--color-success)]' : toast.tone === 'error' ? 'text-[var(--color-danger)]' : 'text-[#FF8A1F]'}`} />
          <span className="min-w-0 flex-1 leading-5">{toast.message}</span>
          <button type="button" onClick={() => dismiss(toast.id)} aria-label="Bildirimi kapat" className="rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--text-main)]"><X className="h-4 w-4" /></button>
        </div>;
      })}
    </div>
  </ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}