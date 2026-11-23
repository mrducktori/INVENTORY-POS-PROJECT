const LEVELS = {
  EXPIRED: { label: 'Expired', dot: 'bg-red-500', strong: true },
  CRITICAL: { label: 'Use today (0-2d)', dot: 'bg-red-500', strong: true },
  WARNING: { label: 'Use first (3-6d)', dot: 'bg-amber-500' },
  WATCH: { label: 'Watch (7-14d)', dot: 'bg-zinc-400' },
};

const ExpiryLevelBadge = ({ level, title }) => {
  const meta = LEVELS[level];
  if (!meta) return null;
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 text-[11px] whitespace-nowrap ${meta.strong ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-600'}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
      {meta.label}
    </span>
  );
};

export default ExpiryLevelBadge;
