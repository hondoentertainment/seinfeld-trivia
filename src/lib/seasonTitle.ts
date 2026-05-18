export function seasonTitle(s: number) {
  if (s === 0) return "Pilot";
  if (s === 10) return "Internet extras";
  return `Season ${s}`;
}
