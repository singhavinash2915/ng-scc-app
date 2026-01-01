import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { ContactBar } from './ContactBar';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Contact bar at top - visible on mobile/tablet */}
      <div className="lg:hidden">
        <ContactBar />
      </div>
      <Sidebar />
      <div className="lg:pl-64">
        <main className="min-h-screen pb-20 lg:pb-0">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
