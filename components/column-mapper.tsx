'use client';

import { useState } from 'react';

export interface ColumnMapping {
  [csvColumn: string]: string | null;
}

interface ColumnMapperProps {
  csvColumns: string[];
  availableFields: { value: string; label: string }[];
  initialMapping?: ColumnMapping;
  onMappingChange: (mapping: ColumnMapping) => void;
}

export function ColumnMapper({
  csvColumns,
  availableFields,
  initialMapping = {},
  onMappingChange,
}: ColumnMapperProps) {
  const [mapping, setMapping] = useState<ColumnMapping>(initialMapping);

  const handleFieldChange = (csvColumn: string, field: string | null) => {
    const newMapping = { ...mapping, [csvColumn]: field };
    setMapping(newMapping);
    onMappingChange(newMapping);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Map CSV Columns to Fields</h3>
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                CSV Column
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Map To Field
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {csvColumns.map((column) => (
              <tr key={column}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {column}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    value={mapping[column] || ''}
                    onChange={(e) => handleFieldChange(column, e.target.value || null)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base text-gray-900 bg-white"
                  >
                    <option value="">-- Skip --</option>
                    {availableFields.map((field) => (
                      <option key={field.value} value={field.value}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


