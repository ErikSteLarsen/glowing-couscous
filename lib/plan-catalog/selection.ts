export type PlanWorkoutOption = {
  id: string;
  title: string;
  sport: string;
  durationSec: number;
};

export type PlanSlot<Option extends PlanWorkoutOption = PlanWorkoutOption> = {
  id: string;
  weekday: number;
  label: string;
  options: readonly [Option, ...Option[]];
};

export type BuiltInPlanPreview = {
  slug: string;
  version: number;
  name: string;
  summary: string;
  volumeLabel: string;
  volumeNote?: string;
  slots: PlanSlot[];
};

export function selectPlanWorkouts<Option extends PlanWorkoutOption>(
  slots: readonly PlanSlot<Option>[],
  choices: Readonly<Record<string, string>>,
) {
  return slots.flatMap((slot) => {
    const option = slot.options.find((item) => item.id === choices[slot.id]) ?? slot.options[0];
    return option.durationSec ? [{ weekday: slot.weekday, option }] : [];
  });
}
