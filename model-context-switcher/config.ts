import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ModelSlot {
  model: string;
  label: string;
  contextThreshold: number; // tokens; switch to next slot when exceeded
}

export interface ModelContextSwitcherConfig {
  enabled: boolean;
  slots: ModelSlot[];
  switchOnLengthFinish: boolean; // switch when finishReason === 'length'
  switchOnThreshold: boolean;    // switch when estimated tokens > contextThreshold
  resetOnNewTask: boolean;       // reset to slot 0 when a new task starts
}

export const DEFAULT_CONFIG: ModelContextSwitcherConfig = {
  enabled: true,
  slots: [
    { model: '', label: 'Small', contextThreshold: 32000 },
    { model: '', label: 'Large', contextThreshold: 128000 },
    { model: '', label: 'XL',    contextThreshold: 999999 },
  ],
  switchOnLengthFinish: true,
  switchOnThreshold: true,
  resetOnNewTask: true,
};

export function loadConfig(configPath: string): ModelContextSwitcherConfig {
  try {
    if (existsSync(configPath)) {
      const data = readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(data) as Partial<ModelContextSwitcherConfig>;
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch {
    // fall back to defaults
  }
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(configPath: string, config: unknown): ModelContextSwitcherConfig {
  const input = config as Partial<ModelContextSwitcherConfig>;
  const merged: ModelContextSwitcherConfig = {
    ...DEFAULT_CONFIG,
    ...input,
    slots: Array.isArray(input.slots) ? input.slots.map((s, i) => ({
      model:            s.model            ?? DEFAULT_CONFIG.slots[i]?.model            ?? '',
      label:            s.label            ?? DEFAULT_CONFIG.slots[i]?.label            ?? `Slot ${i + 1}`,
      contextThreshold: Number(s.contextThreshold) || DEFAULT_CONFIG.slots[i]?.contextThreshold ?? 32000,
    })) : DEFAULT_CONFIG.slots,
  };
  writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf-8');
  return merged;
}
