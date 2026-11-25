/** Bump when the notice changes in a way riders must agree to again. */
const VERSION = '1';

export const youTubeConsentKey = (userId: number) => `tempo.ride.youtube.consent.${userId}`;

/** Whether this account agreed, in this browser, to YouTube's terms and the YouTube privacy notice. */
export function hasYouTubeConsent(userId: number): boolean {
  try {
    return window.localStorage.getItem(youTubeConsentKey(userId)) === VERSION;
  } catch {
    return false;
  }
}

export function saveYouTubeConsent(userId: number): void {
  try {
    window.localStorage.setItem(youTubeConsentKey(userId), VERSION);
  } catch {
    // Without storage the rider is asked again next time.
  }
}
