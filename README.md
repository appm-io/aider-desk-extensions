# AiderDesk Extensions

A collection of extensions for [AiderDesk](https://github.com/hotovo/aider-desk) that add extra capabilities to your AI coding workflow.

## Available Extensions

### 💰 Cost Limiter

Prevents unexpected high API costs by setting a maximum spend limit per task.

- Configurable cost limit (USD) per task or globally
- Hard stop when limit is reached — blocks prompts, tool calls, and agent steps
- Real-time cost display in the task UI

### 🔀 Model Context Switcher

Automatically escalates to models with larger context windows as your conversation grows.

- Define up to 3 model slots ordered from smallest to largest context
- Switches automatically when the model hits its context limit (`finishReason = 'length'`)
- Switches automatically when estimated token count exceeds a configurable threshold
- Per-task ON/OFF toggle directly in the task UI
- Switch history visible in the task UI (how many switches, from → to, reason)
- Config UI shows model context size and output price per 1M tokens as a nomenclator

---

## Installation

You can install these extensions directly into AiderDesk by adding this repository:

1. Open AiderDesk and click **Settings** (gear icon) in the bottom left.
2. Navigate to the **Extensions** tab.
3. Under **Repositories**, add the URL of this GitHub repository.
4. Click **Save** and wait for the extensions to download.
5. Reload the AiderDesk window.

---

## Cost Limiter — Usage

1. Open AiderDesk **Settings** → **Extensions**.
2. Find **Cost Limiter** and click the gear icon to open configuration.
3. Enable and set your **Maximum Cost (USD)** (default: $10).
4. Click **Save**.

The extension monitors task cost in real time. If the cost exceeds the limit, the agent stops and an error message appears in the chat. You can override the limit per task directly in the task UI.

---

## Model Context Switcher — Usage

1. Open AiderDesk **Settings** → **Extensions**.
2. Find **Model Context Switcher** and click the gear icon to open configuration.
3. Configure up to 3 model slots:
   - **Slot 1**: your preferred model for normal conversations (e.g. a fast, cheap model)
   - **Slot 2**: a model with a larger context window for when Slot 1 hits its limit
   - **Slot 3**: the largest context model as a final fallback
4. Set the **context threshold** for Slot 1 and Slot 2 (the token count at which the switcher escalates to the next slot).
5. Choose your switch triggers: on context limit hit, on threshold, or both.
6. Click **Save**.

**Per-task toggle**: Each task shows a `Model Switcher: ON / OFF` button in the task usage area. Click it to disable the switcher for a specific task without changing global settings.

---

## Development

Extensions are built using the [AiderDesk Extension API](https://github.com/hotovo/aider-desk/blob/main/packages/common/src/extensions.ts).
