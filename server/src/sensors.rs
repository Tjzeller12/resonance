
use pitch_detection::detector::mcleod::McLeodDetector;
use pitch_detection::detector::PitchDetector;
use std::time::{Duration, Instant};
use serde::Serialize;

/// Standardized metrics emitted by the `AudioProcessor`.
/// Passed directly via WebSocket to the frontend for visualization.
#[derive(Serialize)]
pub struct SensorMetrics {
    pub volume: f32,
    pub pitch: f32,
    pub pitch_variance: f32,
    pub is_speaking: bool,
}

/// Maintains state over time to calculate rolling metrics (like variance) 
/// and debounced states (like continuous speaking).
pub struct AudioProcessor {
    last_spoken: Option<Instant>,
    pitch_history: Vec<f32>,
}

impl AudioProcessor {
    pub fn new() -> Self {
        Self {
            last_spoken: None,
            pitch_history: Vec::new(),
        }
    }

    /// Main entry point for the sensor loop. 
    /// Takes a chunk of raw 16-bit PCM audio from the frontend, runs all
    /// mathematical analyses, updates historical state, and returns the live metrics.
    pub fn process(&mut self, pcm: &[i16]) -> SensorMetrics {
        let volume = self.calculate_volume(pcm);

        if volume > 0.3 { 
            self.last_spoken = Some(Instant::now());
        }
        
        let pitch = self.calculate_pitch(pcm);

        if pitch > 0.0 {
            self.pitch_history.push(pitch);
            if self.pitch_history.len() > 25 {
                self.pitch_history.remove(0);
            }
        }

        let pitch_variance = self.calculate_pitch_varience();
        let is_speaking = self.is_speaking_check(); // Renamed to avoid confusion

        SensorMetrics {
            volume,
            pitch,
            pitch_variance,
            is_speaking,
        }
    }

    // Helper to calculate variance
    fn calculate_pitch_varience(&self) -> f32 {
        let mut variance = 0.0;
        if !self.pitch_history.is_empty() {
            let mean: f32 = self.pitch_history.iter().sum::<f32>() / self.pitch_history.len() as f32;
            let variance_sum: f32 = self.pitch_history.iter()
                .map(|&p| {
                    let diff = p - mean;
                    diff * diff
                })
                .sum();
            variance = variance_sum / self.pitch_history.len() as f32;
        }
        variance.sqrt()
    }

    /// Calculates root-mean-square (RMS) energy to determine physical loudness.
    /// Returns a normalized value between 0.0 (silent) and 1.0 (clipping).
    fn calculate_volume(&self, pcm: &[i16]) -> f32 {
        let mut sum_squares = 0.0;
        for &sample in pcm {
            let normalized = sample as f32 / 32768.0;
            sum_squares += normalized * normalized; 
        }
        let rms = (sum_squares / pcm.len() as f32).sqrt();
        let db = 20.0 * rms.max(0.000001).log10();
        return ((db + 40.0) / 40.0).max(0.0).min(1.0);
    }

    /// Uses the McLeod Pitch Method (via `pitch_detection` crate) to isolate human voice
    /// frequencies from background noise. Returns 0.0 if no clear pitch is detected.
    fn calculate_pitch(&self, pcm: &[i16]) -> f32 {
        const SAMPLE_RATE: usize = 16000;
        const SIZE: usize = 2048;
        const PADDING: usize = SIZE / 2;
        const POWER_THRESHOLD: f64 = 0.5;
        const CLARITY_THRESHOLD: f64 = 0.6;

        let samples: Vec<f64> = pcm.iter().map(|&s| s as f64).collect();
        let mut detector = McLeodDetector::new(SIZE, PADDING);
        
        if let Some(pitch) = detector.get_pitch(&samples, SAMPLE_RATE, POWER_THRESHOLD, CLARITY_THRESHOLD) {
            let freq = pitch.frequency as f32;
            if freq >= 85.0 && freq <= 350.0 {
                return freq;
            }
        }
        return 0.0;
    }

    fn is_speaking_check(&self) -> bool {
        const COOLDOWN: Duration = Duration::from_millis(2500); // 2500ms hangover

        if let Some(last) = self.last_spoken {
            if last.elapsed() < COOLDOWN {
                return true;
            }
        }
        return false;
    }
}

