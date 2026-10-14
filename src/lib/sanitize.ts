/**
 * Removes all undefined fields from an object so Firestore setDoc/updateDoc
 * will never fail with "Function setDoc() called with invalid data. Unsupported field value: undefined"
 */
export function sanitizePayload<T extends Record<string, unknown>>(data: T): Partial<T> {
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) {
      if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
        clean[key] = sanitizePayload(val as Record<string, unknown>);
      } else {
        clean[key] = val;
      }
    }
  }
  return clean as Partial<T>;
}
