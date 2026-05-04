({ data, executeExtensionAction }) => {
  if (!data) return null;

  const { enabled, globalEnabled, currentSlotIndex, slots, switchHistory, estimatedTokens } = data;

  // If the global extension is disabled, show nothing
  if (!globalEnabled) return null;

  const activeSlot = slots?.[currentSlotIndex];
  const totalSwitches = switchHistory?.length ?? 0;

  const { useState } = React;
  const [showHistory, setShowHistory] = useState(false);

  const handleToggle = () => {
    executeExtensionAction('toggle-task-switcher');
  };

  const formatTokens = (n) => {
    if (n == null) return '?';
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  };

  const reasonLabel = (reason) => {
    if (reason === 'length') return 'ctx limit';
    if (reason === 'threshold') return 'threshold';
    return reason;
  };

  return (
    <div className="flex flex-col w-full mt-1 text-2xs px-2 py-1 bg-bg-secondary rounded gap-1">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <span className="text-text-secondary">Model Switcher:</span>
          {enabled ? (
            <span className="text-text-primary font-medium">
              {activeSlot
                ? `Slot ${currentSlotIndex + 1}/${slots.length} · ${activeSlot.label}`
                : 'Not configured'}
            </span>
          ) : (
            <span className="text-text-muted italic">disabled for this task</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {enabled && estimatedTokens != null && (
            <span className="text-text-muted" title="Estimated context tokens">
              ~{formatTokens(estimatedTokens)} tokens
            </span>
          )}
          {enabled && totalSwitches > 0 && (
            <button
              className="text-brand-primary hover:underline focus:outline-none"
              onClick={() => setShowHistory(h => !h)}
            >
              {totalSwitches} switch{totalSwitches !== 1 ? 'es' : ''}
            </button>
          )}
          <button
            className={`px-1.5 py-0.5 rounded text-2xs font-medium border transition-colors focus:outline-none ${
              enabled
                ? 'border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-bg-primary'
                : 'border-border-default text-text-muted hover:border-text-muted hover:text-text-secondary'
            }`}
            onClick={handleToggle}
            title={enabled ? 'Disable switcher for this task' : 'Enable switcher for this task'}
          >
            {enabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {enabled && showHistory && switchHistory && switchHistory.length > 0 && (
        <div className="flex flex-col gap-0.5 pt-1 border-t border-border-default">
          {switchHistory.map((entry, i) => (
            <div key={i} className="flex items-center gap-1 text-text-muted">
              <span className="text-text-secondary">#{i + 1}</span>
              <span>{entry.fromLabel}</span>
              <span>→</span>
              <span className="text-text-primary">{entry.toLabel}</span>
              <span className="ml-auto text-text-muted">({reasonLabel(entry.reason)})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
