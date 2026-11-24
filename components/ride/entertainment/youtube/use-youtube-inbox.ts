'use client';

import { useEffect, useEffectEvent, useState } from 'react';

import { listenForSentVideos } from '@/lib/youtube/send-to-ride';
import { findYouTubeLink, parseYouTubeLink } from '@/lib/youtube/youtube-url';

/** A video brought into the ride from outside Tempo. `videoId` null: a link dropped on the panel that isn't a YouTube video. */
export type IncomingYouTubeVideo = { seq: number; videoId: string | null; startSec?: number };

type Delivery = { videoId: string; startSec?: number } | null;

/** How long after the last dragover the drop highlight stays (dragover repeats about every 50 ms). */
const DRAG_LINGER_MS = 250;
// The YouTube panel carries `data-youtube-panel`, so a link dropped on it that isn't a video can say so.

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'))
    || (target instanceof HTMLElement && target.isContentEditable);
}

/** A modal dialog (Connections, the phone's More sheet) has the screen: links pasted or dropped then are not for the ride. */
function dialogOpen(): boolean {
  return document.querySelector('dialog[open]') !== null;
}

/** A drag that would navigate the page if dropped: a link, text or a file. */
function carriesLink(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  return Boolean(types && Array.from(types).some((type) => type === 'text/uri-list' || type === 'text/plain' || type === 'Files'));
}

/**
 * Every way a YouTube video reaches the ride tab from outside Tempo: the "Send to Tempo" bookmark
 * (via its send window), the Tempo Ride app's YouTube window, a link dropped anywhere on the ride
 * screen and Ctrl/Cmd+V outside a text field. Lives in the ride screen, not the YouTube panel, so
 * it works while entertainment is off or showing the course. Returns whether a link is being
 * dragged over the page, for the drop highlight.
 */
export function useYouTubeInbox(enabled: boolean, onVideo: (video: Delivery) => void): { dragActive: boolean } {
  const [dragActive, setDragActive] = useState(false);
  const deliver = useEffectEvent((video: Delivery) => onVideo(video));

  useEffect(() => {
    if (!enabled) return;
    // Optional extras: if either fails to start, the ride carries on without it.
    let stopChannel: (() => void) | null = null;
    let stopDesktop: (() => void) | undefined;
    try {
      if (typeof BroadcastChannel !== 'undefined') stopChannel = listenForSentVideos((video) => deliver(video));
    } catch { /* no Send to Tempo bookmark in this browser */ }
    try {
      stopDesktop = window.tempoDesktop?.youtube?.onVideo(({ url, startSec }) => {
        const link = parseYouTubeLink(url);
        if (!link) return;
        deliver({ videoId: link.videoId, startSec: startSec >= 1 ? Math.floor(startSec) : link.startSec });
      });
    } catch { /* no desktop YouTube window */ }

    const onPaste = (event: ClipboardEvent) => {
      if (isTextField(event.target) || dialogOpen()) return;
      const link = findYouTubeLink(event.clipboardData?.getData('text/plain'));
      if (!link) return;
      event.preventDefault();
      deliver(link);
    };

    // Drags that start on this page (such as the Send to Tempo bookmark on its way to the
    // bookmarks bar) are not videos coming in.
    let internalDrag = false;
    let timer: number | undefined;
    const endDrag = () => {
      window.clearTimeout(timer);
      setDragActive(false);
    };
    const onDragStart = () => { internalDrag = true; };
    const onDragEnd = () => { internalDrag = false; endDrag(); };
    // Text fields keep their own drop. Everywhere else a drop is always taken, so a stray link
    // never navigates away from the ride; it plays only when it comes from outside the page and
    // no dialog is open.
    const onDragOver = (event: DragEvent) => {
      if (!carriesLink(event) || isTextField(event.target)) return;
      event.preventDefault();
      const accepts = !internalDrag && !dialogOpen();
      if (event.dataTransfer) event.dataTransfer.dropEffect = accepts ? 'copy' : 'none';
      if (!accepts) return;
      setDragActive(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(endDrag, DRAG_LINGER_MS);
    };
    const onDrop = (event: DragEvent) => {
      endDrag();
      if (!carriesLink(event) || isTextField(event.target)) return;
      event.preventDefault();
      if (internalDrag || dialogOpen()) return;
      const data = event.dataTransfer;
      const link = findYouTubeLink(data?.getData('text/uri-list')) ?? findYouTubeLink(data?.getData('text/plain'));
      if (link) deliver(link);
      else if (event.target instanceof Element && event.target.closest('[data-youtube-panel]')) deliver(null);
    };

    document.addEventListener('paste', onPaste);
    document.addEventListener('dragstart', onDragStart);
    document.addEventListener('dragend', onDragEnd);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      stopChannel?.();
      stopDesktop?.();
      window.clearTimeout(timer);
      setDragActive(false);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('dragstart', onDragStart);
      document.removeEventListener('dragend', onDragEnd);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [enabled]);

  return { dragActive };
}
