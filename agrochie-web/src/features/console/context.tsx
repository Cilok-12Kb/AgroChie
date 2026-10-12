'use client';
import { createContext, useContext } from 'react';
import type { Workspace } from './hooks';
export const WorkspaceContext = createContext<Workspace | null>(null);
export function useConsole(): Workspace {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('WorkspaceContext is required');
  return ctx;
}
