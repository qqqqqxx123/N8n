import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-semibold text-gray-900">Ring CRM</h1>
              <div className="flex space-x-6">
                <Link href="/upload" className="text-gray-900 hover:text-blue-600 px-4 py-3 rounded-md text-base font-medium">
                  Upload
                </Link>
                <Link href="/contacts" className="text-gray-900 hover:text-blue-600 px-4 py-3 rounded-md text-base font-medium">
                  Contacts
                </Link>
                <Link href="/campaigns" className="text-gray-900 hover:text-blue-600 px-4 py-3 rounded-md text-base font-medium">
                  Campaigns
                </Link>
                <Link href="/settings" className="text-gray-900 hover:text-blue-600 px-4 py-3 rounded-md text-base font-medium">
                  Settings
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome to Ring CRM</h2>
          <p className="text-gray-600 mb-6">
            Manage your customer contacts, segments, and WhatsApp campaigns.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/upload" className="p-6 border rounded-lg hover:bg-gray-50">
              <h3 className="font-semibold text-gray-900 mb-2">Upload CSV</h3>
              <p className="text-sm text-gray-600">Import customer data from CSV files</p>
            </Link>
            <Link href="/contacts" className="p-6 border rounded-lg hover:bg-gray-50">
              <h3 className="font-semibold text-gray-900 mb-2">View Contacts</h3>
              <p className="text-sm text-gray-600">Browse and manage your contacts</p>
            </Link>
            <Link href="/campaigns" className="p-6 border rounded-lg hover:bg-gray-50">
              <h3 className="font-semibold text-gray-900 mb-2">Campaigns</h3>
              <p className="text-sm text-gray-600">Send WhatsApp campaigns to segments</p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}


