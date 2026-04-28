import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Extension, ExtensionContext, AgentStepFinishedEvent, UIComponentDefinition, PromptSubmittedEvent, ToolCalledEvent, AgentStartedEvent } from '@aiderdesk/extensions';

const configComponentJsx = readFileSync(join(__dirname, './ConfigComponent.jsx'), 'utf-8');
const costDisplayJsx = readFileSync(join(__dirname, './CostDisplay.jsx'), 'utf-8');

interface CostLimiterConfig {
  maxCostUsd: number;
  enabled: boolean;
}

const DEFAULT_CONFIG: CostLimiterConfig = {
  maxCostUsd: 10,
  enabled: true,
};

export default class CostLimiterExtension implements Extension {
  static metadata = {
    name: 'Cost Limiter',
    version: '1.0.0',
    description: 'Limits the maximum cost of a task to prevent unexpected high costs from loops.',
    author: 'AiderDesk',
    capabilities: ['events', 'ui'],
  };

  private configPath: string;

  constructor() {
    this.configPath = join(__dirname, 'config.json');
  }

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('Cost Limiter Extension loaded', 'info');
  }

  getConfigComponent(_context: ExtensionContext): string {
    return configComponentJsx;
  }

  async getConfigData(_context: ExtensionContext): Promise<CostLimiterConfig> {
    try {
      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(data);
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch {
      // Ignore errors, fall back to defaults
    }
    return { ...DEFAULT_CONFIG };
  }

  async saveConfigData(configData: unknown, _context: ExtensionContext): Promise<unknown> {
    const merged: CostLimiterConfig = {
      ...DEFAULT_CONFIG,
      ...(configData as Partial<CostLimiterConfig>),
    };
    merged.maxCostUsd = Number(merged.maxCostUsd) || 10;
    writeFileSync(this.configPath, JSON.stringify(merged, null, 2), 'utf-8');
    return merged;
  }

  private async checkCostLimit(context: ExtensionContext, silent = false): Promise<{ blocked: boolean; message?: string }> {
    const config = await this.getConfigData(context);
    if (!config.enabled) return { blocked: false };

    const taskContext = context.getTaskContext();
    if (!taskContext) return { blocked: false };

    const taskData = taskContext.data as any;
    
    const taskLimit = taskData?.metadata?.costLimit;
    const effectiveLimit = taskLimit !== undefined && taskLimit !== '' ? Number(taskLimit) : config.maxCostUsd;

    const totalCost = (taskData?.aiderTotalCost ?? 0) + (taskData?.agentTotalCost ?? 0);

    if (totalCost >= effectiveLimit) {
      const msg = `Cost limit reached! Current cost: $${totalCost.toFixed(2)} (Limit: $${effectiveLimit.toFixed(2)}). Please increase the limit to continue.`;
      if (!silent) {
        taskContext.addLogMessage('error', msg);
      }
      return { blocked: true, message: msg };
    }

    return { blocked: false };
  }

  async onAgentStarted(event: AgentStartedEvent, context: ExtensionContext): Promise<Partial<AgentStartedEvent>> {
    const check = await this.checkCostLimit(context);
    if (check.blocked) {
      return { blocked: true };
    }
    return {};
  }

  async onPromptSubmitted(event: PromptSubmittedEvent, context: ExtensionContext): Promise<Partial<PromptSubmittedEvent>> {
    const check = await this.checkCostLimit(context, true); // Silent to avoid double logging with onAgentStarted
    if (check.blocked) {
      return { blocked: true };
    }
    return {};
  }

  async onToolCalled(event: ToolCalledEvent, context: ExtensionContext): Promise<Partial<ToolCalledEvent>> {
    const check = await this.checkCostLimit(context, true);
    if (check.blocked) {
      return { blocked: true };
    }
    return {};
  }

  async onAgentStepFinished(event: AgentStepFinishedEvent, context: ExtensionContext): Promise<Partial<AgentStepFinishedEvent>> {
    context.triggerUIDataRefresh('cost-display');
    const check = await this.checkCostLimit(context, true);
    if (check.blocked) {
      const taskContext = context.getTaskContext();
      if (taskContext) {
        await taskContext.interruptResponse().catch(() => {});
      }
      return { finishReason: 'stop' };
    }
    return {};
  }

  getUIComponents(): UIComponentDefinition[] {
    return [
      {
        id: 'cost-display',
        placement: 'task-usage-info-bottom',
        jsx: costDisplayJsx,
        loadData: true,
      }
    ];
  }

  async getUIExtensionData(componentId: string, context: ExtensionContext): Promise<unknown> {
    if (componentId === 'cost-display') {
      const config = await this.getConfigData(context);
      const taskContext = context.getTaskContext();
      if (!taskContext) return undefined;
      
      const taskData = taskContext.data as any;
      const totalCost = (taskData?.aiderTotalCost ?? 0) + (taskData?.agentTotalCost ?? 0);
      
      const taskLimit = taskData?.metadata?.costLimit;
      const effectiveLimit = taskLimit !== undefined && taskLimit !== '' ? Number(taskLimit) : config.maxCostUsd;
      
      return {
        currentCost: totalCost,
        limit: effectiveLimit,
        enabled: config.enabled
      };
    }
    return undefined;
  }

  async executeUIExtensionAction(componentId: string, action: string, args: unknown[], context: ExtensionContext): Promise<unknown> {
    if (componentId === 'cost-display' && action === 'update-task-limit') {
      const newLimit = args[0] as string;
      const taskContext = context.getTaskContext();
      if (taskContext) {
        const taskData = taskContext.data as any;
        const metadata = { ...(taskData.metadata || {}), costLimit: newLimit };
        await taskContext.updateTask({ metadata });
        context.triggerUIDataRefresh('cost-display');
      }
      return { success: true };
    }
    return undefined;
  }
}
