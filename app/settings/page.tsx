'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';

interface Settings {
  n8n_webhook_url: string;
  n8n_webhook_inbound_url: string;
  ai_webhook_url: string;
  n8n_webhook_secret: string;
  templates: Array<{ id: string; name: string; message?: string }>;
}

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>({
    n8n_webhook_url: '',
    n8n_webhook_inbound_url: '',
    ai_webhook_url: '',
    n8n_webhook_secret: '',
    templates: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [templateMessage, setTemplateMessage] = useState('');
  const [isSyncingTemplates, setIsSyncingTemplates] = useState(false);
  const [syncTemplateMessage, setSyncTemplateMessage] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
      }
    } catch (err) {
      setError('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      setSuccess('Settings saved successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  }

  function handleAddTemplate() {
    if (!newTemplateName.trim()) {
      setError('Please enter a template name');
      return;
    }
    
    // Show modal to enter message
    setShowMessageModal(true);
  }

  function handleConfirmTemplate() {
    if (!newTemplateName.trim()) {
      setError('Template name is required');
      return;
    }

    const newTemplate = {
      id: crypto.randomUUID(),
      name: newTemplateName.trim(),
      message: templateMessage.trim() || undefined,
    };

    setSettings({
      ...settings,
      templates: [...settings.templates, newTemplate],
    });

    setNewTemplateName('');
    setTemplateMessage('');
    setShowMessageModal(false);
    setError(null);
  }

  function handleCancelTemplate() {
    setShowMessageModal(false);
    setTemplateMessage('');
    setError(null);
  }

  function handleRemoveTemplate(templateId: string) {
    setSettings({
      ...settings,
      templates: settings.templates.filter(t => t.id !== templateId),
    });
  }

  async function handleSyncMetaTemplates() {
    setIsSyncingTemplates(true);
    setSyncTemplateMessage(null);
    setError(null);
    
    try {
      const response = await fetch('/api/whatsapp/templates/sync');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync templates');
      }

      setSyncTemplateMessage(`Successfully synced ${data.synced} templates from Meta`);
      
      // Clear message after 5 seconds
      setTimeout(() => {
        setSyncTemplateMessage(null);
      }, 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync templates from Meta');
    } finally {
      setIsSyncingTemplates(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center w-10 h-10 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Go back"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
          </div>

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

          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">n8n Webhook Configuration</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Webhook URL (Outbound - Sending Messages)
                  </label>
                  <input
                    type="url"
                    value={settings.n8n_webhook_url}
                    onChange={(e) => setSettings({ ...settings, n8n_webhook_url: e.target.value })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base text-gray-900 bg-white"
                    placeholder="https://your-n8n-instance.com/webhook/send-message"
                  />
                  <p className="mt-1 text-xs text-gray-500">Used for sending messages from CRM to WhatsApp via n8n</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Webhook URL (Inbound - Receiving Messages)
                  </label>
                  <input
                    type="url"
                    value={settings.n8n_webhook_inbound_url}
                    onChange={(e) => setSettings({ ...settings, n8n_webhook_inbound_url: e.target.value })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base text-gray-900 bg-white"
                    placeholder="https://your-n8n-instance.com/webhook/whatsapp-inbound"
                  />
                  <p className="mt-1 text-xs text-gray-500">Used for receiving inbound WhatsApp messages (configure this URL in your WhatsApp providers webhook settings)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    AI Webhook URL (When AI is ON)
                  </label>
                  <input
                    type="url"
                    value={settings.ai_webhook_url}
                    onChange={(e) => setSettings({ ...settings, ai_webhook_url: e.target.value })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base text-gray-900 bg-white"
                    placeholder="https://your-ai-service.com/webhook/ai-inbound"
                  />
                  <p className="mt-1 text-xs text-gray-500">When AI switch is ON, inbound messages will be forwarded to this webhook instead of the regular inbound webhook</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Webhook Secret (optional)
                  </label>
                  <input
                    type="password"
                    value={settings.n8n_webhook_secret}
                    onChange={(e) => setSettings({ ...settings, n8n_webhook_secret: e.target.value })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base text-gray-900 bg-white"
                    placeholder="Secret key for webhook authentication"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">WhatsApp Templates</h3>
                <button
                  onClick={handleSyncMetaTemplates}
                  disabled={isSyncingTemplates}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSyncingTemplates ? 'Syncing...' : 'Sync Meta Templates'}
                </button>
              </div>
              {syncTemplateMessage && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-800">{syncTemplateMessage}</p>
                </div>
              )}
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTemplate()}
                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base text-gray-900 bg-white"
                    placeholder="Template name"
                  />
                  <button
                    onClick={handleAddTemplate}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
                <ul className="space-y-2">
                  {settings.templates.map((template) => (
                    <li
                      key={template.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                    >
                      <span className="text-sm text-gray-900">{template.name}</span>
                      <button
                        onClick={() => handleRemoveTemplate(template.id)}
                        className="text-red-600 hover:text-red-900 text-sm"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-4 border-t">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Message Input Modal */}
      {showMessageModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCancelTemplate();
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Template Message</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Template Name
              </label>
              <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md border border-gray-200">{newTemplateName}</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message <span className="text-gray-500 font-normal">(optional)</span>
              </label>
              <textarea
                value={templateMessage}
                onChange={(e) => setTemplateMessage(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base text-gray-900 bg-white"
                placeholder="Enter the WhatsApp template message..."
                rows={10}
                autoFocus
              />
              <p className="mt-2 text-xs text-gray-500">
                You can use placeholders like {"{"}name{"}"}, {"{"}phone{"}"} in your message. They will be replaced with actual contact information.
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleCancelTemplate}
                className="flex-1 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmTemplate}
                className="flex-1 px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Add Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


