export type McuChipModel = 'ESP32-C3' | 'ESP32-S3' | 'ESP32-C6' | 'ESP32-P4' | 'ESP8266';

export type AlertStatus = 'NORMAL' | 'WASPADA' | 'AMARAN' | 'BAHAYA';

export interface TelemetryPayload {
  chipModel: McuChipModel;
  waterLevel: number; // in cm
  rawFrequency: number; // in Hz
  batteryVoltage: number; // in Volts
  batteryPercentage: number; // 0 - 100%
  status: AlertStatus;
  timestamp?: string;
  tareOffset?: number;
}

export interface CalibrationConfig {
  mSlope: number; // Slope 'm' in y = m * x + c (e.g. -0.05 cm/Hz)
  cOffset: number; // Offset 'c' in y = m * x + c (e.g. 100.0 cm)
  tareOffset: number; // Auto-zero adjustment (in cm or Hz)
  filterWindowSize: number; // 10 to 20 samples
  batteryR1: number; // 100k Ohm
  batteryR2: number; // 100k Ohm
  batterySoftwareMultiplier: number; // e.g. 1.000 (0.900 - 1.100)
  nvsNamespace: string;
}

export interface McuPinoutInfo {
  model: McuChipModel;
  coreArch: string;
  clockSpeed: string;
  adcResolution: '10-bit (0 - 1023)' | '12-bit (0 - 4095)';
  adcMaxRaw: number;
  adcPins: string;
  adcvRef: string;
  interruptPins: string;
  networkInterface: string;
  macroDefine: string;
  notes: string;
  typicalAdcChannel: string;
}

export interface ThresholdConfig {
  normalMax: number; // default: 30 cm
  waspadaMax: number; // default: 50 cm
  amaranMax: number; // default: 80 cm
  bahayaMin: number; // default: 80 cm
}

export interface HistoryDataPoint {
  time: string;
  timestamp: number;
  waterLevel: number;
  rawFrequency: number;
  batteryVoltage: number;
  status: AlertStatus;
}
