'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ContactsTable } from '@/components/contacts-table';
import { Navbar } from '@/components/navbar';
import { Contact } from '@/lib/types/database';

interface MetaTemplate {
  id: string;
  waba_id: string;
  name: string;
  language: string;
  category: string | null;
  status: string;
  components: Array<{
    type: string;
    text?: string;
    format?: string;
    image_url?: string;
    image_data?: string;
    images?: string[]; // Array of image URLs for BODY component
    example?: {
      header_handle?: string[];
      header_text?: string[];
      body_text?: string[][];
    };
    buttons?: Array<{
      type: string;
      text: string;
      url?: string;
      phone_number?: string;
    }>;
  }>;
  variable_count: number;
  image1?: string;
  image2?: string;
  image3?: string;
  image4?: string;
  image5?: string;
  image6?: string;
  image7?: string;
  image8?: string;
  button1_text?: string;
  button1_type?: string;
  button1_url?: string;
  button1_phone?: string;
  button2_text?: string;
  button2_type?: string;
  button2_url?: string;
  button2_phone?: string;
}

interface FilterState {
  minScore?: number;
  purchaseMode: 'any' | 'never' | 'within' | 'olderThan';
  purchaseDays?: number;
  birthdayEnabled: boolean;
  birthdayWithinDays?: number;
  spendMin?: number;
  spendMax?: number;
  interestTypes: string[];
}

interface PreviewCounts {
  segmentTotal: number;
  afterFilters: number;
  sendable: number;
}

export default function CampaignsPage() {
  const [selectedSegment, setSelectedSegment] = useState<'hot' | 'warm' | 'cold'>('hot');
  const [selectedTemplate, setSelectedTemplate] = useState<MetaTemplate | null>(null);
  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [templateVariables, setTemplateVariables] = useState<string[]>([]);
  const [isManualMessage, setIsManualMessage] = useState(false);
  const [manualMessage, setManualMessage] = useState('');
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewCounts, setPreviewCounts] = useState<PreviewCounts | null>(null);
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmCounts, setConfirmCounts] = useState<PreviewCounts | null>(null);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false);
  // Store selections per segment: { hot: Set<string>, warm: Set<string>, cold: Set<string> }
  const [selectedContactIdsBySegment, setSelectedContactIdsBySegment] = useState<Record<'hot' | 'warm' | 'cold', Set<string>>>({
    hot: new Set(),
    warm: new Set(),
    cold: new Set(),
  });

  // Get selections for current segment
  const selectedContactIds = selectedContactIdsBySegment[selectedSegment];

  // Update selections for current segment - use useCallback to ensure we capture the latest segment
  const setSelectedContactIds = useCallback((newSelection: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    setSelectedContactIdsBySegment(prev => {
      // Use selectedSegment from state, but we need to ensure it's current
      // Since we're in the component body, selectedSegment is from current render
      const currentSegment = selectedSegment;
      const currentSelection = prev[currentSegment] || new Set();
      const updatedSelection = typeof newSelection === 'function' 
        ? newSelection(currentSelection) 
        : newSelection;
      
      return {
        ...prev,
        [currentSegment]: updatedSelection,
      };
    });
  }, [selectedSegment]);

  const [filters, setFilters] = useState<FilterState>({
    purchaseMode: 'any',
    birthdayEnabled: false,
    interestTypes: [],
  });

  // Helper function to safely parse JSON responses
  async function safeJsonParse(response: Response): Promise<any> {
    const text = await response.text();
    if (!text) {
      throw new Error('Empty response from server');
    }
    try {
      return JSON.parse(text);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Response status:', response.status);
      console.error('Response text:', text);
      throw new Error('Invalid JSON response from server');
    }
  }

  const fetchTemplates = useCallback(async () => {
    setIsLoadingTemplates(true);
    try {
      // Fetch both Meta templates and custom templates
      const response = await fetch('/api/whatsapp/templates?status=APPROVED');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      } else {
        console.error('Failed to fetch templates');
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
    } finally {
      setIsLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    // Reset filters and fetch counts when segment changes
    const resetFilters = {
      purchaseMode: 'any' as const,
      birthdayEnabled: false,
      interestTypes: [] as string[],
    };
    setFilters(resetFilters);
    setError(null);
    // Don't clear selections when segment changes - preserve them
    setIsManualMessage(false);
    setManualMessage('');
    setSelectedTemplate(null);
    setTemplateVariables([]);
    
    // Fetch counts and contacts with empty filters after reset
    const fetchData = async () => {
      setIsLoadingCounts(true);
      setIsLoadingContacts(true);
      setError(null);
      try {
        // Fetch counts
        const countsResponse = await fetch('/api/campaigns/eligible-count', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            segment: selectedSegment,
            filters: {}, // Empty filters after reset
          }),
        });

        if (countsResponse.ok) {
          const countsData = await countsResponse.json();
          setPreviewCounts({
            segmentTotal: countsData.segmentTotal || 0,
            afterFilters: countsData.afterFilters || 0,
            sendable: countsData.sendable || 0,
          });
          
          if (countsData.segmentTotal === 0) {
            setError('No contacts found in this segment. Make sure scores have been computed. Go to Contacts page to compute scores.');
          } else if (countsData.sendable === 0 && countsData.segmentTotal > 0) {
            setError('Contacts found but none are sendable after applying filters. Try adjusting your filters.');
          }
        } else {
          const errorData = await countsResponse.json();
          setError(errorData.error || 'Failed to fetch contact counts');
        }

        // Fetch filtered contacts
        const contactsResponse = await fetch('/api/campaigns/filtered-contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            segment: selectedSegment,
            filters: {}, // Empty filters after reset
          }),
        });

        if (contactsResponse.ok) {
          const contactsData = await contactsResponse.json();
          setFilteredContacts(contactsData.contacts || []);
          setFiltersApplied(true);
        } else {
          const errorData = await contactsResponse.json();
          setError(errorData.error || 'Failed to fetch filtered contacts');
          setFilteredContacts([]);
          setFiltersApplied(false);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to fetch data. Please try again.');
        setFilteredContacts([]);
        setFiltersApplied(false);
      } finally {
        setIsLoadingCounts(false);
        setIsLoadingContacts(false);
      }
    };
    
    fetchData();
  }, [selectedSegment]);

  function extractVariablesFromTemplate(template: MetaTemplate): string[] {
    if (!template.components || template.variable_count === 0) {
      return [];
    }

    // Initialize array with empty strings for each variable
    const vars: string[] = [];
    for (let i = 1; i <= template.variable_count; i++) {
      vars.push('');
    }
    return vars;
  }

  function handleTemplateChange(templateName: string) {
    if (templateName === 'ManuallyMessage') {
      setIsManualMessage(true);
      setSelectedTemplate(null);
      setTemplateVariables([]);
    } else {
      setIsManualMessage(false);
      setManualMessage('');
      const template = templates.find(t => `${t.name}_${t.language}` === templateName);
      if (template) {
        setSelectedTemplate(template);
        const vars = extractVariablesFromTemplate(template);
        setTemplateVariables(vars);
      } else {
        setSelectedTemplate(null);
        setTemplateVariables([]);
      }
    }
  }

  async function fetchPreviewCounts() {
    setIsLoadingCounts(true);
    setError(null);
    try {
      const response = await fetch('/api/campaigns/eligible-count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segment: selectedSegment,
          filters: buildFiltersPayload(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setPreviewCounts({
          segmentTotal: data.segmentTotal || 0,
          afterFilters: data.afterFilters || 0,
          sendable: data.sendable || 0,
        });
        
        // Show helpful message if no contacts found
        if (data.segmentTotal === 0) {
          setError('No contacts found in this segment. Make sure scores have been computed. Go to Contacts page to compute scores.');
        } else if (data.sendable === 0 && data.segmentTotal > 0) {
          setError('Contacts found but none are sendable after applying filters. Try adjusting your filters.');
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch contact counts');
      }
    } catch (err) {
      console.error('Error fetching preview counts:', err);
      setError('Failed to fetch contact counts. Please try again.');
    } finally {
      setIsLoadingCounts(false);
    }
  }

  async function fetchFilteredContacts() {
    setIsLoadingContacts(true);
    setError(null);
    try {
      const response = await fetch('/api/campaigns/filtered-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segment: selectedSegment,
          filters: buildFiltersPayload(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setFilteredContacts(data.contacts || []);
        setFiltersApplied(true);
        // Don't reset selection when new contacts are loaded - preserve existing selections
        // Also update preview counts
        await fetchPreviewCounts();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch filtered contacts');
      }
    } catch (err) {
      setError('Failed to fetch filtered contacts');
      console.error('Error fetching filtered contacts:', err);
    } finally {
      setIsLoadingContacts(false);
    }
  }

  function buildFiltersPayload() {
    const payload: any = {};
  if (filters.minScore !== undefined && filters.minScore !== null) {
  payload.minScore = filters.minScore;
}

   if (filters.purchaseMode !== 'any') {
  payload.purchaseMode = filters.purchaseMode;

  if (typeof filters.purchaseDays === 'number') {
    payload.purchaseDays = filters.purchaseDays;
  }
}

if (filters.birthdayEnabled && typeof filters.birthdayWithinDays === 'number') {
  payload.birthdayWithinDays = filters.birthdayWithinDays;
}

if (typeof filters.spendMin === 'number') {
  payload.spendMin = filters.spendMin;
}

if (typeof filters.spendMax === 'number') {
  payload.spendMax = filters.spendMax;
}

if (Array.isArray(filters.interestTypes) && filters.interestTypes.length > 0) {
  payload.interestTypes = filters.interestTypes;
}

return payload;

  }

  function clearFilters() {
    setFilters({
      purchaseMode: 'any',
      birthdayEnabled: false,
      interestTypes: [],
    });
    setFilteredContacts([]);
    setFiltersApplied(false);
    setError(null);
    // Clear selections only for current segment when clearing filters
    setSelectedContactIds(new Set());
    // Refresh preview counts after clearing filters
    fetchPreviewCounts();
  }

  function handleInterestTypeToggle(type: string) {
    setFilters(prev => ({
      ...prev,
      interestTypes: prev.interestTypes.includes(type)
        ? prev.interestTypes.filter(t => t !== type)
        : [...prev.interestTypes, type],
    }));
  }

  async function handleApplyFilters() {
    setError(null);
    await fetchFilteredContacts();
    // Also refresh preview counts after applying filters
    await fetchPreviewCounts();
  }

  async function handleSendCampaign() {
    if (!isManualMessage && !selectedTemplate) {
      setError('Please select a template or choose manual message');
      return;
    }
    if (isManualMessage && !manualMessage.trim()) {
      setError('Please enter a message');
      return;
    }

    // Calculate total selected contacts across all segments
    const totalSelected = selectedContactIdsBySegment.hot.size + 
                         selectedContactIdsBySegment.warm.size + 
                         selectedContactIdsBySegment.cold.size;

    if (totalSelected === 0) {
      setError('Please select at least one contact to send the campaign to.');
      return;
    }

    // Set confirmation counts based on selected contacts
    const counts = {
      segmentTotal: totalSelected,
      afterFilters: totalSelected,
      sendable: totalSelected,
    };
    setConfirmCounts(counts);
    setShowConfirmModal(true);
  }

  async function confirmSendCampaign() {
    setShowConfirmModal(false);
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Collect all selected contact IDs from all segments
      const allSelectedIds = [
        ...Array.from(selectedContactIdsBySegment.hot),
        ...Array.from(selectedContactIdsBySegment.warm),
        ...Array.from(selectedContactIdsBySegment.cold),
      ];

      // Build request body, only including defined values
      const requestBody: any = {
        selected_contact_ids: allSelectedIds,
      };

      if (isManualMessage) {
        requestBody.manual_message = manualMessage;
      } else if (selectedTemplate) {
        requestBody.template_name = selectedTemplate.name;
        requestBody.template_language = selectedTemplate.language;
        if (templateVariables.length > 0) {
          requestBody.template_variables = templateVariables;
        }
      }

      const response = await fetch('/api/campaigns/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await safeJsonParse(response);
        } catch (parseError) {
          // If we can't parse the error response, use a generic message
          throw new Error(`Failed to send campaign (${response.status} ${response.statusText})`);
        }
        console.error('API error response:', errorData);
        
        // Build a more detailed error message
        let errorMessage = errorData.error || 'Failed to send campaign';
        if (errorData.details) {
          if (typeof errorData.details === 'string') {
            errorMessage += `: ${errorData.details}`;
          } else if (Array.isArray(errorData.details)) {
            errorMessage += `: ${errorData.details.map((e: any) => e.message || JSON.stringify(e)).join(', ')}`;
          } else {
            errorMessage += `: ${JSON.stringify(errorData.details)}`;
          }
        }
        
        throw new Error(errorMessage);
      }

      const result = await safeJsonParse(response);
      setSuccess(`Campaign sent successfully to ${result.sent} contacts`);
      setPreviewCounts(null);
      await fetchPreviewCounts();
      await fetchFilteredContacts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send campaign');
    } finally {
      setIsLoading(false);
    }
  }

  const segmentLabel = selectedSegment.charAt(0).toUpperCase() + selectedSegment.slice(1);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Send Campaign</h2>

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

          <div className="space-y-6">
            {/* Filter Section */}
            <div className="border border-gray-200 rounded-lg">
              <button
                onClick={() => setFiltersExpanded(!filtersExpanded)}
                className="w-full px-4 py-3 flex items-center justify-between text-left bg-gray-50 hover:bg-gray-100 rounded-t-lg"
              >
                <span className="text-sm font-medium text-gray-700">Filter</span>
                <span className="text-gray-500">{filtersExpanded ? '−' : '+'}</span>
              </button>
              
              {filtersExpanded && (
                <div className="p-4 space-y-4 border-t border-gray-200">
                  {/* Segment Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Segment
                    </label>
                    <select
                      value={selectedSegment}
                      onChange={(e) => {
                        setSelectedSegment(e.target.value as 'hot' | 'warm' | 'cold');
                      }}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base text-gray-900 bg-white"
                    >
                      <option value="hot">Hot (excludes recent buyers within 60 days)</option>
                      <option value="warm">Warm</option>
                      <option value="cold">Cold</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Hot segment automatically excludes contacts who purchased within the last 60 days
                    </p>
                  </div>

                  {/* Minimum Score */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Minimum Score
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={filters.minScore ?? ''}
                      onChange={(e) => setFilters(prev => ({ 
                        ...prev, 
                        minScore: e.target.value ? parseInt(e.target.value, 10) : undefined 
                      }))}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base text-gray-900"
                      placeholder="e.g., 80"
                    />
                  </div>

                  {/* Purchase Recency */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Purchase Recency
                    </label>
                    <select
                      value={filters.purchaseMode}
                      onChange={(e) => setFilters(prev => ({ 
                        ...prev, 
                        purchaseMode: e.target.value as any,
                        purchaseDays: undefined 
                      }))}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base text-gray-900 bg-white"
                    >
                      <option value="any">Any time</option>
                      <option value="never">Never purchased</option>
                      <option value="within">Purchased within last X days</option>
                      <option value="olderThan">Purchased more than X days ago</option>
                    </select>
                    {(filters.purchaseMode === 'within' || filters.purchaseMode === 'olderThan') && (
                      <input
                        type="number"
                        min="1"
                        value={filters.purchaseDays ?? ''}
                        onChange={(e) => setFilters(prev => ({ 
                          ...prev, 
                          purchaseDays: e.target.value ? parseInt(e.target.value, 10) : undefined 
                        }))}
                        className="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base text-gray-900"
                        placeholder="Days"
                      />
                    )}
                  </div>

                  {/* Birthday Window */}
                  <div>
                    <label className="flex items-center space-x-2 mb-1">
                      <input
                        type="checkbox"
                        checked={filters.birthdayEnabled}
                        onChange={(e) => setFilters(prev => ({ 
                          ...prev, 
                          birthdayEnabled: e.target.checked,
                          birthdayWithinDays: e.target.checked ? prev.birthdayWithinDays : undefined
                        }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Birthday within next X days</span>
                    </label>
                    {filters.birthdayEnabled && (
                      <input
                        type="number"
                        min="1"
                        value={filters.birthdayWithinDays ?? ''}
                        onChange={(e) => setFilters(prev => ({ 
                          ...prev, 
                          birthdayWithinDays: e.target.value ? parseInt(e.target.value, 10) : undefined 
                        }))}
                        className="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base text-gray-900"
                        placeholder="Days (e.g., 30)"
                      />
                    )}
                  </div>

                  {/* Spend Range */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Min Spend
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={filters.spendMin ?? ''}
                        onChange={(e) => setFilters(prev => ({ 
                          ...prev, 
                          spendMin: e.target.value ? parseFloat(e.target.value) : undefined 
                        }))}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base text-gray-900"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Spend
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={filters.spendMax ?? ''}
                        onChange={(e) => setFilters(prev => ({ 
                          ...prev, 
                          spendMax: e.target.value ? parseFloat(e.target.value) : undefined 
                        }))}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base text-gray-900"
                        placeholder="∞"
                      />
                    </div>
                  </div>

                  {/* Interest Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Interest Type
                    </label>
                    <div className="space-y-2">
                      {['engagement', 'wedding', 'fashion/other', 'unknown'].map(type => (
                        <label key={type} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={filters.interestTypes.includes(type)}
                            onChange={() => handleInterestTypeToggle(type)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 capitalize">{type}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-3 pt-2">
                    <button
                      onClick={handleApplyFilters}
                      disabled={isLoadingContacts}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoadingContacts ? 'Applying...' : 'Apply'}
                    </button>
                    <button
                      onClick={clearFilters}
                      className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                      Clear Filters
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Filtered Contacts Table */}
            {filtersApplied && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Filtered Contacts ({filteredContacts.length})
                    </h3>
                    {/* Show selection summary across all segments */}
                    {(() => {
                      const totalSelected = selectedContactIdsBySegment.hot.size + 
                                          selectedContactIdsBySegment.warm.size + 
                                          selectedContactIdsBySegment.cold.size;
                      if (totalSelected > 0) {
                        return (
                          <p className="text-sm text-gray-600 mt-1">
                            Selected: {selectedContactIdsBySegment.hot.size} Hot, {selectedContactIdsBySegment.warm.size} Warm, {selectedContactIdsBySegment.cold.size} Cold (Total: {totalSelected})
                          </p>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <button
                    onClick={() => {
                      if (selectedContactIds.size === filteredContacts.length) {
                        setSelectedContactIds(new Set());
                      } else {
                        setSelectedContactIds(new Set(filteredContacts.map(c => c.id)));
                      }
                    }}
                    className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                  >
                    {selectedContactIds.size === filteredContacts.length ? 'Unselect All' : 'Select All'}
                  </button>
                </div>
                <ContactsTable 
                  contacts={filteredContacts} 
                  isLoading={isLoadingContacts}
                  selectedContactIds={selectedContactIds}
                  onSelectionChange={setSelectedContactIds}
                />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Select Meta WhatsApp Template
                </label>
                <button
                  onClick={fetchTemplates}
                  disabled={isLoadingTemplates}
                  className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                  title="Refresh templates"
                >
                  {isLoadingTemplates ? 'Loading...' : 'Refresh'}
                </button>
              </div>
              <select
                value={isManualMessage ? 'ManuallyMessage' : (selectedTemplate ? `${selectedTemplate.name}_${selectedTemplate.language}` : '')}
                onChange={(e) => handleTemplateChange(e.target.value)}
                disabled={isLoadingTemplates}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base text-gray-900 bg-white disabled:opacity-50"
              >
                <option value="">-- Select a template --</option>
                <option value="ManuallyMessage">Manual Message</option>
                {templates.map((template) => (
                  <option key={`${template.id}_${template.language}`} value={`${template.name}_${template.language}`}>
                    {template.name} ({template.language}) {template.category ? `- ${template.category}` : ''} {template.is_custom ? '[Custom]' : `[${template.status}]`}
                  </option>
                ))}
              </select>
              {templates.length === 0 && !isLoadingTemplates && (
                <p className="mt-2 text-sm text-gray-500">
                  No templates found. <Link href="/settings" className="text-blue-600 hover:text-blue-900">Sync templates from Meta</Link>
                </p>
              )}
              
              {/* Manual Message Input */}
              {isManualMessage && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Enter Your Message
                  </label>
                  <textarea
                    value={manualMessage}
                    onChange={(e) => setManualMessage(e.target.value)}
                    placeholder="Type your message here..."
                    rows={6}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm text-gray-900 bg-white"
                  />
                </div>
              )}
              
              {/* Template Preview and Variables */}
              {selectedTemplate && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="mb-3">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Template Details</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                      <div><span className="font-medium">Language:</span> {selectedTemplate.language}</div>
                      <div><span className="font-medium">Category:</span> {selectedTemplate.category || 'N/A'}</div>
                      <div><span className="font-medium">Status:</span> 
                        <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${
                          selectedTemplate.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                          selectedTemplate.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {selectedTemplate.status}
                        </span>
                      </div>
                      <div><span className="font-medium">Variables:</span> {selectedTemplate.variable_count}</div>
                    </div>
                  </div>

                  {/* Template Preview */}
                  {selectedTemplate.components && selectedTemplate.components.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">Template Preview</h4>
                      {/* WhatsApp-like preview container */}
                      <div className="bg-[#e5ddd5] p-4 rounded-lg border border-gray-300" style={{ backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                        <div className="bg-white rounded-lg shadow-sm max-w-sm mx-auto overflow-hidden">
                          {/* Sort and display components: BUTTONS, HEADER, BODY */}
                          {(() => {
                            const sortedComponents = [...selectedTemplate.components].sort((a, b) => {
                              const order = { BUTTONS: 0, HEADER: 1, BODY: 2 };
                              return (order[a.type as keyof typeof order] || 999) - (order[b.type as keyof typeof order] || 999);
                            });
                            
                            return sortedComponents.map((component, idx) => {
                              // BUTTONS Component (first)
                              if (component.type === 'BUTTONS') {
                                const buttons: Array<{ type: string; text: string; url?: string; phone_number?: string }> = [];
                                
                                // Get buttons from component or from button1-button2 columns
                                if (component.buttons && component.buttons.length > 0) {
                                  buttons.push(...component.buttons);
                                } else {
                                  // Get from button1-button2 columns
                                  if (selectedTemplate.button1_text && selectedTemplate.button1_type) {
                                    buttons.push({
                                      type: selectedTemplate.button1_type,
                                      text: selectedTemplate.button1_text,
                                      url: selectedTemplate.button1_url,
                                      phone_number: selectedTemplate.button1_phone,
                                    });
                                  }
                                  if (selectedTemplate.button2_text && selectedTemplate.button2_type) {
                                    buttons.push({
                                      type: selectedTemplate.button2_type,
                                      text: selectedTemplate.button2_text,
                                      url: selectedTemplate.button2_url,
                                      phone_number: selectedTemplate.button2_phone,
                                    });
                                  }
                                }
                                
                                if (buttons.length > 0) {
                                  return (
                                    <div key={idx} className="border-t border-gray-200">
                                      <div className="px-2 py-2 space-y-1">
                                        {buttons.map((button, btnIdx) => (
                                          <button
                                            key={btnIdx}
                                            type="button"
                                            className="w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md border border-blue-200 bg-white transition-colors text-left"
                                          >
                                            {button.text || 'Button'}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }
                              
                              // HEADER Component (second)
                              if (component.type === 'HEADER') {
                                // Get image URL from various possible sources
                                let imageUrl = component.image_url;
                                
                                // Handle base64 image_data
                                if (!imageUrl && component.image_data) {
                                  if (component.image_data.startsWith('data:')) {
                                    imageUrl = component.image_data;
                                  } else {
                                    imageUrl = `data:image/jpeg;base64,${component.image_data}`;
                                  }
                                }
                                
                                // For Meta templates with header_handle
                                if (!imageUrl && component.example?.header_handle && component.example.header_handle[0]) {
                                  const handle = component.example.header_handle[0];
                                  imageUrl = `/api/whatsapp/templates/image/${encodeURIComponent(handle)}`;
                                }
                                
                                return (
                                  <div key={idx}>
                                    {/* Show image if format is IMAGE */}
                                    {component.format === 'IMAGE' && imageUrl && (
                                      <div className="w-full">
                                        <img
                                          src={imageUrl}
                                          alt="Template header"
                                          className="w-full h-auto max-h-64 object-cover"
                                          onError={(e) => {
                                            console.error('Failed to load image:', imageUrl);
                                            const img = e.target as HTMLImageElement;
                                            img.style.display = 'none';
                                          }}
                                        />
                                      </div>
                                    )}
                                    {/* Show header text */}
                                    {(component.text || component.example?.header_text?.[0]) && (
                                      <div className={`px-4 ${component.format === 'IMAGE' && imageUrl ? 'pt-3' : 'pt-3'} pb-2`}>
                                        <p className="text-sm font-semibold text-gray-900 whitespace-pre-wrap">
                                          {component.text || component.example?.header_text?.[0] || ''}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              
                              // BODY Component (third)
                              if (component.type === 'BODY') {
                                // Get images from component.images array or from image1-image8 columns
                                const bodyImages: string[] = [];
                                
                                if (component.images && component.images.length > 0) {
                                  bodyImages.push(...component.images);
                                } else {
                                  // Get from image1-image8 columns
                                  for (let i = 1; i <= 8; i++) {
                                    const imageField = `image${i}` as keyof MetaTemplate;
                                    const imageUrl = selectedTemplate[imageField] as string | undefined;
                                    if (imageUrl) {
                                      bodyImages.push(imageUrl);
                                    }
                                  }
                                }
                                
                                return (
                                  <div key={idx}>
                                    {/* Show images if format is IMAGE */}
                                    {component.format === 'IMAGE' && bodyImages.length > 0 && (
                                      <div className="grid grid-cols-3 gap-2 p-2">
                                        {bodyImages.map((imageUrl, imgIdx) => (
                                          <div key={imgIdx} className="relative aspect-square overflow-hidden rounded">
                                            <img
                                              src={imageUrl}
                                              alt={`Body image ${imgIdx + 1}`}
                                              className="w-full h-full object-contain"
                                              onError={(e) => {
                                                console.error('Failed to load body image:', imageUrl);
                                                const img = e.target as HTMLImageElement;
                                                img.style.display = 'none';
                                              }}
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {/* Show body text */}
                                    {component.text && (
                                      <div className="px-4 py-2">
                                        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{component.text}</p>
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              
                              return null;
                            });
                          })()}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Variable Inputs */}
                  {selectedTemplate.variable_count > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">
                        Template Variables ({selectedTemplate.variable_count} required)
                      </h4>
                      <div className="space-y-2">
                        {templateVariables.map((value, index) => (
                          <div key={index}>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Variable {index + 1}
                            </label>
                            <input
                              type="text"
                              value={value}
                              onChange={(e) => {
                                const newVars = [...templateVariables];
                                newVars[index] = e.target.value;
                                setTemplateVariables(newVars);
                              }}
                              placeholder={`Enter value for variable ${index + 1}`}
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm text-gray-900 bg-white"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={handleSendCampaign}
              disabled={isLoading || (!selectedTemplate && !isManualMessage)}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Sending...' : 'Send Campaign'}
            </button>
          </div>
        </div>
      </main>

      {/* Confirmation Modal */}
      {showConfirmModal && confirmCounts && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Campaign Send</h3>
            
            <div className="space-y-3 mb-6">
              {(() => {
                const totalSelected = selectedContactIdsBySegment.hot.size + 
                                     selectedContactIdsBySegment.warm.size + 
                                     selectedContactIdsBySegment.cold.size;
                const segments: Array<{ name: string; count: number }> = [];
                if (selectedContactIdsBySegment.hot.size > 0) segments.push({ name: 'Hot', count: selectedContactIdsBySegment.hot.size });
                if (selectedContactIdsBySegment.warm.size > 0) segments.push({ name: 'Warm', count: selectedContactIdsBySegment.warm.size });
                if (selectedContactIdsBySegment.cold.size > 0) segments.push({ name: 'Cold', count: selectedContactIdsBySegment.cold.size });
                
                return segments.length > 0 ? (
                  <div>
                    <span className="text-sm font-medium text-gray-700">Selected Contacts:</span>
                    <span className="ml-2 text-sm text-gray-900">
                      {segments.map(s => `${s.name} (${s.count})`).join(', ')} - Total: {totalSelected}
                    </span>
                  </div>
                ) : null;
              })()}
              <div>
                <span className="text-sm font-medium text-gray-700">Template:</span>
                <span className="ml-2 text-sm text-gray-900">
                  {isManualMessage ? 'Manual Message' : (selectedTemplate ? `${selectedTemplate.name} (${selectedTemplate.language})` : 'N/A')}
                </span>
              </div>
              {isManualMessage && (
                <div>
                  <span className="text-sm font-medium text-gray-700">Message:</span>
                  <div className="ml-2 mt-1 p-2 bg-gray-100 rounded text-xs text-gray-700 max-h-32 overflow-y-auto">
                    {manualMessage || '(empty)'}
                  </div>
                </div>
              )}
              {selectedTemplate && templateVariables.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-gray-700">Variables:</span>
                  <div className="ml-2 mt-1">
                    {templateVariables.map((v, idx) => (
                      <span key={idx} className="inline-block mr-2 px-2 py-1 bg-gray-100 rounded text-xs text-gray-700">
                        {v || `(empty ${idx + 1})`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {(() => {
              const totalSelected = selectedContactIdsBySegment.hot.size + 
                                   selectedContactIdsBySegment.warm.size + 
                                   selectedContactIdsBySegment.cold.size;
              
              if (totalSelected === 0) {
                return (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-800">
                      No contacts selected. Please select at least one contact.
                    </p>
                  </div>
                );
              }
              
              return (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800">
                    This will send the campaign to {totalSelected} selected contact{totalSelected !== 1 ? 's' : ''}.
                  </p>
                </div>
              );
            })()}

            <div className="flex space-x-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmSendCampaign}
                disabled={(() => {
                  const totalSelected = selectedContactIdsBySegment.hot.size + 
                                       selectedContactIdsBySegment.warm.size + 
                                       selectedContactIdsBySegment.cold.size;
                  return totalSelected === 0;
                })()}
                className="flex-1 px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
