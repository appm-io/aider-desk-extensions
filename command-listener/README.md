# Command Listener Extension

An AiderDesk extension that listens for embedded command markers inside Aider chat responses and executes them automatically via the current task context.

## Why?

Aider cannot directly trigger actions like **compact conversation** or **rename task** from within its own response text. This extension bridges that gap by scanning every response for special markers and running the corresponding `TaskContext` API calls.

## Supported Commands

| Marker | Action |
|--------|--------|
| `[AIDERDESK:compact]` | Compact the current conversation |
| `[AIDERDESK:compact:some notes]` | Compact with optional instructions |
| `[AIDERDESK:rename:My New Task]` | Rename the current task |
| `[AIDERDESK:setModel:provider/model-name]` | Change the model for the current task |

## How to use

1. Install the extension in AiderDesk.
2. Instruct Aider (via system prompt or directly in chat) that it can trigger actions by outputting one of the markers above.
3. When Aider outputs a marker, the extension detects it and executes the command automatically.

### Example Aider prompt snippet

```
If you need to compact the conversation to save context, output [AIDERDESK:compact].
If you want to rename this task, output [AIDERDESK:rename:New Task Name].
If you want to switch the model, output [AIDERDESK:setModel:openai/gpt-4o].
```

## Requirements

- AiderDesk with Extension API support
- `@aiderdesk/extensions` types (provided by the host)
