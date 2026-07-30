function easterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function toKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getBrazilianHolidays(year: number): Set<string> {
  const holidays = new Set<string>();

  const fixed = [
    [0, 1],   // Confraternização Universal
    [3, 21],  // Tiradentes
    [4, 1],   // Dia do Trabalho
    [8, 7],   // Independência
    [9, 12],  // Nossa Senhora Aparecida
    [10, 2],  // Finados
    [10, 15], // Proclamação da República
    [11, 25], // Natal
  ];

  for (const [month, day] of fixed) {
    holidays.add(toKey(new Date(year, month, day)));
  }

  const easter = easterDate(year);
  holidays.add(toKey(addDays(easter, -47))); // Carnaval (segunda)
  holidays.add(toKey(addDays(easter, -46))); // Carnaval (terça)
  holidays.add(toKey(addDays(easter, -2)));  // Sexta-feira Santa
  holidays.add(toKey(addDays(easter, 60)));  // Corpus Christi

  return holidays;
}

export function countBusinessDays(start: Date, end: Date): number {
  if (!start || !end || end < start) return 0;

  const years = new Set<number>();
  const cursor = new Date(start);
  while (cursor <= end) {
    years.add(cursor.getFullYear());
    cursor.setFullYear(cursor.getFullYear() + 1);
  }

  const holidays = new Set<string>();
  for (const y of years) {
    for (const h of getBrazilianHolidays(y)) {
      holidays.add(h);
    }
  }

  let count = 0;
  const current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.has(toKey(current))) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}
