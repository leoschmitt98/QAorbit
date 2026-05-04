const SENSITIVE_KEY_PATTERN = /\b(password|senha|token|authorization|auth|secret|cookie|email|login|username|usuario)\b/gi

export function clipText(value, maxLength = 8000) {
  const text = String(value || '').trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}\n...[log truncado pelo QA Orbit]`
}

export function sanitizeUrlFragments(value) {
  return String(value || '').replace(/(https?:\/\/[^\s"'`]+?)(\?[^\s"'`#]*)?(#[^\s"'`]*)?/gi, '$1')
}

export function sanitizeFreeText(value, maxLength) {
  let text = sanitizeUrlFragments(value)

  text = text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, key) => `{{${String(key).trim()}}}`)
  text = text.replace(/\b(password|senha)\b\s*[:=]\s*([^\s,'"`;]+)/gi, (_match, key) => `${key}={{password}}`)
  text = text.replace(/\b(usuario|username|user|login|email)\b\s*[:=]\s*([^\s,'"`;]+)/gi, (_match, key) => `${key}={{usuario}}`)
  text = text.replace(/\b(token|authorization|auth|secret|cookie)\b\s*[:=]\s*([^\s,'"`;]+)/gi, (_match, key) => `${key}=[masked]`)
  text = text.replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [masked]')

  return clipText(text, maxLength)
}

export function looksSensitiveName(value) {
  return SENSITIVE_KEY_PATTERN.test(String(value || ''))
}

export function sanitizeEnv(env = {}) {
  const safeEnv = {}

  for (const [key, value] of Object.entries(env || {})) {
    if (!key || key.includes('=')) continue
    safeEnv[key] = String(value ?? '')
  }

  return safeEnv
}

