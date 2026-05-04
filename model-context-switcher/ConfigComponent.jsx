({ config, updateConfig, ui, models }) => {
  const { Input, Checkbox, Select, ModelSelector } = ui;

  const slots = config?.slots ?? [
    { model: '', label: 'Small', contextThreshold: 32000 },
    { model: '', label: 'Large', contextThreshold: 128000 },
    { model: '', label: 'XL',    contextThreshold: 999999 },
  ];

  const updateSlot = (index, field, value) => {
    const updated = slots.map((s, i) => i === index ? { ...s, [field]: value } : s);
    updateConfig({ ...config, slots: updated });
  };

  // Format price per 1M output tokens
  const formatPrice = (costPerToken) => {
    if (costPerToken == null) return null;
    const perMillion = costPerToken * 1_000_000;
    return `$${perMillion.toFixed(2)}/1M out`;
  };

  // Get model info for display
  const getModelInfo = (modelId) => {
    if (!modelId || !models) return null;
    const m = models.find(m => m.id === modelId);
    if (!m) return null;
    const parts = [];
    if (m.maxInputTokens) parts.push(`${(m.maxInputTokens / 1000).toFixed(0)}k ctx`);
    const price = formatPrice(m.outputCostPerToken);
    if (price) parts.push(price);
    return parts.length ? parts.join(' · ') : null;
  };

  return (
    <div className="flex flex-col gap-5">
      <Checkbox
        label="Enable Model Context Switcher"
        checked={config?.enabled ?? true}
        onChange={(checked) => updateConfig({ ...config, enabled: checked })}
      />

      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-text-primary">Model Slots (ordered small → large context)</p>
        <p className="text-xs text-text-secondary">Each slot activates when the previous slot's context threshold is exceeded.</p>
      </div>

      {slots.map((slot, i) => {
        const info = getModelInfo(slot.model);
        const isLast = i === slots.length - 1;
        return (
          <div key={i} className="flex flex-col gap-3 p-3 rounded border border-border-default bg-bg-secondary">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-text-primary w-6">{i + 1}.</span>
              <Input
                label="Label"
                value={slot.label}
                onChange={(e) => updateSlot(i, 'label', e.target.value)}
                placeholder={`Slot ${i + 1}`}
              />
            </div>

            <div className="flex flex-col gap-1">
              <ModelSelector
                label="Model"
                value={slot.model}
                onChange={(modelId) => updateSlot(i, 'model', modelId)}
                placeholder="Select a model..."
              />
              {info && (
                <p className="text-2xs text-text-muted ml-1">{info}</p>
              )}
            </div>

            {!isLast && (
              <Input
                label="Switch to next slot when context exceeds (tokens)"
                type="number"
                min="1000"
                step="1000"
                value={String(slot.contextThreshold)}
                onChange={(e) => updateSlot(i, 'contextThreshold', Number(e.target.value))}
                placeholder="32000"
              />
            )}
            {isLast && (
              <p className="text-2xs text-text-muted">Last slot — no threshold needed.</p>
            )}
          </div>
        );
      })}

      <div className="flex flex-col gap-2 pt-1 border-t border-border-default">
        <p className="text-xs font-medium text-text-primary">Switch Triggers</p>
        <Checkbox
          label="Switch when model hits context limit (finishReason = 'length')"
          checked={config?.switchOnLengthFinish ?? true}
          onChange={(checked) => updateConfig({ ...config, switchOnLengthFinish: checked })}
        />
        <Checkbox
          label="Switch when estimated context tokens exceed threshold"
          checked={config?.switchOnThreshold ?? true}
          onChange={(checked) => updateConfig({ ...config, switchOnThreshold: checked })}
        />
        <Checkbox
          label="Reset to first slot when a new task starts"
          checked={config?.resetOnNewTask ?? true}
          onChange={(checked) => updateConfig({ ...config, resetOnNewTask: checked })}
        />
      </div>
    </div>
  );
};
