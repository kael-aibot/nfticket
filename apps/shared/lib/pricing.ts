import { defaultSettings } from './settings';
import type { AppSettings } from './types';

export function calculatePrimaryPrice(basePrice: number, settings: AppSettings = defaultSettings) {
  const platformFee = basePrice * (settings.platformFeePercent / 100);
  const total = basePrice + platformFee;

  return {
    basePrice,
    platformFee,
    total,
  };
}

export function getResaleCapPercent(eventDate: number, settings: AppSettings = defaultSettings, now = Date.now()) {
  const msUntilEvent = eventDate - now;
  const day = 24 * 60 * 60 * 1000;

  if (msUntilEvent <= 0) return settings.resaleDecay.dayOfEvent;
  if (msUntilEvent <= 7 * day) return settings.resaleDecay.under7Days;
  if (msUntilEvent <= 30 * day) return settings.resaleDecay.between7And30Days;
  if (msUntilEvent <= 60 * day) return settings.resaleDecay.between30And60Days;
  return settings.resaleDecay.moreThan60Days;
}

export function calculateResaleLimit(faceValue: number, eventDate: number, settings: AppSettings = defaultSettings) {
  const capPercent = getResaleCapPercent(eventDate, settings);
  const maxPrice = faceValue * (1 + capPercent / 100);

  return {
    capPercent,
    maxPrice,
  };
}
