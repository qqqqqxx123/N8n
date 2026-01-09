'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { WhatsAppIcon } from './whatsapp-icon';
import { useState, useEffect } from 'react';

interface User {
  id: string;
  username: string;
  full_name?: string;
  email?: string;
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    try {
      const response = await fetch('/api/auth/session');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      }
    } catch (err) {
      console.error('Error checking session:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Error logging out:', err);
    }
  }

  function isActive(path: string) {
    return pathname === path;
  }

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-2xl font-semibold text-gray-900">
              Ring CRM
            </Link>
            <div className="flex space-x-6">
              <Link
                href="/upload"
                className={`px-4 py-3 rounded-md text-base font-medium transition-colors ${
                  isActive('/upload')
                    ? 'text-blue-600'
                    : 'text-gray-900 hover:text-blue-600'
                }`}
              >
                Upload
              </Link>
              <Link
                href="/contacts"
                className={`px-4 py-3 rounded-md text-base font-medium transition-colors ${
                  isActive('/contacts')
                    ? 'text-blue-600'
                    : 'text-gray-900 hover:text-blue-600'
                }`}
              >
                Contacts
              </Link>
              <Link
                href="/campaigns"
                className={`px-4 py-3 rounded-md text-base font-medium transition-colors ${
                  isActive('/campaigns')
                    ? 'text-blue-600'
                    : 'text-gray-900 hover:text-blue-600'
                }`}
              >
                Campaigns
              </Link>
              <Link
                href="/connect-whatsapp"
                className={`px-4 py-3 rounded-md text-base font-medium transition-colors ${
                  isActive('/connect-whatsapp')
                    ? 'text-blue-600'
                    : 'text-gray-900 hover:text-blue-600'
                }`}
              >
                Connect WhatsApp
              </Link>
              <Link
                href="/whatsapp-templates"
                className={`px-4 py-3 rounded-md text-base font-medium transition-colors ${
                  isActive('/whatsapp-templates')
                    ? 'text-blue-600'
                    : 'text-gray-900 hover:text-blue-600'
                }`}
              >
                WhatsApp Templates
              </Link>
              <Link
                href="/settings"
                className={`px-4 py-3 rounded-md text-base font-medium transition-colors ${
                  isActive('/settings')
                    ? 'text-blue-600'
                    : 'text-gray-900 hover:text-blue-600'
                }`}
              >
                Settings
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {!isLoading && user && (
              <>
                <span className="text-sm text-gray-700">
                  {user.full_name || user.username}
                </span>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  Logout
                </button>
              </>
            )}
            <WhatsAppIcon />
          </div>
        </div>
      </div>
    </nav>
  );
}

