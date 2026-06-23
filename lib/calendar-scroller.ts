export function getVisibleDayCount(containerWidth: number) {
  const minCardWidth = 240;
  const gap = 12;
  const rawCount = Math.max(1, Math.floor((containerWidth + gap) / (minCardWidth + gap)));
  return rawCount % 2 === 0 ? Math.max(1, rawCount - 1) : rawCount;
}

export function getWeekScrollerSearchHref(pathname: string, currentSearch: string, activeDateIso: string) {
  const currentParams = new URLSearchParams(currentSearch);
  if (currentParams.get('view') === 'week' && currentParams.get('date') === activeDateIso) {
    return null;
  }

  currentParams.set('view', 'week');
  currentParams.set('date', activeDateIso);
  const nextSearch = currentParams.toString();
  return nextSearch ? `${pathname}?${nextSearch}` : pathname;
}

export function getVisibleDayWindow(activeIndex: number, visibleCount: number, totalDays: number) {
  const halfWindow = Math.floor(visibleCount / 2);
  const maxStart = Math.max(0, totalDays - visibleCount);
  const start = Math.max(0, Math.min(activeIndex - halfWindow, maxStart));
  return {
    start,
    end: Math.min(totalDays, start + visibleCount),
  };
}

export function shouldExtendCalendarRange(activeIndex: number, visibleCount: number, totalDays: number) {
  const threshold = Math.floor(visibleCount / 2) + 1;
  return {
    before: activeIndex <= threshold,
    after: totalDays - activeIndex - 1 <= threshold,
  };
}
