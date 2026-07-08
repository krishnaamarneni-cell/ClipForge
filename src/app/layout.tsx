'use client';

import { useEffect, useState } from 'react';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Plus,
  Film,
  Settings,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeft,
  Menu,
  X,
  Clapperboard,
} from 'lucide-react';
import { useClipForgeStore } from '@/store';
import { cn } from '@/lib/utils';
import { ToastContainer } from '@/components/ui/toast';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/new', label: 'New Project', icon: Plus },
  { href: '/queue', label: 'Render Queue', icon: Film },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const {
    darkMode,
    toggleDarkMode,
    sidebarCollapsed,
    toggleSidebar,
    mobileMenuOpen,
    setMobileMenuOpen,
  } = useClipForgeStore();

  useEffect(() => {
    setMounted(true);
    if (window.matchMedia('(prefers-color-scheme: dark)').matches && !darkMode) {
      toggleDarkMode();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname, setMobileMenuOpen]);

  return (
    <html lang="en" className={cn(inter.variable, mounted && darkMode && 'dark')} suppressHydrationWarning>
      <body className="font-sans antialiased bg-[var(--bg-primary)] text-[var(--text-primary)]" suppressHydrationWarning>
        {/* Mobile header */}
        <header className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-4 h-14 bg-surface-dark-0 text-white md:hidden">
          <div className="flex items-center gap-2">
            <Clapperboard className="h-5 w-5 text-brand-400" />
            <span className="text-sm font-semibold tracking-tight">
              ClipForge
            </span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </header>

        {/* Mobile slide-over nav */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
        <nav
          className={cn(
            'fixed top-14 bottom-0 left-0 z-40 w-64 bg-surface-dark-0 text-white transition-transform duration-300 md:hidden',
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex flex-col gap-1 p-3 pt-4">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active =
                href === '/' ? pathname === '/' : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                    active
                      ? 'bg-brand-600 text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </div>
          <div className="absolute bottom-4 inset-x-0 px-3">
            <button
              onClick={toggleDarkMode}
              className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            >
              {mounted && darkMode ? (
                <Sun className="h-5 w-5 shrink-0" />
              ) : (
                <Moon className="h-5 w-5 shrink-0" />
              )}
              {mounted && darkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
          </div>
        </nav>

        {/* Desktop sidebar */}
        <aside
          className={cn(
            'fixed top-0 left-0 bottom-0 z-30 hidden md:flex flex-col bg-surface-dark-0 text-white transition-all duration-300',
            sidebarCollapsed ? 'w-[68px]' : 'w-56'
          )}
        >
          {/* Logo */}
          <div
            className={cn(
              'flex items-center h-14 px-4 border-b border-white/10 shrink-0',
              sidebarCollapsed ? 'justify-center' : 'gap-2.5'
            )}
          >
            <Clapperboard className="h-6 w-6 text-brand-400 shrink-0" />
            {!sidebarCollapsed && (
              <span className="text-base font-bold tracking-tight">
                ClipForge
              </span>
            )}
          </div>

          {/* Nav links */}
          <nav className="flex-1 flex flex-col gap-1 p-2 pt-3">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active =
                href === '/' ? pathname === '/' : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  title={sidebarCollapsed ? label : undefined}
                  className={cn(
                    'flex items-center rounded-xl text-sm font-medium transition-colors',
                    sidebarCollapsed
                      ? 'justify-center px-0 py-2.5'
                      : 'gap-3 px-3 py-2.5',
                    active
                      ? 'bg-brand-600 text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!sidebarCollapsed && label}
                </Link>
              );
            })}
          </nav>

          {/* Bottom controls */}
          <div className="flex flex-col gap-1 p-2 border-t border-white/10">
            <button
              onClick={toggleDarkMode}
              title={darkMode ? 'Light Mode' : 'Dark Mode'}
              className={cn(
                'flex items-center rounded-xl text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors',
                sidebarCollapsed
                  ? 'justify-center px-0 py-2.5'
                  : 'gap-3 px-3 py-2.5'
              )}
            >
              {darkMode ? (
                <Sun className="h-5 w-5 shrink-0" />
              ) : (
                <Moon className="h-5 w-5 shrink-0" />
              )}
              {!sidebarCollapsed && (darkMode ? 'Light Mode' : 'Dark Mode')}
            </button>
            <button
              onClick={toggleSidebar}
              title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              className={cn(
                'flex items-center rounded-xl text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors',
                sidebarCollapsed
                  ? 'justify-center px-0 py-2.5'
                  : 'gap-3 px-3 py-2.5'
              )}
            >
              {mounted && sidebarCollapsed ? (
                <PanelLeft className="h-5 w-5 shrink-0" />
              ) : (
                <PanelLeftClose className="h-5 w-5 shrink-0" />
              )}
              {!sidebarCollapsed && 'Collapse'}
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main
          className={cn(
            'min-h-screen transition-all duration-300',
            'pt-14 md:pt-0',
            sidebarCollapsed ? 'md:pl-[68px]' : 'md:pl-56'
          )}
        >
          <div className="p-4 md:p-6 lg:p-8">{children}</div>
        </main>
        <ToastContainer />
      </body>
    </html>
  );
}
