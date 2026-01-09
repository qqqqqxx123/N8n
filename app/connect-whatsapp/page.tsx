'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { QRCodeSVG } from 'qrcode.react';

type ConnectionStatus = 'not_connected' | 'qr_pending' | 'connected' | 'expired';

interface ConnectionState {
  status: ConnectionStatus;
  phoneNumber: string | null;
  qrCodeData: string | null;
  qrCodeExpiresAt: string | null;
}

export default function ConnectWhatsAppPage() {
  const router = useRouter();
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'not_connected',
    phoneNumber: null,
    qrCodeData: null,
    qrCodeExpiresAt: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const fetchConnectionStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/whatsapp/connection');
      if (response.ok) {
        const data = await response.json();
        setConnectionState({
          status: data.status || 'not_connected',
          phoneNumber: data.phoneNumber || null,
          qrCodeData: data.qrCodeData || null,
          qrCodeExpiresAt: data.qrCodeExpiresAt || null,
        });

        // Start countdown if QR code exists
        if (data.qrCodeExpiresAt) {
          const expiresAt = new Date(data.qrCodeExpiresAt).getTime();
          const now = Date.now();
          const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
          setCountdown(remaining);
        }
      }
    } catch (err) {
      console.error('Error fetching connection status:', err);
      setError('Failed to fetch connection status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnectionStatus();
  }, [fetchConnectionStatus]);

  // Poll for connection status updates when QR is pending
  useEffect(() => {
    if (connectionState.status === 'qr_pending') {
      const interval = setInterval(() => {
        fetchConnectionStatus();
      }, 3000); // Poll every 3 seconds

      return () => clearInterval(interval);
    }
  }, [connectionState.status, fetchConnectionStatus]);

  // Countdown timer for QR code expiration
  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    } else if (countdown === 0 && connectionState.status === 'qr_pending') {
      setConnectionState((prev) => ({ ...prev, status: 'expired' }));
    }
  }, [countdown, connectionState.status]);

  async function handleGenerateQR() {
    setIsGeneratingQR(true);
    setError(null);

    try {
      const response = await fetch('/api/whatsapp/connection/qr', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate QR code');
      }

      const data = await response.json();
      setConnectionState({
        status: 'qr_pending',
        phoneNumber: null,
        qrCodeData: data.qrCodeData,
        qrCodeExpiresAt: data.qrCodeExpiresAt,
      });

      if (data.qrCodeExpiresAt) {
        const expiresAt = new Date(data.qrCodeExpiresAt).getTime();
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
        setCountdown(remaining);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate QR code');
    } finally {
      setIsGeneratingQR(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Are you sure you want to disconnect WhatsApp? This will stop message forwarding.')) {
      return;
    }

    try {
      const response = await fetch('/api/whatsapp/connection', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      setConnectionState({
        status: 'not_connected',
        phoneNumber: null,
        qrCodeData: null,
        qrCodeExpiresAt: null,
      });
      setCountdown(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  }

  function formatCountdown(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">Loading connection status...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
            <h2 className="text-2xl font-bold text-gray-900">Connect WhatsApp</h2>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-6">
            {/* Connection Status Card */}
            <div className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Connection Status</h3>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    connectionState.status === 'connected'
                      ? 'bg-green-100 text-green-800'
                      : connectionState.status === 'qr_pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : connectionState.status === 'expired'
                      ? 'bg-orange-100 text-orange-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {connectionState.status === 'connected'
                    ? 'Connected'
                    : connectionState.status === 'qr_pending'
                    ? 'QR Code Active'
                    : connectionState.status === 'expired'
                    ? 'QR Code Expired'
                    : 'Not Connected'}
                </span>
              </div>

              {connectionState.status === 'connected' && connectionState.phoneNumber && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-2">Connected Phone Number:</p>
                  <p className="text-lg font-mono text-gray-900">{connectionState.phoneNumber}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    All inbound and outbound messages from this number are being forwarded to your configured webhook URL.
                  </p>
                </div>
              )}
            </div>

            {/* QR Code Display */}
            {connectionState.status === 'qr_pending' && connectionState.qrCodeData && (
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex flex-col items-center">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Scan QR Code with WhatsApp</h3>
                  <div className="bg-white p-4 rounded-lg border-2 border-gray-200 mb-4">
                    <QRCodeSVG value={connectionState.qrCodeData} size={256} level="M" />
                  </div>
                  {countdown !== null && countdown > 0 && (
                    <p className="text-sm text-gray-600 mb-2">
                      QR code expires in: <span className="font-mono font-semibold">{formatCountdown(countdown)}</span>
                    </p>
                  )}
                  {countdown === 0 && (
                    <p className="text-sm text-orange-600 mb-4">QR code has expired. Please generate a new one.</p>
                  )}
                  <p className="text-xs text-gray-500 text-center max-w-md">
                    Open WhatsApp on your phone, go to Settings → Linked Devices → Link a Device, and scan this QR code.
                  </p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              {connectionState.status === 'not_connected' || connectionState.status === 'expired' ? (
                <button
                  onClick={handleGenerateQR}
                  disabled={isGeneratingQR}
                  className="px-6 py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingQR ? 'Generating QR Code...' : 'Generate QR Code'}
                </button>
              ) : connectionState.status === 'qr_pending' ? (
                <button
                  onClick={handleGenerateQR}
                  disabled={isGeneratingQR}
                  className="px-6 py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingQR ? 'Regenerating...' : 'Regenerate QR Code'}
                </button>
              ) : connectionState.status === 'connected' ? (
                <button
                  onClick={handleDisconnect}
                  className="px-6 py-3 bg-red-600 text-white rounded-md font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Disconnect
                </button>
              ) : null}
            </div>

            {/* Information Section */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">How It Works</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>
                    After connecting, all inbound and outbound messages from your connected phone number will be forwarded to the webhook URL configured in{' '}
                    <button onClick={() => router.push('/settings')} className="text-blue-600 hover:underline">
                      Settings → Inbound – Receiving Messages
                    </button>
                    .
                  </span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>Messages will be stored and displayed in the CRM message interface.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>You can continue replying on your phone while the CRM mirrors and logs all messages.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>This connection enables future WhatsApp integrations and automation features.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}




