'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TIME_ZONE_COOKIE } from '@/lib/user-time';

function readCookie(name: string) {
  const entry = document.cookie.split('; ').find((cookie) => cookie.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null;
}

/** Reports the browser's time zone so server-rendered "today" matches the user's calendar. */
export function TimeZoneSync() {
  const router = useRouter();

  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timeZone || readCookie(TIME_ZONE_COOKIE) === timeZone) return;
    const secure = window.location.protocol === 'https:' ? '; secure' : '';
    document.cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(timeZone)}; path=/; max-age=31536000; samesite=lax${secure}`;
    router.refresh();
  }, [router]);

  return null;
}
