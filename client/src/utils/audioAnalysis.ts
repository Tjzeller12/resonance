/**
 * Calculates a linear regression slope for an array of values over time.
 * This determines the trend (e.g. rising or falling).
 */
function calculateSlope(values: number[]): number {
    if (values.length < 2) return 0;
    
    // x is just index/time proxy, y is the value
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    const n = values.length;

    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += values[i];
        sumXY += i * values[i];
        sumX2 += i * i;
    }

    const denominator = (n * sumX2 - sumX * sumX);
    if (denominator === 0) return 0;

    return (n * sumXY - sumX * sumY) / denominator;
}

export function calculatePitchTrend(metricsRecord: { pitch: number, timestamp: number }[]): 'downward' | 'upward' | 'flat' {
    if (metricsRecord.length < 3) return 'flat';
    
    const validPitches = metricsRecord.filter(m => m.pitch > 60).map(m => m.pitch);
    
    if (validPitches.length < 3) return 'flat';

    const slope = calculateSlope(validPitches);
    
    // Normalize slope relative to the mean pitch so the threshold works
    // regardless of how many samples are in the slice.
    // A raw slope of 0.1 on 200 samples is very different from 0.1 on 10 samples.
    const meanPitch = validPitches.reduce((s, v) => s + v, 0) / validPitches.length;
    const normalizedSlope = (slope / meanPitch) * 100; // percentage change per sample

    console.debug('[PitchTrend] samples:', validPitches.length,
        '| rawSlope:', slope.toFixed(4),
        '| meanPitch:', Math.round(meanPitch),
        '| normalized:', normalizedSlope.toFixed(4));

    if (normalizedSlope > 0.05) return 'upward';
    if (normalizedSlope < -0.05) return 'downward';
    return 'flat';
}

export function calculatePitchRange(metricsRecord: { pitch: number, timestamp: number }[]): number {
    const validPitches = metricsRecord.filter(m => m.pitch > 60).map(m => m.pitch);
    if (validPitches.length === 0) return 0;
    
    const maxPitch = Math.max(...validPitches);
    const minPitch = Math.min(...validPitches);
    return Math.round(maxPitch - minPitch);
}

export function calculateVolumeTags(metricsRecord: { volume: number, timestamp: number }[]): string[] {
    const tags: string[] = [];
    if (metricsRecord.length === 0) return tags;

    const validVolumes = metricsRecord.filter(m => m.volume > 0).map(m => m.volume);
    if (validVolumes.length === 0) return tags;

    const averageVolume = validVolumes.reduce((sum, v) => sum + v, 0) / validVolumes.length;

    // Volume thresholds based on empirical data mapping:
    // >= 0.7: Yelling
    // >= 0.5: Projecting
    // 0.35 - 0.5: Normal volume (0.4 center)
    // 0.2 - 0.35: Quiet
    // < 0.2: Very quiet / noisy floor
    if (averageVolume >= 0.7) {
        tags.push('Speaking very loud');
    } else if (averageVolume >= 0.5) {
        tags.push('Speaking loud');
    } else if (averageVolume >= 0.35) {
        tags.push('Speaking at medium volume');
    } else if (averageVolume >= 0.2) {
        tags.push('Speaking quietly');
    } else {
        tags.push('Speaking very quietly');
    }

    const slope = calculateSlope(validVolumes);
    if (slope > 0.001) {
        tags.push('Volume increases throughout');
    } else if (slope < -0.001) {
        tags.push('Volume decreases throughout');
    }

    return tags;
}
