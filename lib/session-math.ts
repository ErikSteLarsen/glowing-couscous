import { getTempoZoneMeta, type TempoBlock } from './tempo-blocks.ts';
import { expandRepeatedBlocks } from './workout-blocks.ts';
import { chartIntensityFraction } from './workout-zone-intensity.ts';

export function deriveSessionMetrics(blocks: TempoBlock[], sport = 'RUNNING') {
  const expandedBlocks = expandRepeatedBlocks(blocks);
  const durationSec = expandedBlocks.reduce((sum, block) => sum + block.durationSec, 0);
  const zoneDistributionSec = [0, 0, 0, 0, 0];

  let rawTss = 0;
  const segments = expandedBlocks.map((block) => {
    const zoneMeta = getTempoZoneMeta(block.zone);
    const intensityFraction = block.kind === 'pause' ? 0 : chartIntensityFraction(block.target ?? null, block.zone, sport, null);
    if (block.kind !== 'pause') {
      zoneDistributionSec[block.zone - 1] += block.durationSec;
      rawTss += (block.durationSec / 3600) * zoneMeta.factor * zoneMeta.factor * 100;
    }

    return {
       key: block.key,
      zone: block.zone,
      durationSec: block.durationSec,
      label: block.kind === 'pause' ? 'Pause' : `${zoneMeta.label} ${zoneMeta.name}`,
      color: zoneMeta.solid,
      tint: zoneMeta.tint,
      ...(intensityFraction !== 0.5 && block.kind !== 'pause' ? { intensityFraction } : {}),
    };
  });

  return {
    durationSec,
    tss: Math.round(rawTss),
    zoneDistributionSec,
    segments,
  };
}
