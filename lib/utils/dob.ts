/**
 * Normalize DOB string to YYYY-MM-DD format
 * Accepts various date formats and converts to YYYY-MM-DD
 * @param dob - Date of birth string in any format
 * @returns Normalized DOB in YYYY-MM-DD format or null if invalid
 */
export function normalizeDOB(dob: string | null | undefined): string | null {
  if (!dob || typeof dob !== 'string') {
    return null;
  }

  const trimmed = dob.trim();
  if (!trimmed) return null;

  // If already in YYYY-MM-DD format, validate and return
  const yyyyMmDdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyyMmDdMatch) {
    const year = parseInt(yyyyMmDdMatch[1], 10);
    const month = parseInt(yyyyMmDdMatch[2], 10);
    const day = parseInt(yyyyMmDdMatch[3], 10);
    
    // Validate date
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return trimmed; // Already in correct format
    }
  }

  // Try to parse as Date object (handles various formats)
  const date = new Date(trimmed);
  if (!isNaN(date.getTime())) {
    // Check if the parsed date makes sense (not too far in future/past)
    const year = date.getFullYear();
    if (year >= 1900 && year <= 2100) {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  // Try dd/mm/yyyy or mm/dd/yyyy format
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const part1 = parseInt(slashMatch[1], 10);
    const part2 = parseInt(slashMatch[2], 10);
    const year = parseInt(slashMatch[3], 10);

    // Try dd/mm/yyyy first (more common internationally)
    let month = part2;
    let day = part1;
    let date = new Date(year, month - 1, day);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day &&
      year >= 1900 &&
      year <= 2100
    ) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    // Try mm/dd/yyyy (US format)
    month = part1;
    day = part2;
    date = new Date(year, month - 1, day);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day &&
      year >= 1900 &&
      year <= 2100
    ) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // If we can't parse it, return null (invalid format)
  return null;
}

/**
 * Format DOB for display (ensures YYYY-MM-DD format)
 * @param dob - Date of birth string
 * @returns Formatted DOB in YYYY-MM-DD format or 'N/A' if invalid
 */
export function formatDOBForDisplay(dob: string | null | undefined): string {
  if (!dob) return 'N/A';
  
  // If it includes 'T' (ISO datetime), extract date part
  if (dob.includes('T')) {
    return dob.split('T')[0];
  }
  
  // Try to normalize it
  const normalized = normalizeDOB(dob);
  return normalized || dob; // Return normalized if valid, otherwise return original
}


