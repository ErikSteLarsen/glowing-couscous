import { generateStructuredWorkoutEvidence } from './workout-llm.ts';
import type { ActivityAnalysisResult } from './activity-analysis.ts';

const outputSchema = (candidateIds: string[]) => ({
  type: 'object', additionalProperties: false,
  properties: { candidateId: { type: 'string', enum: candidateIds }, explanation: { type: 'string' } },
  required: ['candidateId', 'explanation'],
});
const instructions = `Explain an endurance recording from computed evidence. Return JSON with candidateId and explanation.
Select only a supplied candidate ID. Do not invent intervals, measurements, intensity or physiological effects.
Write up to two short sentences about the selected structure and variation BETWEEN measured efforts. Do not claim
variation within an effort: only segment averages are provided. Use no digits, numerical quantities,
zone labels or medical claims in explanation; measurements are displayed separately from code.
Common durations are only a soft prior. Repeated observed fifty-three-second efforts must not become minute efforts.
Retain preferredCandidateId when time and distance explanations fit equally well. Average pace alone does not
prove the athlete's intended target. With limited coverage, acknowledge uncertainty rather than adding detail.
Examples (the candidate ID must exist in the actual input):
{"candidateId":"time","explanation":"Repeated sustained efforts alternate with slower recoveries. The effort durations support a regular time-based pattern."}
{"candidateId":"observed","explanation":"The detected efforts have varied durations. A uniform repetition pattern is uncertain."}
{"candidateId":"distance","explanation":"Similar effort distances with varying durations support distance-based repetitions."}
Data gaps limit conclusions. Heart rate responds late; recovery HR does not prove a new effort.
Never infer lactate, VO2max changes, adaptation or energy-system percentages. No identity or notes are provided.`;

export function validateAnalysisExplanation(value: unknown, evidence: ActivityAnalysisResult): { candidateId: string; explanation: string } | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (!evidence.candidates.some(c => c.id === record.candidateId) || typeof record.explanation !== 'string') return null;
  const explanation = record.explanation.trim();
  if (!explanation || explanation.length > 650 || /\d|lactate|vo2|diagnos|percent|anaerobic|adaptation/i.test(explanation)) return null;
  if (Object.keys(record).some(key => !['candidateId', 'explanation'].includes(key))) return null;
  return { candidateId: String(record.candidateId), explanation };
}

export async function interpretActivityEvidence(evidence: ActivityAnalysisResult,
  generate: typeof generateStructuredWorkoutEvidence = generateStructuredWorkoutEvidence): Promise<ActivityAnalysisResult> {
  // Bound input independently of the import's 20,000 samples. Never send raw streams.
  if (!evidence.candidates.length || evidence.segments.length > 100) return evidence;
  const compact = { candidates: evidence.candidates, preferredCandidateId: evidence.selectedCandidateId,
    confidence: evidence.confidence, workSummary: evidence.workSummary,
    intensityBasis: evidence.intensityBasis, limitations: evidence.limitations,
    segments: evidence.segments.map(s => ({ id: s.id, kind: s.kind, durationSec: s.durationSec, paceSecPerKm: s.paceSecPerKm,
      averageHrBpm: s.averageHrBpm, paceZone: s.paceZone, hrZone: s.hrZone, coverage: s.coverage })) };
  const response = await generate(JSON.stringify(compact), outputSchema(evidence.candidates.map(c => c.id)), instructions);
  if (!response) return evidence;
  try {
    const output = validateAnalysisExplanation(JSON.parse(response.text), evidence);
    return output ? { ...evidence, source: 'ai', model: response.model, selectedCandidateId: output.candidateId,
      summary: `${evidence.summary} ${output.explanation}` } : evidence;
  } catch { return evidence; }
}
