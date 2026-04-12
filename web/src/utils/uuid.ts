/**
 * Generate a UUID, with fallback for non-secure contexts (HTTP).
 * `crypto.randomUUID()` is only available in secure contexts (HTTPS/localhost).
 */
export function uuid(): string {
    if (typeof crypto?.randomUUID === 'function') {
        return crypto.randomUUID()
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}
