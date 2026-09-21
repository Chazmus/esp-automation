export type GrowMedium = 'coco' | 'soil';
export type LightPreset = '18/6' | '12/12' | '24/0';

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
