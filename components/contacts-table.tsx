'use client';

import Link from 'next/link';
import { Contact } from '@/lib/types/database';
import { formatDOBForDisplay } from '@/lib/utils/dob';

interface ContactWithScore extends Contact {
  score?: number | null;
  segment?: string | null;
}

type SortField = 'name' | 'tags' | 'total_spend' | 'score' | null;
type SortDirection = 'asc' | 'desc';

interface ContactsTableProps {
  contacts: ContactWithScore[];
  isLoading?: boolean;
  selectedContactIds?: Set<string>;
  onSelectionChange?: (selectedIds: Set<string>) => void;
  sortField?: SortField;
  sortDirection?: SortDirection;
  onSort?: (field: SortField) => void;
}

export function ContactsTable({ 
  contacts, 
  isLoading = false,
  selectedContactIds = new Set(),
  onSelectionChange,
  sortField = null,
  sortDirection = 'asc',
  onSort
}: ContactsTableProps) {
  function handleCheckboxChange(contactId: string, checked: boolean) {
    if (!onSelectionChange) return;
    
    const newSelection = new Set(selectedContactIds);
    if (checked) {
      newSelection.add(contactId);
    } else {
      newSelection.delete(contactId);
    }
    onSelectionChange(newSelection);
  }
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-600">Loading contacts...</p>
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-600">No contacts found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {onSelectionChange && (
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                <input
                  type="checkbox"
                  checked={contacts.length > 0 && selectedContactIds.size === contacts.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onSelectionChange(new Set(contacts.map(c => c.id)));
                    } else {
                      onSelectionChange(new Set());
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
            )}
            <th 
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onClick={() => onSort?.('name')}
            >
              <div className="flex items-center gap-1">
                Name
                {sortField === 'name' && (
                  <span className="text-gray-400">
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </div>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Phone
            </th>
            <th 
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onClick={() => onSort?.('tags')}
            >
              <div className="flex items-center gap-1">
                Tags
                {sortField === 'tags' && (
                  <span className="text-gray-400">
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </div>
            </th>
            <th 
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onClick={() => onSort?.('total_spend')}
            >
              <div className="flex items-center gap-1">
                Total Spend
                {sortField === 'total_spend' && (
                  <span className="text-gray-400">
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </div>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              DOB
            </th>
            <th 
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onClick={() => onSort?.('score')}
            >
              <div className="flex items-center gap-1">
                Score
                {sortField === 'score' && (
                  <span className="text-gray-400">
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </div>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {contacts.map((contact) => (
            <tr key={contact.id} className="hover:bg-gray-50">
              {onSelectionChange && (
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedContactIds.has(contact.id)}
                    onChange={(e) => handleCheckboxChange(contact.id, e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
              )}
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {contact.full_name || 'N/A'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {contact.phone_e164}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex flex-wrap gap-1">
                  {contact.tags.map((tag) => {
                    const tagLower = tag.toLowerCase();
                    let tagClasses = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ';
                    
                    if (tagLower === 'vip') {
                      tagClasses += 'bg-yellow-100 text-yellow-800';
                    } else if (tagLower === 'regular') {
                      tagClasses += 'bg-blue-100 text-blue-800';
                    } else if (tagLower === 'new') {
                      tagClasses += 'bg-red-100 text-red-800';
                    } else {
                      // Default blue for other tags
                      tagClasses += 'bg-blue-100 text-blue-800';
                    }
                    
                    return (
                      <span key={tag} className={tagClasses}>
                        {tag}
                      </span>
                    );
                  })}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${Number(contact.total_spend).toLocaleString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatDOBForDisplay(contact.DOB)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {contact.score !== null && contact.score !== undefined ? (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{contact.score}</span>
                    {contact.segment && (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          contact.segment === 'hot'
                            ? 'bg-red-100 text-red-800'
                            : contact.segment === 'warm'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {contact.segment.toUpperCase()}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <Link
                  href={`/contacts/${contact.id}`}
                  className="text-blue-600 hover:text-blue-900"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


