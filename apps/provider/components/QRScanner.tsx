import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { toScannerCredential } from '../../shared/lib/scannerCredentials';
import {
  clearScannerSession,
  getQueuedScans,
  getScannerSession,
  queueScan,
  removeQueuedScan,
  saveScannerSession,
} from '../../shared/lib/storage';
import { createPrefixedId } from '../../shared/lib/ids';
import type {
  QrTicketPayload,
  ScanQueueItem,
  ScannerLocation,
  ScannerValidationResult,
} from '../../shared/lib/types';

interface QRScannerProps {
  scannerLabel?: string;
  checkpoint?: string;
  onValidationResult?: (result: ScannerValidationResult) => void;
  onError?: (error: string) => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({
  scannerLabel,
  checkpoint = 'default',
  onValidationResult,
  onError,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [validationResult, setValidationResult] = useState<ScannerValidationResult | null>(null);
  const [queueCount, setQueueCount] = useState(0);
  const [deviceFingerprint, setDeviceFingerprint] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);
  const scannerCredential = toScannerCredential(scannerLabel);

  useEffect(() => {
    setQueueCount(getQueuedScans().length);
    createDeviceFingerprint().then(setDeviceFingerprint).catch(() => setDeviceFingerprint('fallback-device'));
  }, []);

  useEffect(() => {
    function handleOnline() {
      void syncQueuedScans();
    }

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [deviceFingerprint, checkpoint, scannerLabel]);

  async function ensureScannerToken(eventId: string) {
    const existing = getScannerSession(eventId);
    if (
      existing &&
      existing.deviceFingerprint === deviceFingerprint &&
      existing.expiresAt > Date.now()
    ) {
      return existing.token;
    }

    clearScannerSession(eventId);
    const response = await fetch('/api/scanner-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        eventId,
        scannerLabel: scannerCredential ?? undefined,
        deviceFingerprint,
      }),
    });

    const body = await response.json();
    if (!response.ok) {
      throw new Error(typeof body?.error === 'string' ? body.error : 'Scanner authorization failed');
    }

    saveScannerSession({
      ...body,
      scannerLabel: scannerCredential,
    });
    return body.token as string;
  }

  async function submitQueuedScan(item: ScanQueueItem) {
    const token = await ensureScannerToken(item.payload.eventId);
    const response = await fetch('/api/validate-scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        payload: item.payload,
        deviceFingerprint: item.deviceFingerprint,
        checkpoint: item.checkpoint,
        location: item.location,
        idempotencyKey: item.idempotencyKey,
        scannedAt: item.scannedAt,
      }),
    });

    if (response.status === 401) {
      clearScannerSession(item.payload.eventId);
    }

    const result = (await response.json()) as ScannerValidationResult & { error?: string };
    if (!response.ok) {
      throw new Error(result.error ?? result.message ?? 'Queued scan sync failed');
    }

    removeQueuedScan(item.idempotencyKey);
    setQueueCount(getQueuedScans().length);
    setValidationResult(result);
    onValidationResult?.(result);
  }

  async function syncQueuedScans() {
    if (!navigator.onLine || !deviceFingerprint || isSyncingRef.current) {
      return;
    }

    const queue = getQueuedScans();
    if (queue.length === 0) {
      setQueueCount(0);
      setSyncMessage('');
      return;
    }

    isSyncingRef.current = true;
    setSyncMessage(`Syncing ${queue.length} queued scan${queue.length === 1 ? '' : 's'}...`);

    try {
      for (const item of queue) {
        await submitQueuedScan(item);
      }
      setSyncMessage('Offline scans synced');
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : 'Sync failed');
    } finally {
      isSyncingRef.current = false;
      setQueueCount(getQueuedScans().length);
    }
  }

  async function validatePayload(payload: QrTicketPayload) {
    if (!deviceFingerprint) {
      throw new Error('Scanner device fingerprint is not ready');
    }

    const location = await getCurrentLocation();
    const idempotencyKey = createPrefixedId(`scan_${payload.ticketId}`);

    if (!navigator.onLine) {
      const queuedResult = queueOfflineScan({
        idempotencyKey,
        payload,
        checkpoint,
        location,
        scannedAt: Date.now(),
        queuedAt: Date.now(),
        deviceFingerprint,
      });
      setQueueCount(getQueuedScans().length);
      setValidationResult(queuedResult);
      onValidationResult?.(queuedResult);
      return queuedResult;
    }

    const token = await ensureScannerToken(payload.eventId);
    const response = await fetch('/api/validate-scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        payload,
        deviceFingerprint,
        checkpoint,
        location,
        idempotencyKey,
        scannedAt: Date.now(),
      }),
    });

    if (response.status === 401) {
      clearScannerSession(payload.eventId);
    }

    const result = (await response.json()) as ScannerValidationResult & { error?: string };
    if (!response.ok) {
      throw new Error(result.error ?? result.message ?? 'Scan validation failed');
    }

    setValidationResult(result);
    onValidationResult?.(result);
    return result;
  }

  const startScanning = async () => {
    if (!elementRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      setHasPermission(true);

      scannerRef.current = new Html5Qrcode('qr-reader');
      await scannerRef.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          const payload = parseQrPayload(decodedText);
          if (!payload) {
            onError?.('Invalid QR payload');
            return;
          }

          setIsValidating(true);
          await stopScanning();

          try {
            await validatePayload(payload);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Scan validation failed';
            onError?.(message);
          } finally {
            setIsValidating(false);
          }
        },
        () => {
          // Ignore intermediate decode misses.
        },
      );

      setIsScanning(true);
    } catch {
      setHasPermission(false);
      onError?.('Camera permission denied or not available');
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop();
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  if (hasPermission === false) {
    return (
      <div className="rounded-xl border border-red-500 bg-red-500/20 p-6 text-center">
        <p className="mb-2 text-red-200">Camera access denied</p>
        <p className="text-sm text-red-300">
          Please allow camera access in your browser settings to scan tickets.
        </p>
        <button
          onClick={() => setHasPermission(null)}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-white"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!isScanning ? (
        <button
          onClick={startScanning}
          disabled={isValidating || !deviceFingerprint}
          className="w-full rounded-xl bg-cyan-500 p-8 text-center text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <div className="mb-4 text-6xl">Scan</div>
          <h3 className="text-xl font-bold">Start Scanning</h3>
          <p className="mt-2 text-sm text-black/70">
            {isValidating ? 'Validating last scan...' : 'Uses backend validation and device authorization'}
          </p>
        </button>
      ) : (
        <div className="relative">
          <div id="qr-reader" ref={elementRef} className="overflow-hidden rounded-xl" />
          <button
            onClick={stopScanning}
            className="absolute right-4 top-4 z-10 rounded-lg bg-red-600 px-4 py-2 text-white"
          >
            Stop
          </button>
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 m-12 rounded-lg border-2 border-green-400" />
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
        <p>Checkpoint: <span className="text-white">{checkpoint}</span></p>
        <p>Authorized label: <span className="text-white">{scannerCredential ?? 'session-bound scanner'}</span></p>
        <p>Queued offline scans: <span className="text-white">{queueCount}</span></p>
        {syncMessage && <p className="mt-2 text-cyan-200">{syncMessage}</p>}
      </div>

      {validationResult && (
        <div
          className={`rounded-2xl border p-4 ${
            validationResult.status === 'accepted'
              ? 'border-emerald-400/40 bg-emerald-500/10'
              : validationResult.status === 'offline_queued'
                ? 'border-amber-400/40 bg-amber-500/10'
                : 'border-red-400/40 bg-red-500/10'
          }`}
        >
          <p className="text-sm uppercase tracking-[0.25em] text-white/60">{validationResult.status}</p>
          <p className="mt-2 text-lg font-semibold text-white">{validationResult.message}</p>
          {validationResult.ticket && (
            <p className="mt-2 text-white/70">
              {validationResult.ticket.tierName}
              {validationResult.ticket.seatInfo ? ` • ${validationResult.ticket.seatInfo}` : ''}
            </p>
          )}
          {validationResult.event && (
            <p className="text-white/70">
              {validationResult.event.name} • {validationResult.event.venue}
            </p>
          )}
          {validationResult.checkpoint && (
            <p className="text-white/70">Checkpoint: {validationResult.checkpoint}</p>
          )}
          {validationResult.alreadyScannedAt && (
            <p className="mt-2 text-sm text-red-100">
              First scanned at {new Date(validationResult.alreadyScannedAt).toLocaleString()}.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

function parseQrPayload(decodedText: string): QrTicketPayload | null {
  try {
    const parsed = JSON.parse(decodedText);
    if (
      parsed?.type === 'nfticket' &&
      parsed?.version === 2 &&
      typeof parsed?.ticketId === 'string' &&
      typeof parsed?.eventId === 'string' &&
      typeof parsed?.issuedAt === 'number'
    ) {
      return parsed as QrTicketPayload;
    }
  } catch {
    return null;
  }

  return null;
}

function queueOfflineScan(item: ScanQueueItem): ScannerValidationResult {
  queueScan(item);
  return {
    success: false,
    status: 'offline_queued',
    message: 'Offline: scan queued for sync',
    scannedAt: item.scannedAt,
    event: { id: item.payload.eventId, name: 'Queued event', venue: 'Pending sync', eventDate: item.payload.issuedAt },
    offline: true,
  };
}

async function createDeviceFingerprint() {
  const source = JSON.stringify({
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    hardwareConcurrency: navigator.hardwareConcurrency,
  });

  if (!window.crypto?.subtle) {
    return `device_${btoa(source).slice(0, 24)}`;
  }

  const encoded = new TextEncoder().encode(source);
  const digest = await window.crypto.subtle.digest('SHA-256', encoded.buffer as ArrayBuffer);
  return `device_${Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 24)}`;
}

async function getCurrentLocation(): Promise<ScannerLocation | null> {
  if (!navigator.geolocation) {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      () => resolve(null),
      { maximumAge: 60_000, timeout: 3_000 },
    );
  });
}

export default QRScanner;
