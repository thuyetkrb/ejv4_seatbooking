export const TEAM_COLORS: Record<string, string> = {
  'PgM': '#78350f', // Brown
  'Honda': '#22c55e', // Green
  'Nissan': '#3b82f6', // Blue
  'FFV': '#eab308', // Yellow
  'VCCU': '#ec4899', // Pink
  'Suzuki': '#f97316', // Orange
  'Admin': '#64748b',
  'Default': '#f1f5f9',
};

export const WORKING_MODE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  'WFO': { label: 'Office', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  'WFH': { label: 'Home', color: 'text-blue-700', bg: 'bg-blue-100' },
  'LEAVE': { label: 'Leave', color: 'text-rose-700', bg: 'bg-rose-100' },
  'FLEXID': { label: 'FlexiD', color: 'text-slate-700', bg: 'bg-slate-200' },
  'HOLIDAY': { label: 'Holiday', color: 'text-purple-700', bg: 'bg-purple-100' },
};

export const ZONES = ['A', 'B', 'C', 'D', 'EPS', 'ETA'];
