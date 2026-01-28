/**
 * Severity Level Definitions
 * Denetim bulguları için önem seviyeleri
 */

export const SEVERITY = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
};

export const SEVERITY_PRIORITY = {
  error: 3,
  warning: 2,
  info: 1,
};

export const SEVERITY_ICONS = {
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
};

export const SEVERITY_COLORS = {
  error: '\x1b[31m', // Red
  warning: '\x1b[33m', // Yellow
  info: '\x1b[36m', // Cyan
  reset: '\x1b[0m',
};

/**
 * Create a finding object
 * @param {Object} options - Finding options
 * @returns {Object} Finding object
 */
export function createFinding(options) {
  return {
    severity: options.severity || SEVERITY.INFO,
    message: options.message || '',
    file: options.file || null,
    line: options.line || null,
    column: options.column || null,
    rule: options.rule || null,
    snippet: options.snippet || null,
    suggestion: options.suggestion || null,
    ...options,
  };
}

/**
 * Determine overall status from findings
 * @param {Array} findings - Array of findings
 * @returns {string} Status ('passed' | 'warning' | 'error')
 */
export function determineStatus(findings) {
  if (!findings || findings.length === 0) return 'passed';

  const hasError = findings.some((f) => f.severity === SEVERITY.ERROR);
  if (hasError) return 'error';

  const hasWarning = findings.some((f) => f.severity === SEVERITY.WARNING);
  if (hasWarning) return 'warning';

  return 'passed';
}

/**
 * Get highest severity from findings
 * @param {Array} findings - Array of findings
 * @returns {string} Highest severity level
 */
export function getHighestSeverity(findings) {
  if (!findings || findings.length === 0) return SEVERITY.INFO;

  let highest = SEVERITY.INFO;
  for (const finding of findings) {
    if (SEVERITY_PRIORITY[finding.severity] > SEVERITY_PRIORITY[highest]) {
      highest = finding.severity;
    }
  }
  return highest;
}

/**
 * Count findings by severity
 * @param {Array} findings - Array of findings
 * @returns {Object} Counts by severity
 */
export function countBySeverity(findings) {
  const counts = {
    error: 0,
    warning: 0,
    info: 0,
    total: findings?.length || 0,
  };

  if (!findings) return counts;

  for (const finding of findings) {
    if (counts[finding.severity] !== undefined) {
      counts[finding.severity]++;
    }
  }

  return counts;
}
