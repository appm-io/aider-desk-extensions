# AiderDesk Cost Limiter Extension

An extension for [AiderDesk](https://github.com/hotovo/aider-desk) that prevents unexpected high API costs by setting a maximum spend limit for tasks. 

If the agent gets stuck in a loop or uses too many expensive tokens, this extension will automatically stop the conversation when the limit is reached.

## Features

- 💰 **Configurable Limit**: Set your own maximum cost (in USD) directly from the AiderDesk settings interface.
- 🛑 **Hard Stop**: Immediately interrupts the agent's response and blocks further prompts or tool calls once the limit is exceeded.
- 📊 **Real-time Display**: Shows a live progress bar of your current cost vs the limit right in the task UI.

## Installation

You can install this extension directly into AiderDesk by adding this repository to your Extensions list:

1. Open AiderDesk and click the **Settings** (gear icon) in the bottom left.
2. Navigate to the **Extensions** tab.
3. Under **Repositories**, add the URL of this GitHub repository.
4. Click **Save** and wait for the extension to download.
5. Reload the AiderDesk window.

## Usage

1. Open AiderDesk **Settings** -> **Extensions**.
2. Find **Cost Limiter** in the list of installed extensions and click the gear icon next to it to open its configuration.
3. Check the **Enable Cost Limiter** box.
4. Set your desired **Maximum Cost (USD)** (default is 10.00).
5. Click **Save**.

The extension will now actively monitor the total cost of your current task. You will see a live indicator at the bottom of the task screen. If the cost exceeds your limit, the agent will be stopped and you will see a red error message in the chat.

## Development

This extension was built using the AiderDesk Extension API. It uses:
- `onAgentStepFinished` to monitor the cost after each agent action and trigger a hard stop (`finishReason: 'stop'` & `interruptResponse()`).
- `onPromptSubmitted`, `onToolCalled`, and `onAgentStarted` to block any new actions once the limit is reached.
- `getConfigComponent` and `getConfigData` to provide a settings UI.
- `getUIComponents` to render the live cost display in the `task-usage-info-bottom` placement.
