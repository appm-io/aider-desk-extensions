import type {
  Extension,
  ExtensionContext,
  ResponseCompletedEvent,
} from '@aiderdesk/extensions';

/**
 * Command Listener Extension
 *
 * Scans Aider response content for embedded command markers
 * and executes them via the current TaskContext.
 *
 * Supported markers:
 *   [AIDERDESK:compact]                       - compact conversation
 *   [AIDERDESK:compact:notes]                - compact with optional instructions
 *   [AIDERDESK:rename:New Name]              - rename the current task
 *   [AIDERDESK:setModel:provider/model-name]  - change the model for the current task
 */
export default class CommandListenerExtension implements Extension {
  static metadata = {
    name: 'Command Listener',
    version: '1.0.1',
    description:
      'Executes task commands (compact, rename, etc.) embedded in Aider responses',
    author: 'Appm.io',
    capabilities: ['events'],
  };

  async onResponseCompleted(
    event: ResponseCompletedEvent,
    context: ExtensionContext,
  ): Promise<void> {
    const content = event.response?.content;
    if (!content) {
      return;
    }

    const taskContext = context.getTaskContext();
    if (!taskContext) {
      context.log('warning', 'Command Listener: no task context available');
      return;
    }

    const commandRegex = /\[AIDERDESK:(\w+)(?::([^\]]*))?\]/g;
    let match: RegExpExecArray | null;
    let executedCount = 0;

    while ((match = commandRegex.exec(content)) !== null) {
      const command = match[1];
      const args = match[2]?.trim();

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
              context.log(
                'info',
                `Command Listener: task renamed to "${args}"`,
              );
              executedCount++;
            } else {
              context.log(
                'warning',
                'Command Listener: rename received without a name',
              );
            }
            break;
          }

          case 'setModel': {
            if (args) {
              await taskContext.updateTask({ model: args });
              context.log(
                'info',
                `Command Listener: model changed to "${args}"`,
              );
              executedCount++;
            } else {
              context.log(
                'warning',
                'Command Listener: setModel received without a model identifier',
              );
            }
            break;
          }

          default: {
            context.log(
              'warning',
              `Command Listener: unknown command "${command}"`,
            );
          }
        }
      } catch (error) {
        context.log('error', `Command Listener: failed to run "${command}"`, {
          error: String(error),
        });
      }
    }

    if (executedCount > 0) {
      context.log(
        'info',
        `Command Listener: ${executedCount} command(s) executed`,
      );
    }
  }
}
