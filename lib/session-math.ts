import { getTempoZoneMeta, type TempoBlock } from './tempo-blocks.ts';

export function deriveSessionMetrics(blocks: TempoBlock[]) {
  const durationSec = blocks.reduce((sum, block) => sum + block.durationSec, 0);
  const zoneDistributionSec = [0, 0, 0, 0, 0];

  let rawTss = 0;
  const segments = blocks.map((block, index) => {
    zoneDistributionSec[block.zone - 1] += block.durationSec;
    const zoneMeta = getTempoZoneMeta(block.zone);
    rawTss += (block.durationSec / 3600) * zoneMeta.factor * zoneMeta.factor * 100;

    return {
      key: `${block.kind}-${index}`,
      zone: block.zone,
      durationSec: block.durationSec,
      label: `${zoneMeta.label} ${zoneMeta.name}`,
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
