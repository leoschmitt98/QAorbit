export const AUTOMATION_TYPES = ['web-e2e', 'api', 'performance', 'security']
export const AUTOMATION_FRAMEWORKS = ['cypress', 'playwright', 'selenium']
export const AUTOMATION_LANGUAGES = ['javascript', 'typescript', 'java', 'python']
export const AUTOMATION_PATTERNS = ['simple', 'pageObject', 'gherkin']
export const AUTOMATION_STEP_ACTIONS = ['visit', 'click', 'fill', 'select', 'assertText', 'assertUrl', 'wait']

export function pushWarning(warnings, code, message, stepOrder = null) {
  warnings.push({
    code,
    level: 'warning',
    message,
    stepOrder,
  })
}

export function isPlaceholderValue(value) {
  return /^\{\{[^{}]+\}\}$/.test(String(value || '').trim())
}

export function sanitizeSlug(value, fallback = 'qa-orbit-automation') {
  const slug = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || fallback
}

export function sanitizeSuiteName(value) {
  const cleaned = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 _-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return cleaned || 'QA Orbit Automation'
}

export function ensureExtension(fileName, extension, fallbackSlug) {
  const raw = String(fileName || '').trim()
  const normalizedExtension = extension.startsWith('.') ? extension : `.${extension}`
  const escapedExtension = normalizedExtension.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const baseName = raw.replace(new RegExp(`${escapedExtension}$`, 'i'), '')

  return `${sanitizeSlug(baseName, fallbackSlug)}${normalizedExtension}`
}

