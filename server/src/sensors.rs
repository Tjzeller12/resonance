
use pitch_detection::detector::yin::YINDetector;
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

/// Number of initial chunks used to learn the ambient noise floor.
const CALIBRATION_CHUNKS: usize = 10;

/// Offset above the learned baseline that triggers "speaking" detection.
const NOISE_FLOOR_OFFSET: f32 = 0.15;

/// Maintains state over time to calculate rolling metrics (like variance) 
/// and debounced states (like continuous speaking).
pub struct AudioProcessor {
    last_spoken: Option<Instant>,
    pitch_history: Vec<f32>,

    /// Dynamic noise floor calibration state.
    /// We collect `CALIBRATION_CHUNKS` volume readings during the first moments
    /// of a session, average them, and set the speaking threshold dynamically.
    calibration_volumes: Vec<f32>,
    baseline_volume: Option<f32>,
}

impl AudioProcessor {
    pub fn new() -> Self {
        Self {
            last_spoken: None,
            pitch_history: Vec::new(),
            calibration_volumes: Vec::new(),
            baseline_volume: None,
        }
    }

    /// Returns the dynamic speaking threshold.
    /// During calibration (first ~10 chunks), falls back to a conservative 0.3.
    /// After calibration, returns `baseline + NOISE_FLOOR_OFFSET`.
    fn speaking_threshold(&self) -> f32 {
        match self.baseline_volume {
            Some(baseline) => baseline + NOISE_FLOOR_OFFSET,
            None => 0.3, // Conservative fallback during calibration
        }
    }

    /// Main entry point for the sensor loop. 
    /// Takes a chunk of raw 16-bit PCM audio from the frontend, runs all
    /// mathematical analyses, updates historical state, and returns the live metrics.
    pub fn process(&mut self, pcm: &[i16]) -> SensorMetrics {
        let volume = self.calculate_volume(pcm);

        // --- Dynamic Noise Floor Calibration ---
        // During the first CALIBRATION_CHUNKS frames, we learn the room's
        // ambient noise level so we can set an intelligent speaking threshold
        // instead of the old hardcoded 0.3.
        if self.baseline_volume.is_none() {
            self.calibration_volumes.push(volume);
            if self.calibration_volumes.len() >= CALIBRATION_CHUNKS {
                let sum: f32 = self.calibration_volumes.iter().sum();
                self.baseline_volume = Some(sum / self.calibration_volumes.len() as f32);
                tracing::info!(
                    "🎚️ Noise floor calibrated: baseline={:.3}, threshold={:.3}",
                    self.baseline_volume.unwrap(),
                    self.speaking_threshold()
                );
            }
        }

        if volume > self.speaking_threshold() { 
            self.last_spoken = Some(Instant::now());
        }
        
        // Only run pitch detection when volume exceeds the speaking threshold.
        // This prevents phantom pitch readings from background noise/silence.
        let pitch = if volume > self.speaking_threshold() {
            self.calculate_pitch(pcm)
        } else {
            0.0
        };

        if pitch > 0.0 {
            self.pitch_history.push(pitch);
            if self.pitch_history.len() > 25 {
                self.pitch_history.remove(0);
            }
        }

        let pitch_variance = self.calculate_pitch_variance();
        let is_speaking = self.is_speaking_check();

        SensorMetrics {
            volume,
            // Only report pitch when actively speaking, not during silence hangover
            pitch: if is_speaking { pitch } else { 0.0 },
            pitch_variance,
            is_speaking,
        }
    }

    /// Calculates the standard deviation of recent pitch values.
    /// Used by the frontend to assess pitch stability / monotone detection.
    fn calculate_pitch_variance(&self) -> f32 {
        if self.pitch_history.is_empty() {
            return 0.0;
        }
        let mean: f32 = self.pitch_history.iter().sum::<f32>() / self.pitch_history.len() as f32;
        let variance_sum: f32 = self.pitch_history.iter()
            .map(|&p| {
                let diff = p - mean;
                diff * diff
            })
            .sum();
        let variance = variance_sum / self.pitch_history.len() as f32;
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

    /// Uses the YIN pitch detection algorithm (via `pitch_detection` crate) to track
    /// the fundamental frequency (F0) of the human voice.
    ///
    /// YIN was specifically designed to solve the "octave jumping" problem that 
    /// McLeod suffers from with complex speech harmonics. It is the gold standard
    /// for human voice F0 tracking.
    ///
    /// Upper bound expanded to 500 Hz to capture high upward inflections (uptalk).
    fn calculate_pitch(&self, pcm: &[i16]) -> f32 {
        const SAMPLE_RATE: usize = 16000;
        const SIZE: usize = 2048;
        const PADDING: usize = SIZE / 2;
        const POWER_THRESHOLD: f64 = 0.5;
        const CLARITY_THRESHOLD: f64 = 0.6;

        let samples: Vec<f64> = pcm.iter().map(|&s| s as f64).collect();
        let mut detector = YINDetector::new(SIZE, PADDING);
        
        if let Some(pitch) = detector.get_pitch(&samples, SAMPLE_RATE, POWER_THRESHOLD, CLARITY_THRESHOLD) {
            let freq = pitch.frequency as f32;
            // Expanded ceiling: 85 Hz (low male) to 500 Hz (high uptalk / female)
            if freq >= 85.0 && freq <= 500.0 {
                return freq;
            }
        }
        return 0.0;
    }

    /// Debounced voice activity detection with a 2.5s "hangover" period.
    /// Prevents rapid on/off flickering during natural pauses in speech.
    fn is_speaking_check(&self) -> bool {
        const COOLDOWN: Duration = Duration::from_millis(2500);

        if let Some(last) = self.last_spoken {
            if last.elapsed() < COOLDOWN {
                return true;
            }
        }
        return false;
    }
}
