export function normalizeTimeToHHMM(time: string): string {
  if (!time) return '';
  // Handles formats like HH:MM or HH:MM:SS
  const parts = time.split(':');
  if (parts.length >= 2) {
    const hh = parts[0].padStart(2, '0');
    const mm = parts[1].padStart(2, '0');
    return `${hh}:${mm}`;
  }
  // Fallback: return as-is trimmed
  return time.trim();
}

export function timeToMinutes(time: string): number {
  const [hh, mm] = normalizeTimeToHHMM(time).split(':').map((v) => parseInt(v, 10) || 0);
  return hh * 60 + mm;
}

// Half-open interval overlap: [start1, end1) overlaps [start2, end2)
export function intervalsOverlap(
  slotStart: string,
  slotEnd: string,
  bookingStart: string,
  bookingEnd: string
): boolean {
  const s1 = timeToMinutes(slotStart);
  const e1 = timeToMinutes(slotEnd);
  const s2 = timeToMinutes(bookingStart);
  const e2 = timeToMinutes(bookingEnd);
  return s1 < e2 && e1 > s2;
}
