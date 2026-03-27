import { defaultAppSettings } from '../../../lib/domain';
import { getSettings, saveSettings } from './storage';
import type { AppSettings } from './types';

export const defaultSettings: AppSettings = defaultAppSettings;

export function loadSettings() {
  return getSettings() ?? defaultSettings;
}

export function persistSettings(settings: AppSettings) {
  saveSettings(settings);
}
