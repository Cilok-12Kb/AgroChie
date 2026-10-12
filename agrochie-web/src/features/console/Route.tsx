'use client';
import { useConsole } from './context';
import { ConsoleRoute, type Section } from './Pages';
export function Route({ section }: { section: Section }) {
  const workspace = useConsole();
  return <ConsoleRoute section={section} w={workspace}/>;
}
