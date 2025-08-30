// DateTime utilities for consistent timestamp formatting

/**
 * Format a date to local time string: mm-dd-yyyy hh:mm:ss
 */
export function formatLocalTimestamp(date?: Date | number | string): string {
  const d = date ? new Date(date) : new Date()
  
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const year = d.getFullYear()
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')
  
  return `${month}-${day}-${year} ${hours}:${minutes}:${seconds}`
}

/**
 * Format a date for file/document timestamps (ISO-like but local)
 */
export function formatDocumentDate(date?: Date | number | string): string {
  return formatLocalTimestamp(date)
}

/**
 * Get current timestamp in local format
 */
export function getCurrentTimestamp(): string {
  return formatLocalTimestamp(new Date())
}

/**
 * Format time only (for TUI): hh:mm:ss
 */
export function formatTimeOnly(date?: Date | number | string): string {
  const d = date ? new Date(date) : new Date()
  
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')
  
  return `${hours}:${minutes}:${seconds}`
}

export default {
  formatLocalTimestamp,
  formatDocumentDate,
  getCurrentTimestamp,
  formatTimeOnly
}