const LEVELS = {
  EXPIRED: { label: 'Expired', cls: 'bg-red-100 text-red-900 border-red-300' },
  CRITICAL: { label: 'Use today (0-2d)', cls: 'bg-red-50 text-red-700 border-red-200' },
  WARNING: { label: 'Use first (3-6d)', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  WATCH: { label: 'Watch (7-14d)', cls: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
};

const ExpiryLevelBadge = ({ level, title }) => {
  const meta = LEVELS[level];
  if (!meta) return null;
  return (
    <span
      title={title}
      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${meta.cls}`}
    >
      {meta.label}
    </span>
  );
};

export default ExpiryLevelBadge;
