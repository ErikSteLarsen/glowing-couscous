'use client';

import { Dialog, DialogClose, DialogContent, DialogTitle } from '@ui-sdk/react/dialog';
import { Cloud, FileUp, PencilLine, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/tempo/Menu';
import { iconButtonClassName, primaryButtonClassName, sectionHeadingClassName } from '@/components/ui';
import { ManualActivityForm } from './ManualActivityForm';

const getHash = () => window.location.hash;
const getServerHash = () => '';

function subscribeToHash(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export function AddActivity({ today }: { today: string }) {
  const router = useRouter();
  const [logging, setLogging] = useState(false);
  const hash = useSyncExternalStore(subscribeToHash, getHash, getServerHash);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (hash === '#import-activity') router.replace('/athlete/import?from=activity&summary=1#import-summary');
  }, [hash, router]);

  function updateLogging(open: boolean) {
    if (!open && hash === '#log-activity') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
    setLogging(open);
  }

  return (
    <>
      <Menu>
        <MenuTrigger ref={trigger} className={`${primaryButtonClassName} max-md:min-h-11`}>
          <Plus size={16} aria-hidden="true" /> Add activity
        </MenuTrigger>
        <MenuContent align="end">
          <MenuItem onSelect={() => setLogging(true)}>
            <PencilLine size={16} aria-hidden="true" /> Log manually
          </MenuItem>
          <MenuItem render={<Link href="/athlete/import?from=activity#activity-files" />}>
            <FileUp size={16} aria-hidden="true" /> Import a file
          </MenuItem>
          <MenuItem render={<Link href="/athlete/import?from=activity#strava" />}>
            <Cloud size={16} aria-hidden="true" /> From Strava
          </MenuItem>
        </MenuContent>
      </Menu>
      <Dialog open={logging || hash === '#log-activity'} onOpenChange={updateLogging}>
        <DialogContent
          keepMounted
          initialFocus="content"
          finalFocus={() => trigger.current}
          className="tempo-alert-dialog h-fit w-[calc(100%-2rem)] max-w-xl space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--text)] shadow-[var(--shadow-overlay)]"
        >
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className={sectionHeadingClassName}>Log completed workout</DialogTitle>
            <DialogClose aria-label="Close manual log" className={iconButtonClassName}><X size={18} aria-hidden="true" /></DialogClose>
          </div>
          <ManualActivityForm today={today} />
        </DialogContent>
      </Dialog>
    </>
  );
}
