const SCANNER_LABEL_PREFIX = 'scanner:';
const USER_SCANNER_PREFIX = 'user:';
const DEVICE_HASH_PATTERN = /^[a-f0-9]{32,64}$/i;

function normalizeValue(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isDeviceHashCredential(value: string | null | undefined): boolean {
  const normalized = normalizeValue(value);
  return normalized ? DEVICE_HASH_PATTERN.test(normalized) : false;
}

export function normalizeScannerLabel(value: string | null | undefined): string | null {
  const normalized = normalizeValue(value);
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith(SCANNER_LABEL_PREFIX)) {
    return normalizeValue(normalized.slice(SCANNER_LABEL_PREFIX.length));
  }

  return normalized;
}

export function toScannerCredential(value: string | null | undefined): string | null {
  const normalized = normalizeValue(value);
  if (!normalized) {
    return null;
  }

  if (
    normalized.startsWith(SCANNER_LABEL_PREFIX)
    || normalized.startsWith(USER_SCANNER_PREFIX)
    || isDeviceHashCredential(normalized)
  ) {
    return normalized;
  }

  return `${SCANNER_LABEL_PREFIX}${normalized}`;
}

export function matchesAuthorizedScannerLabel(
  authorizedScanner: string,
  scannerLabel: string | null | undefined,
): boolean {
  const authorizedValue = normalizeValue(authorizedScanner);
  const normalizedLabel = normalizeScannerLabel(scannerLabel);
  if (!authorizedValue || !normalizedLabel) {
    return false;
  }

  return authorizedValue === normalizedLabel || authorizedValue === `${SCANNER_LABEL_PREFIX}${normalizedLabel}`;
}
