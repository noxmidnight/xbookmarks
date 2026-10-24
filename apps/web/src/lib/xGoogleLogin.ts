import { openInBrave } from "./braveBrowser";

const X_LOGIN_URL =
  "https://x.com/i/flow/login?redirect_after_login=%2Fhome";

/** X settings page to set a password (works after Google login in a real browser). */
export const X_PASSWORD_SETTINGS_URL = "https://x.com/settings/password";

export type GoogleLoginStepResult = {
  opened: boolean;
  brave: boolean;
};

/**
 * Google Sign-In cannot finish inside Android WebView.
 * Open X login in Brave so Google works; then the user sets an X password
 * and signs into the in-app Feed with username + that password.
 */
export async function openXGoogleLoginInBrave(): Promise<GoogleLoginStepResult> {
  const result = await openInBrave(X_LOGIN_URL);
  return { opened: result.opened, brave: result.brave };
}

export async function openXPasswordSettingsInBrave(): Promise<GoogleLoginStepResult> {
  const result = await openInBrave(X_PASSWORD_SETTINGS_URL);
  return { opened: result.opened, brave: result.brave };
}
