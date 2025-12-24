/**
 * Birthday utility functions for parsing DOB and checking birthday windows
 */

export interface BirthdayInfo {
  month: number;
  day: number;
  isValid: boolean;
}

/**
 * Parse DOB string into month/day
 * Supports formats: yyyy-mm-dd, dd/mm/yyyy, mm/dd/yyyy
 * Returns null if invalid
 */
export function parseDOB(dob: string | null | undefined): BirthdayInfo | null {
  if (!dob || typeof dob !== 'string') {
    return null;
  }

  const trimmed = dob.trim();
  if (!trimmed) return null;

  // Try yyyy-mm-dd format (ISO date)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    
    if (isValidDate(month, day)) {
      return { month, day, isValid: true };
    }
  }

  // Try dd/mm/yyyy or mm/dd/yyyy format
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const part1 = parseInt(slashMatch[1], 10);
    const part2 = parseInt(slashMatch[2], 10);
    const year = parseInt(slashMatch[3], 10);

    // Try dd/mm first (more common internationally)
    if (isValidDate(part2, part1)) {
      return { month: part2, day: part1, isValid: true };
    }
    // Try mm/dd (US format)
    if (isValidDate(part1, part2)) {
      return { month: part1, day: part2, isValid: true };
    }
  }

  // Try mm/dd format (without year)
  const shortMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (shortMatch) {
    const month = parseInt(shortMatch[1], 10);
    const day = parseInt(shortMatch[2], 10);
    
    if (isValidDate(month, day)) {
      return { month, day, isValid: true };
    }
  }

  return null;
}

/**
 * Check if month/day combination is valid
 */
function isValidDate(month: number, day: number): boolean {
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  // Check day is valid for the month
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

/**
 * Check if birthday falls within the next N days (allowing wrap-around year end)
 * @param dob - Date of birth string
 * @param withinDays - Number of days to check ahead
 * @returns true if birthday is within the window
 */
export function isBirthdayWithinDays(dob: string | null | undefined, withinDays: number): boolean {
  const birthday = parseDOB(dob);
  if (!birthday) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of day

  // Calculate target date
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + withinDays);

  // Check birthday this year
  const birthdayThisYear = new Date(today.getFullYear(), birthday.month - 1, birthday.day);
  birthdayThisYear.setHours(0, 0, 0, 0);

  // Check birthday next year (for wrap-around)
  const birthdayNextYear = new Date(today.getFullYear() + 1, birthday.month - 1, birthday.day);
  birthdayNextYear.setHours(0, 0, 0, 0);

  // If birthday this year has already passed, check next year
  if (birthdayThisYear < today) {
    // Birthday already passed this year, check if next year's birthday is within window
    return birthdayNextYear <= targetDate;
  }

  // Birthday hasn't passed this year, check if it's within window
  return birthdayThisYear <= targetDate;
}

