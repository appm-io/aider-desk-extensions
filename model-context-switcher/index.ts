import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type {
  Extension,
  ExtensionContext,
  UIComponentDefinition,
  AgentStartedEvent,
  AgentStepStartedEvent,
  AgentStepFinishedEvent,
  AgentFinishedEvent,
  TaskCreatedEvent,
  TaskPreparedEvent,
} from '@aiderdesk/extensions';

import { loadConfig, saveConfig, ModelContextSwitcherConfig, ModelSlot } from './config';

const configComponentJsx = readFileSync(join(__dirname, './ConfigComponent.jsx'), 'utf-8');
const switcherDisplayJsx = readFileSync(join(__dirname, './SwitcherDisplay.jsx'), 'utf-8');

interface SwitchHistoryEntry {
  fromLabel: string;
  toLabel: string;
  reason: 'length' | 'threshold';
}

// Per-task state tracked in memory
interface TaskState {
  currentSlotIndex: number;
  switchHistory: SwitchHistoryEntry[];
  estimatedTokens: number;
  // Whether the switcher is enabled for this specific task (stored in task.metadata)
}

export default class ModelContextSwitcherExtension implements Extension {
  static metadata = {
    name: 'Model Context Switcher',
    version: '1.0.0',
    description: 'Automatically switches to models with larger context windows when context limits are reached.',
    author: 'Appm.io',
    capabilities: ['events', 'ui'],
  };

  private configPath: string;
  private taskStates = new Map<string, TaskState>();

  constructor() {
    this.configPath = join(__dirname, 'config.json');
  }

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('Model Context Switcher loaded', 'info');
  }

  // ─── Config API ────────────────────────────────────────────────────────────

  getConfigComponent(_context: ExtensionContext): string {
    return configComponentJsx;
  }

  async getConfigData(_context: ExtensionContext): Promise<ModelContextSwitcherConfig> {
    return loadConfig(this.configPath);
  }

  async saveConfigData(configData: unknown, _context: ExtensionContext): Promise<unknown> {
    return saveConfig(this.configPath, configData);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private getTaskState(taskId: string): TaskState {
    if (!this.taskStates.has(taskId)) {
      this.taskStates.set(taskId, {
        currentSlotIndex: 0,
        switchHistory: [],
        estimatedTokens: 0,
      });
    }
    return this.taskStates.get(taskId)!;
  }

  /** Whether the switcher is active for this task (global enabled + task-level not disabled) */
  private isEnabledForTask(config: ModelContextSwitcherConfig, context: ExtensionContext): boolean {
    if (!config.enabled) return false;
    const taskContext = context.getTaskContext();
    if (!taskContext) return false;
    const metadata = (taskContext.data as any)?.metadata ?? {};
    // undefined = not set → inherit global; explicit false = disabled for task
    return metadata.switcherDisabled !== true;
  }

  /** Advance to the next configured slot, returns true if advanced */
  private advanceSlot(
    state: TaskState,
    config: ModelContextSwitcherConfig,
    reason: 'length' | 'threshold',
    context: ExtensionContext,
  ): boolean {
    const slots = config.slots.filter(s => s.model.trim() !== '');
    const nextIndex = state.currentSlotIndex + 1;
    if (nextIndex >= slots.length) return false;

    const from = slots[state.currentSlotIndex];
    const to = slots[nextIndex];

    state.switchHistory.push({
      fromLabel: from.label || from.model,
      toLabel: to.label || to.model,
      reason,
    });
    state.currentSlotIndex = nextIndex;

    const taskContext = context.getTaskContext();
    taskContext?.addLogMessage(
      'info',
      `🔀 Model Context Switcher: switching from **${from.label || from.model}** → **${to.label || to.model}** (reason: ${reason === 'length' ? 'context limit reached' : 'token threshold exceeded'})`,
    );

    context.triggerUIDataRefresh('switcher-display');
    return true;
  }

  /** Estimate token count from messages (4 chars ≈ 1 token) */
  private estimateTokens(messages: unknown[]): number {
    try {
      return Math.round(JSON.stringify(messages).length / 4);
    } catch {
      return 0;
    }
  }

  /** Get the currently active slot (only among configured ones) */
  private getActiveSlot(config: ModelContextSwitcherConfig, slotIndex: number): ModelSlot | null {
    const slots = config.slots.filter(s => s.model.trim() !== '');
    return slots[slotIndex] ?? null;
  }

  // ─── Task Events ───────────────────────────────────────────────────────────

  async onTaskCreated(event: TaskCreatedEvent, context: ExtensionContext): Promise<void> {
    const config = loadConfig(this.configPath);
    if (!config.resetOnNewTask) return;
    const taskId = event.task.id;
    this.taskStates.delete(taskId); // fresh state on creation
    context.log(`Task created: reset switcher state for ${taskId}`, 'debug');
  }

  async onTaskPrepared(event: TaskPreparedEvent, context: ExtensionContext): Promise<void> {
    const config = loadConfig(this.configPath);
    if (!config.resetOnNewTask) return;
    const taskId = event.task.id;
    // Only reset if no existing state (handles both new and loaded tasks)
    if (!this.taskStates.has(taskId)) {
      this.getTaskState(taskId); // initialise with defaults
    }
  }

  // ─── Agent Events ──────────────────────────────────────────────────────────

  async onAgentStarted(event: AgentStartedEvent, context: ExtensionContext): Promise<Partial<AgentStartedEvent>> {
    const config = loadConfig(this.configPath);
    if (!this.isEnabledForTask(config, context)) return {};

    const taskContext = context.getTaskContext();
    if (!taskContext) return {};

    const state = this.getTaskState(taskContext.data.id);
    const activeSlot = this.getActiveSlot(config, state.currentSlotIndex);

    if (!activeSlot) return {};

    context.log(`ModelContextSwitcher: using model ${activeSlot.model} (slot ${state.currentSlotIndex + 1})`, 'debug');
    return { model: activeSlot.model };
  }

  async onAgentStepStarted(event: AgentStepStartedEvent, context: ExtensionContext): Promise<Partial<AgentStepStartedEvent>> {
    const config = loadConfig(this.configPath);
    if (!this.isEnabledForTask(config, context)) return {};
    if (!config.switchOnThreshold) return {};

    const taskContext = context.getTaskContext();
    if (!taskContext) return {};

    const state = this.getTaskState(taskContext.data.id);
    const estimatedTokens = this.estimateTokens(event.messages);
    state.estimatedTokens = estimatedTokens;

    const slots = config.slots.filter(s => s.model.trim() !== '');
    const currentSlot = slots[state.currentSlotIndex];

    if (currentSlot && estimatedTokens > currentSlot.contextThreshold) {
      const advanced = this.advanceSlot(state, config, 'threshold', context);
      if (advanced) {
        // Return updated messages unchanged — model will be applied in next onAgentStarted
        context.triggerUIDataRefresh('switcher-display');
      }
    } else {
      context.triggerUIDataRefresh('switcher-display');
    }

    return {};
  }

  async onAgentStepFinished(event: AgentStepFinishedEvent, context: ExtensionContext): Promise<Partial<AgentStepFinishedEvent>> {
    const config = loadConfig(this.configPath);

    const taskContext = context.getTaskContext();
    if (taskContext) {
      context.triggerUIDataRefresh('switcher-display');
    }

    if (!this.isEnabledForTask(config, context)) return {};
    if (!config.switchOnLengthFinish) return {};
    if (event.finishReason !== 'length') return {};

    if (!taskContext) return {};
    const state = this.getTaskState(taskContext.data.id);
    this.advanceSlot(state, config, 'length', context);

    return {};
  }

  async onAgentFinished(_event: AgentFinishedEvent, context: ExtensionContext): Promise<void> {
    context.triggerUIDataRefresh('switcher-display');
  }

  // ─── UI ────────────────────────────────────────────────────────────────────

  getUIComponents(): UIComponentDefinition[] {
    return [
      {
        id: 'switcher-display',
        placement: 'task-usage-info-bottom',
        jsx: switcherDisplayJsx,
        loadData: true,
        noDataCache: true,
      },
    ];
  }

  async getUIExtensionData(componentId: string, context: ExtensionContext): Promise<unknown> {
    if (componentId !== 'switcher-display') return undefined;

    const config = loadConfig(this.configPath);
    const taskContext = context.getTaskContext();
    if (!taskContext) return undefined;

    const state = this.getTaskState(taskContext.data.id);
    const metadata = (taskContext.data as any)?.metadata ?? {};
    const taskEnabled = metadata.switcherDisabled !== true;

    const slots = config.slots.filter(s => s.model.trim() !== '');

    return {
      globalEnabled: config.enabled,
      enabled: config.enabled && taskEnabled,
      currentSlotIndex: state.currentSlotIndex,
      slots,
      switchHistory: state.switchHistory,
      estimatedTokens: state.estimatedTokens > 0 ? state.estimatedTokens : null,
    };
  }

  async executeUIExtensionAction(
    componentId: string,
    action: string,
    _args: unknown[],
    context: ExtensionContext,
  ): Promise<unknown> {
    if (componentId !== 'switcher-display') return undefined;

    if (action === 'toggle-task-switcher') {
      const taskContext = context.getTaskContext();
      if (!taskContext) return { success: false };

      const taskData = taskContext.data as any;
      const metadata = { ...(taskData.metadata ?? {}) };
      // undefined/false → true (disable); true → false (re-enable)
      metadata.switcherDisabled = metadata.switcherDisabled !== true;
      await taskContext.updateTask({ metadata });
      context.triggerUIDataRefresh('switcher-display');
      return { success: true };
    }

    return undefined;
  }
}
