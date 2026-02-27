import { transcriptionQueue } from '../worker/src/queues';

// This would be imported from worker package in production
// For now, we'll trigger via HTTP or Redis directly

export async function triggerProcessingPipeline(recordingId: string): Promise<void> {
  // After recording stops, trigger VAD first
  // This would be done via HTTP call to worker or direct Redis queue access
  // For now, placeholder
  console.log(`Triggering processing pipeline for recording ${recordingId}`);
}
