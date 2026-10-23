/** Only this email may use the private XBookmarks PWA (set VITE_OWNER_EMAIL). */
export const OWNER_EMAIL = (import.meta.env.VITE_OWNER_EMAIL || "")
  .trim()
  .toLowerCase();

export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === OWNER_EMAIL;
}
