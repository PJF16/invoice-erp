const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_DATE = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/;

function validDateParts(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** Accepts ISO dates as well as the date format users type in the German UI. */
export function normalizeDateInput(value: string): string | null {
  const trimmed = value.trim();
  const isoMatch = ISO_DATE.exec(trimmed);
  const match = isoMatch ?? LOCAL_DATE.exec(trimmed);
  if (!match) return null;

  const iso = isoMatch
    ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
    : { year: Number(match[3]), month: Number(match[2]), day: Number(match[1]) };

  if (!validDateParts(iso.year, iso.month, iso.day)) return null;
  return `${String(iso.year).padStart(4, "0")}-${String(iso.month).padStart(2, "0")}-${String(iso.day).padStart(2, "0")}`;
}

export function formatLocalizedDateInput(value: string): string {
  const iso = normalizeDateInput(value);
  if (!iso) return value;
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

export function parseLocalizedNumber(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatLocalizedNumber(value: number): string {
  return String(value).replace(".", ",");
}
