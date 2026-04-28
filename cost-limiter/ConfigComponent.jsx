({ config, updateConfig, ui }) => {
  const { Input, Checkbox } = ui;

  return (
    <div className="flex flex-col gap-4">
      <Checkbox
        label="Enable Cost Limiter"
        checked={config?.enabled ?? true}
        onChange={(checked) => updateConfig({ ...config, enabled: checked })}
      />
      <Input
        label="Maximum Cost (USD)"
        type="number"
        min="0"
        step="0.1"
        value={config?.maxCostUsd !== undefined ? config.maxCostUsd : 10}
        onChange={(e) => {
          const val = e && typeof e === 'object' && e.target ? e.target.value : e;
          updateConfig({ ...config, maxCostUsd: val });
        }}
        placeholder="10.00"
      />
      <p className="text-xs text-text-secondary -mt-2">
        If the task's total cost exceeds this amount, further prompts and tool executions will be blocked.
      </p>
    </div>
  );
};
