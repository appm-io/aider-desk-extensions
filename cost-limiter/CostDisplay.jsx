({ data, executeExtensionAction }) => {
  if (!data || !data.enabled) return null;

  const { currentCost, limit } = data;
  const percentage = limit > 0 ? (currentCost / limit) * 100 : 0;
  
  let colorClass = "text-text-secondary";
  if (percentage >= 100) {
    colorClass = "text-error";
  } else if (percentage >= 80) {
    colorClass = "text-warning";
  }

  const handleLimitChange = (e) => {
    executeExtensionAction('update-task-limit', e.target.value);
  };

  return (
    <div className="flex items-center justify-between w-full mt-1 text-2xs px-2 py-1 bg-bg-secondary rounded">
      <span className="text-text-secondary">Cost Limit:</span>
      <div className="flex items-center gap-1">
        <span className={colorClass}>
          ${currentCost.toFixed(2)} /
        </span>
        <input
          type="number"
          min="0"
          step="1"
          className="w-14 px-1 py-0.5 bg-bg-primary border border-border-default rounded text-2xs text-text-primary focus:outline-none focus:border-brand-primary text-center"
          value={limit}
          onChange={handleLimitChange}
        />
        <span className={colorClass}>$</span>
      </div>
    </div>
  );
};
