import { Sidebar } from './Sidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { TopBar } from './TopBar';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[--background]">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Mobile Top Bar */}
      <TopBar />

      {/* Main Content */}
      <main
        className="lg:ml-64 min-h-screen pb-20 lg:pb-0"
        id="main-content"
      >
        <div className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-6 lg:py-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <MobileBottomNav />
    </div>
  );
}
