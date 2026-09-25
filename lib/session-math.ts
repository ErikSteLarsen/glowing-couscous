import { getTempoZoneMeta, type TempoBlock } from './tempo-blocks.ts';
import { expandRepeatedBlocks } from './workout-blocks.ts';

export function deriveSessionMetrics(blocks: TempoBlock[]) {
  const expandedBlocks = expandRepeatedBlocks(blocks);
  const durationSec = expandedBlocks.reduce((sum, block) => sum + block.durationSec, 0);
  const zoneDistributionSec = [0, 0, 0, 0, 0];

  let rawTss = 0;
  const segments = expandedBlocks.map((block) => {
    const zoneMeta = getTempoZoneMeta(block.zone);
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
    };
  });

  return {
    durationSec,
    tss: Math.round(rawTss),
    zoneDistributionSec,
    segments,
  };
}
