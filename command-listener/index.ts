import type {
  Extension,
  ExtensionContext,
  PromptFinishedEvent,
  ResponseCompletedEvent,
} from '@aiderdesk/extensions';

/**
 * Command Listener Extension
 *
 * Scans Aider response content for embedded command markers
 * and executes them via the current TaskContext.
 *
 * Detection happens in onResponseCompleted (per message), but execution
 * is deferred to onPromptFinished — after the agent has fully completed
 * and released its run-lock — to avoid a deadlock where compactConversation
 * would wait for the agent to finish while the agent is waiting for the
 * extension event handler to return.
 *
 * Supported markers:
 *   [AIDERDESK:compact]                       - compact conversation
 *   [AIDERDESK:compact:notes]                 - compact with optional instructions
 *   [AIDERDESK:rename:New Name]               - rename the current task
 *   [AIDERDESK:setModel:provider/model-name]  - change the model for the current task
 */

interface PendingCommand {
  command: string;
  args?: string;
}

export default class CommandListenerExtension implements Extension {
  static metadata = {
    name: 'Command Listener',
    version: '1.1.0',
    description:
      'Executes task commands (compact, rename, etc.) embedded in Aider responses',
    author: 'Appm.io',
    capabilities: ['events'],
  };

  /**
   * Per-promptContext queue of commands found in responses.
   * Keyed by promptContext.id so parallel tasks don't interfere.
   */
  private pendingCommands = new Map<string, PendingCommand[]>();

  async onResponseCompleted(
    event: ResponseCompletedEvent,
    context: ExtensionContext,
  ): Promise<void> {
    const content = event.response?.content;
    if (!content) {
      return;
    }

    const promptContextId = event.response?.promptContext?.id;
    if (!promptContextId) {
      return;
    }

    const commandRegex = /\[AIDERDESK:(\w+)(?::([^\]]*))?]/g;
    let match: RegExpExecArray | null;
    const found: PendingCommand[] = [];

    while ((match = commandRegex.exec(content)) !== null) {
      const command = match[1];
      const args = match[2]?.trim();
      found.push({ command, args });
      context.log('info', `Command Listener: queued command "${command}"${args ? ` (${args})` : ''}`);
    }

    if (found.length > 0) {
      const existing = this.pendingCommands.get(promptContextId) ?? [];
      this.pendingCommands.set(promptContextId, [...existing, ...found]);
    }
  }

  async onPromptFinished(
    event: PromptFinishedEvent,
    context: ExtensionContext,
  ): Promise<void> {
    // Collect all pending command sets and clear the map atomically
    if (this.pendingCommands.size === 0) {
      return;
    }

    const allCommands: PendingCommand[] = [];
    for (const commands of this.pendingCommands.values()) {
      allCommands.push(...commands);
    }
    this.pendingCommands.clear();

    if (allCommands.length === 0) {
      return;
    }

    const taskContext = context.getTaskContext();
    if (!taskContext) {
      context.log('warning', 'Command Listener: no task context available');
      return;
    }

    let executedCount = 0;

    for (const { command, args } of allCommands) {
      try {
        switch (command) {
          case 'compact': {
            await taskContext.compactConversation(args || undefined);
            context.log(
              'info',
              `Command Listener: compact executed${args ? ` (${args})` : ''}`,
            );
            executedCount++;
            break;
          }

          case 'rename': {
            if (args) {
              await taskContext.updateTask({ name: args });
              context.log('info', `Command Listener: task renamed to "${args}"`);
              executedCount++;
            } else {
              context.log('warning', 'Command Listener: rename received without a name');
            }
            break;
          }

          case 'setModel': {
            if (args) {
              await taskContext.updateTask({ model: args });
              context.log('info', `Command Listener: model changed to "${args}"`);
              executedCount++;
            } else {
              context.log('warning', 'Command Listener: setModel received without a model identifier');
            }
            break;
          }

          default: {
            context.log('warning', `Command Listener: unknown command "${command}"`);
          }
        }
      } catch (error) {
        context.log('error', `Command Listener: failed to run "${command}"`, {
          error: String(error),
        });
      }
    }

    if (executedCount > 0) {
      context.log('info', `Command Listener: ${executedCount} command(s) executed`);
    }
  }
}
