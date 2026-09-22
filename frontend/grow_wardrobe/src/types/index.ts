export type GrowMedium = 'coco' | 'soil';
export type LightPreset = '18/6' | '12/12' | '24/0';
export type AppTheme = 'slate' | 'forest' | 'oled' | 'light';

export interface FanDriver {
  category: 'override' | 'clamp' | 'vpd' | 'temp' | 'manual' | 'optimal';
  title: string;
  badge: string;
  badgeColor: string;
  explanation: string;
  isClampActive: boolean;
}

export interface ScheduledFeed {
  timeStr: string;
  relStr: string;
  isNext: boolean;
}

export interface ZoneMetric {
  temp: string;
  humidity: string;
  vpd: string;
  moisture?: string;
}

export interface EnvironmentMetrics {
  canopy: ZoneMetric;
  pot: ZoneMetric;
  ambient: ZoneMetric;
}

export interface FanDynamicsData {
  fanSpeed: string;
  numFanSpeed: number;
  ventMode: string;
  fanDriver: FanDriver;
  fanReason: string;
  targetVpd: number;
  vpdTargetDiff: number | null;
  canopyVpd: string;
  canopyAvp: number | null;
  ambientAvp: number | null;
  avpDiff: number | null;
  vpdAmbientDiff: number | null;
  canopyTemp: string;
  ambientTemp: string;
  tempDiff: number | null;
}

export type HistoryZoneFilter = 'all' | 'canopy' | 'pot' | 'ambient';

export interface HistoryDataPoint {
  timestamp: number;
  timeLabel: string;
  canopyTemp: number | null;
  canopyHumidity: number | null;
  canopyVpd: number | null;
  potTemp: number | null;
  potHumidity: number | null;
  soilMoisture: number | null;
  ambientTemp: number | null;
  ambientHumidity: number | null;
}

export type SensorSeriesKey =
  | 'canopyTemp'
  | 'canopyHumidity'
  | 'potTemp'
  | 'potHumidity'
  | 'soilMoisture'
  | 'ambientTemp'
  | 'ambientHumidity';

export interface SensorSeriesMeta {
  key: SensorSeriesKey;
  name: string;
  zone: 'canopy' | 'pot' | 'ambient';
  type: 'temp' | 'humidity' | 'moisture';
  unit: string;
  color: string;
  yAxisId: 'temp' | 'hum';
  strokeDasharray?: string;
  strokeWidth?: number;
}

export type GrowPhase =
  | 'germination'
  | 'seedling'
  | 'vegetative'
  | 'transition'
  | 'flowering'
  | 'flush'
  | 'harvest'
  | 'curing';

export interface GrowRun {
  id: string;
  name: string;
  strain: string;
  breeder?: string;
  medium: GrowMedium;
  startDate: string; // ISO string e.g. "2026-08-15"
  flipDate?: string | null; // ISO string when flipped to 12/12
  harvestDate?: string | null;
  targetFlowerDays?: number; // e.g. 63
  potSizeLiters?: number;
  notes?: string;
  isActive: boolean;
  isArchived?: boolean;
  yieldGrams?: number | null;
  rating?: number | null;
}

export type DiaryEntryTag =
  | 'watering'
  | 'nutrients'
  | 'training'
  | 'defoliation'
  | 'flipto1212'
  | 'flush'
  | 'trichomes'
  | 'pest_check'
  | 'milestone'
  | 'general';

export interface DiaryTelemetrySnapshot {
  canopyTemp?: string;
  canopyHumidity?: string;
  canopyVpd?: string;
  potTemp?: string;
  potHumidity?: string;
  soilMoisture?: string;
  fanSpeed?: string;
}

export interface DiaryEntry {
  id: string;
  runId: string;
  timestamp: number;
  dateStr: string;
  dayNumber: number;
  flowerDayNumber?: number | null;
  phase: GrowPhase;
  title: string;
  note: string;
  tags: DiaryEntryTag[];
  photoUrl?: string | null;
  nutrientEc?: number | null;
  nutrientPh?: number | null;
  runoffEc?: number | null;
  runoffPh?: number | null;
  waterAmountLiters?: number | null;
  trichomeClearPct?: number | null;
  trichomeCloudyPct?: number | null;
  trichomeAmberPct?: number | null;
  telemetry?: DiaryTelemetrySnapshot;
}

export interface GrowDiaryStore {
  runs: GrowRun[];
  activeRunId: string | null;
  entries: DiaryEntry[];
}
