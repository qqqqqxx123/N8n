'use client';

import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { CsvUploader } from '@/components/csv-uploader';
import { ColumnMapper, ColumnMapping } from '@/components/column-mapper';
import { Navbar } from '@/components/navbar';
import { normalizePhoneToE164 } from '@/lib/utils/phone';

interface CsvRow {
  [key: string]: string;
}

const AVAILABLE_FIELDS = [
  { value: 'full_name', label: 'Full Name' },
  { value: 'phone_e164', label: 'Phone (E.164)' },
  { value: 'source', label: 'Source' },
  { value: 'tags', label: 'Tags (comma-separated)' },
  { value: 'dob', label: 'Date of Birth (DOB)' },
  { value: 'opt_in_status', label: 'Opt-In Status' },
  { value: 'opt_in_timestamp', label: 'Opt-In Timestamp' },
  { value: 'opt_in_source', label: 'Opt-In Source' },
  { value: 'last_purchase_at', label: 'Last Purchase At' },
  { value: 'total_spend', label: 'Total Spend' },
  { value: 'interest_type', label: 'Interest Type' },
];

export default function UploadPage() {
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [previewRows, setPreviewRows] = useState<CsvRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<number, string[]>>({});

  const handleFileSelect = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setValidationErrors({});

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setError(`CSV parsing errors: ${results.errors.map(e => e.message).join(', ')}`);
          setIsLoading(false);
          return;
        }

        const data = results.data as CsvRow[];
        if (data.length === 0) {
          setError('CSV file is empty');
          setIsLoading(false);
          return;
        }

        const columns = Object.keys(data[0]);
        setCsvColumns(columns);
        setCsvData(data);
        setPreviewRows(data.slice(0, 10));

        // Auto-map common column names
        const autoMapping: ColumnMapping = {};
        columns.forEach((col) => {
          const lowerCol = col.toLowerCase();
          if (lowerCol.includes('name') || lowerCol.includes('full')) {
            autoMapping[col] = 'full_name';
          } else if (lowerCol.includes('phone') || lowerCol.includes('mobile') || lowerCol.includes('tel')) {
            autoMapping[col] = 'phone_e164';
          } else if (lowerCol.includes('source') || lowerCol.includes('origin')) {
            autoMapping[col] = 'source';
          } else if (lowerCol.includes('tag')) {
            autoMapping[col] = 'tags';
          } else if (lowerCol.includes('spend') || lowerCol.includes('total')) {
            autoMapping[col] = 'total_spend';
          } else if (lowerCol.includes('interest')) {
            autoMapping[col] = 'interest_type';
          } else if (lowerCol.includes('dob') || lowerCol.includes('birth') || lowerCol.includes('date of birth')) {
            autoMapping[col] = 'dob';
          } else if (lowerCol.includes('last_purchase') || lowerCol.includes('last purchase') || (lowerCol.includes('purchase') && lowerCol.includes('date'))) {
            autoMapping[col] = 'last_purchase_at';
          }
        });
        setMapping(autoMapping);

        setIsLoading(false);
      },
      error: (error) => {
        setError(`Failed to parse CSV: ${error.message}`);
        setIsLoading(false);
      },
    });
  }, []);

  const validateMapping = useCallback((data: CsvRow[], mapping: ColumnMapping): Record<number, string[]> => {
    const errors: Record<number, string[]> = {};

    data.forEach((row, index) => {
      const rowErrors: string[] = [];

      // Phone is required
      const phoneColumn = Object.keys(mapping).find(col => mapping[col] === 'phone_e164');
      if (!phoneColumn) {
        rowErrors.push('Phone column must be mapped');
      } else {
        const phone = row[phoneColumn];
        if (!phone) {
          rowErrors.push('Phone is required');
        } else {
          // Try normalization with Hong Kong country code (852)
          const normalized = normalizePhoneToE164(phone) || normalizePhoneToE164(phone, '852');
          if (!normalized) {
            rowErrors.push(`Invalid phone format: ${phone}`);
          }
        }
      }

      // Validate opt_in_status if mapped
      const optInColumn = Object.keys(mapping).find(col => mapping[col] === 'opt_in_status');
      if (optInColumn && row[optInColumn]) {
        const optInValue = row[optInColumn].toLowerCase().trim();
        if (!['true', 'false', 'yes', 'no', '1', '0'].includes(optInValue)) {
          rowErrors.push(`Invalid opt-in status: ${row[optInColumn]}`);
        }
      }

      // Validate total_spend if mapped
      const spendColumn = Object.keys(mapping).find(col => mapping[col] === 'total_spend');
      if (spendColumn && row[spendColumn]) {
        const spend = parseFloat(row[spendColumn]);
        if (isNaN(spend) || spend < 0) {
          rowErrors.push(`Invalid total spend: ${row[spendColumn]}`);
        }
      }

      if (rowErrors.length > 0) {
        errors[index] = rowErrors;
      }
    });

    return errors;
  }, []);

  const handleMappingChange = useCallback((newMapping: ColumnMapping) => {
    setMapping(newMapping);
    const errors = validateMapping(csvData, newMapping);
    setValidationErrors(errors);
  }, [csvData, validateMapping]);

  const handleImport = useCallback(async () => {
    if (!csvData.length) {
      setError('No CSV data to import');
      return;
    }

    // Check if phone is mapped
    const phoneColumn = Object.keys(mapping).find(col => mapping[col] === 'phone_e164');
    if (!phoneColumn) {
      setError('Phone column must be mapped');
      return;
    }

    // Validate all rows
    const errors = validateMapping(csvData, mapping);
    if (Object.keys(errors).length > 0) {
      setError('Please fix validation errors before importing');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Transform data according to mapping
      const mappedRows = csvData.map((row) => {
        const mapped: Record<string, any> = {};
        Object.entries(mapping).forEach(([csvCol, field]) => {
          if (field && row[csvCol]) {
            let value: any = row[csvCol].trim();

            // Transform values based on field type
            if (field === 'phone_e164') {
              // Try with Hong Kong country code (852) if normalization fails
              value = normalizePhoneToE164(value) || normalizePhoneToE164(value, '852');
              if (!value) {
                throw new Error(`Failed to normalize phone: ${row[csvCol]}`);
              }
            } else if (field === 'dob') {
              // Keep DOB as string (date format) - will be validated on server
              value = value.trim();
            } else if (field === 'opt_in_status') {
              const lower = value.toLowerCase().trim();
              value = ['true', 'yes', '1'].includes(lower);
            } else if (field === 'total_spend') {
              value = parseFloat(value) || 0;
            } else if (field === 'tags') {
              value = value.split(',').map((t: string) => t.trim()).filter(Boolean);
            }

            mapped[field] = value;
          }
        });
        return mapped;
      });

      const response = await fetch('/api/csv/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: mappedRows }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Import failed');
      }

      setSuccess(`Successfully imported ${result.counts.imported} contacts. ${result.counts.duplicates} duplicates skipped.`);
      
      // Reset form
      setCsvData([]);
      setCsvColumns([]);
      setMapping({});
      setPreviewRows([]);
      setValidationErrors({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import CSV');
    } finally {
      setIsLoading(false);
    }
  }, [csvData, mapping, validateMapping]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Upload CSV</h2>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          {csvData.length === 0 ? (
            <CsvUploader onFileSelect={handleFileSelect} isLoading={isLoading} />
          ) : (
            <div className="space-y-6">
              <ColumnMapper
                csvColumns={csvColumns}
                availableFields={AVAILABLE_FIELDS}
                initialMapping={mapping}
                onMappingChange={handleMappingChange}
              />

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Preview (First 10 Rows)</h3>
                <div className="bg-white border rounded-lg overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {csvColumns.map((col) => (
                          <th
                            key={col}
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {previewRows.map((row, rowIndex) => (
                        <tr
                          key={rowIndex}
                          className={validationErrors[rowIndex] ? 'bg-red-50' : ''}
                        >
                          {csvColumns.map((col) => (
                            <td key={col} className="px-4 py-3 text-sm text-gray-900">
                              {row[col] || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {Object.keys(validationErrors).length > 0 && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm font-semibold text-red-800 mb-2">Validation Errors:</p>
                    <ul className="list-disc list-inside text-sm text-red-700">
                      {Object.entries(validationErrors).map(([rowIndex, errors]) => (
                        <li key={rowIndex}>
                          Row {Number(rowIndex) + 1}: {errors.join(', ')}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={handleImport}
                  disabled={isLoading || Object.keys(validationErrors).length > 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Importing...' : 'Import CSV'}
                </button>
                <button
                  onClick={() => {
                    setCsvData([]);
                    setCsvColumns([]);
                    setMapping({});
                    setPreviewRows([]);
                    setValidationErrors({});
                    setError(null);
                    setSuccess(null);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                >
                  Reset
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}


