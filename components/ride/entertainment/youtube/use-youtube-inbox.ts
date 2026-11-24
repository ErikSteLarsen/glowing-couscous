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
  return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

function carriesLink(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  return Boolean(types && Array.from(types).some((type) => type === 'text/uri-list' || type === 'text/plain'));
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
    const stopChannel = typeof BroadcastChannel === 'undefined' ? null : listenForSentVideos((video) => deliver(video));
    const stopDesktop = window.tempoDesktop?.youtube?.onVideo(({ url, startSec }) => {
      const link = parseYouTubeLink(url);
      if (!link) return;
      deliver({ videoId: link.videoId, startSec: startSec >= 1 ? Math.floor(startSec) : link.startSec });
    });

    const onPaste = (event: ClipboardEvent) => {
      if (isTextField(event.target)) return;
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
    const onDragOver = (event: DragEvent) => {
      if (internalDrag || !carriesLink(event) || isTextField(event.target)) return;
      // Accepting the drop anywhere also keeps a dropped link from navigating away from the ride.
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      setDragActive(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(endDrag, DRAG_LINGER_MS);
    };
    const onDrop = (event: DragEvent) => {
      endDrag();
      if (internalDrag || !carriesLink(event) || isTextField(event.target)) return;
      event.preventDefault();
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
