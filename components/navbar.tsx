'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WhatsAppIcon } from './whatsapp-icon';

export function Navbar() {
  const pathname = usePathname();

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
          <div className="flex items-center">
            <WhatsAppIcon />
          </div>
        </div>
      </div>
    </nav>
  );
}

