import { buttonFocusClassName, compactPrimaryButtonClassName, ghostButtonClassName } from '@/components/ui';

const linkClassName = `rounded-sm underline underline-offset-2 hover:text-[var(--text)] ${buttonFocusClassName}`;

function ExternalTextLink({ href, children }: { href: string; children: string }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className={linkClassName}>{children}</a>;
}

const termsLink = <ExternalTextLink href="https://www.youtube.com/t/terms">YouTube Terms of Service</ExternalTextLink>;

/** Unfolds in place: a page of its own would leave the ride in the TempoBuilder Ride app. */
function PrivacyNotice() {
  return (
    <details className="min-w-0 open:basis-full">
      <summary className={`w-fit cursor-pointer ${linkClassName}`}>YouTube privacy notice</summary>
      <div className="mt-2 flex max-w-prose flex-col gap-1.5 leading-relaxed">
        <p>TempoBuilder uses YouTube API Services to check the video you pick and YouTube’s player to show it.</p>
        <p>TempoBuilder’s server sends YouTube the video’s ID, not your name, account or ride data. It keeps the video’s details for up to an hour and counts your lookups for a short time to limit them. TempoBuilder doesn’t access your YouTube account.</p>
        <p>This browser keeps your recently played videos for up to 30 days (Clear removes them), your place in the video for this tab, your choices here and a key for the Send to TempoBuilder bookmark.</p>
        <p>The player and thumbnails load from YouTube, which receives your IP address and browser details, may show ads, and may store or read cookies and similar data on your device. Google handles that under the <ExternalTextLink href="https://policies.google.com/privacy">Google Privacy Policy</ExternalTextLink>.</p>
      </div>
    </details>
  );
}

/** Asked once per account and browser, when the rider first opens a video. */
export function YouTubeConsent({ onAccept, onCancel }: { onAccept: () => void; onCancel: () => void }) {
  return (
    <section aria-label="Before you watch" className="flex flex-col gap-3 rounded-xl border border-[var(--border)] p-4 text-[13px] text-[var(--text-secondary)]">
      <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="min-w-[16rem] flex-1">Videos play through YouTube. By continuing, you agree to the {termsLink} and the privacy notice below.</p>
        <span className="flex gap-2">
          <button type="button" className={ghostButtonClassName('compact')} onClick={onCancel}>Not now</button>
          <button type="button" className={compactPrimaryButtonClassName} onClick={onAccept}>Agree and play</button>
        </span>
      </div>
      <div className="text-xs"><PrivacyNotice /></div>
    </section>
  );
}

/** YouTube's logo (linked, as its branding rules ask), terms and privacy at the end of the picker. */
export function YouTubeFooter({ showPrivacy }: { showPrivacy: boolean }) {
  return (
    <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--text-muted)]">
      <a href="https://www.youtube.com/" target="_blank" rel="noopener noreferrer" className={`rounded-sm p-1 ${buttonFocusClassName}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a small static logo */}
        <img src="/youtube-logo.png" alt="YouTube" className="h-6 w-auto" />
      </a>
      {termsLink}
      {showPrivacy ? <PrivacyNotice /> : null}
    </footer>
  );
}
