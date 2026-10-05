import React, { useState, useEffect, useRef } from 'react';
import {
  McuChipModel,
  TelemetryPayload,
  CalibrationConfig,
  AlertStatus,
  HistoryDataPoint
} from './types/telemetry';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { CalibrationStudio } from './components/CalibrationStudio';
import { FirmwareGenerator } from './components/FirmwareGenerator';
import { ApiTestingHub } from './components/ApiTestingHub';
import { FlutterMobileSuite } from './components/FlutterMobileSuite';
import { playAlertSound } from './utils/audioAlert';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'calibration' | 'firmware' | 'api' | 'flutter'>('dashboard');
  const [selectedMcu, setSelectedMcu] = useState<McuChipModel>('ESP32-C3');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);

  // Calibration Configuration
  const [config, setConfig] = useState<CalibrationConfig>({
    mSlope: -0.0500, // y = m * x + c (as water rises, capacitance rises, frequency drops)
    cOffset: 100.0,
    tareOffset: 0.0,
    filterWindowSize: 15,
    batteryR1: 100000,
    batteryR2: 100000,
    batterySoftwareMultiplier: 1.000,
    nvsNamespace: 'flood_cfg'
  });

  // Physical simulation variables
  const [waterLevelInput, setWaterLevelInput] = useState<number>(24.5);
  const [noiseAmount, setNoiseAmount] = useState<number>(15);
  const [batteryInput, setBatteryInput] = useState<number>(3.92);

  // Filter Ring Buffer
  const [filterBuffer, setFilterBuffer] = useState<number[]>(() =>
    Array(15).fill(1510)
  );

  // Telemetry state
  const [telemetry, setTelemetry] = useState<TelemetryPayload>({
    chipModel: 'ESP32-C3',
    waterLevel: 24.5,
    rawFrequency: 1510,
    batteryVoltage: 3.92,
    batteryPercentage: 86,
    status: 'NORMAL',
    timestamp: new Date().toISOString()
  });

  // History timeline
  const [history, setHistory] = useState<HistoryDataPoint[]>([]);

  // Sound throttler ref
  const lastSoundRef = useRef<number>(0);

  // Simulation loop (runs every 1500ms like a real hardware gating cycle)
  useEffect(() => {
    const interval = setInterval(() => {
      // 1. Calculate theoretical frequency from targeted water level
      // y = m * x + c - tare --> x = (y - c + tare) / m
      const effectiveLevel = waterLevelInput;
      const targetFreq = (effectiveLevel - config.cOffset + config.tareOffset) / config.mSlope;

      // Add random wave turbulence noise
      const noise = (Math.random() - 0.5) * 2 * noiseAmount;
      const rawFreq = Math.max(100, targetFreq + noise);

      // 2. Update Moving Average Filter
      setFilterBuffer((prev) => {
        const next = [...prev.slice(1), rawFreq];
        // Ensure size matches config.filterWindowSize
        if (next.length > config.filterWindowSize) {
          return next.slice(next.length - config.filterWindowSize);
        } else if (next.length < config.filterWindowSize) {
          return [...Array(config.filterWindowSize - next.length).fill(rawFreq), ...next];
        }
        return next;
      });

      // 3. Compute filtered frequency
      setFilterBuffer((currentBuf) => {
        const sum = currentBuf.reduce((a, b) => a + b, 0);
        const filteredFreq = sum / (currentBuf.length || 1);

        // 4. Calculate actual water level from filtered frequency
        const calculatedLevel = Math.max(0, (config.mSlope * filteredFreq) + config.cOffset - config.tareOffset);

        // 5. Calculate battery voltage with resistor divider and software multiplier
        const dividerRatio = (config.batteryR1 + config.batteryR2) / config.batteryR2; // 2.0x
        const is10Bit = selectedMcu === 'ESP8266';
        const adcMax = is10Bit ? 1023 : 4095;
        // simulate ADC read with resistor tolerance multiplier
        const simulatedAdcRaw = Math.round((batteryInput / dividerRatio / 3.3) * adcMax);
        const pinVolt = (simulatedAdcRaw / adcMax) * 3.3;
        const measuredBattery = pinVolt * dividerRatio * config.batterySoftwareMultiplier;

        // Battery percentage (LiPo 3.2V - 4.2V)
        const batPct = Math.round(Math.min(100, Math.max(0, ((measuredBattery - 3.2) / (4.2 - 3.2)) * 100)));

        // Determine status
        const status: AlertStatus =
          calculatedLevel >= 80 ? 'BAHAYA' :
          calculatedLevel >= 50 ? 'AMARAN' :
          calculatedLevel >= 30 ? 'WASPADA' : 'NORMAL';

        // Play audio alert if enabled
        if (soundEnabled && (status === 'BAHAYA' || status === 'AMARAN')) {
          const now = Date.now();
          if (now - lastSoundRef.current > 4000) {
            playAlertSound(status);
            lastSoundRef.current = now;
          }
        }

        const newTelemetry: TelemetryPayload = {
          chipModel: selectedMcu,
          waterLevel: Number(calculatedLevel.toFixed(1)),
          rawFrequency: Number(rawFreq.toFixed(1)),
          batteryVoltage: Number(measuredBattery.toFixed(2)),
          batteryPercentage: batPct,
          status,
          timestamp: new Date().toISOString()
        };

        setTelemetry(newTelemetry);

        // Append to history
        setHistory((prevHist) => [
          {
            time: new Date().toLocaleTimeString(),
            timestamp: Date.now(),
            waterLevel: newTelemetry.waterLevel,
            rawFrequency: newTelemetry.rawFrequency,
            batteryVoltage: newTelemetry.batteryVoltage,
            status: newTelemetry.status
          },
          ...prevHist.slice(0, 40)
        ]);

        return currentBuf;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [waterLevelInput, noiseAmount, batteryInput, config, selectedMcu, soundEnabled]);

  // Handler: Auto-Zero Tare
  const handleAutoZeroTare = () => {
    // Current raw level before tare: y_raw = m * filteredFreq + c
    const currentFilteredFreq = filterBuffer.reduce((a, b) => a + b, 0) / (filterBuffer.length || 1);
    const currentRawLevel = (config.mSlope * currentFilteredFreq) + config.cOffset;
    
    setConfig(prev => ({
      ...prev,
      tareOffset: currentRawLevel
    }));
  };

  // Handler: Quick Scenarios
  const handleQuickSimulate = (scenario: 'rain' | 'flood' | 'normal' | 'low_bat') => {
    switch (scenario) {
      case 'rain':
        setWaterLevelInput(45);
        setNoiseAmount(30);
        break;
      case 'flood':
        setWaterLevelInput(88.5);
        setNoiseAmount(40);
        break;
      case 'normal':
        setWaterLevelInput(12.0);
        setNoiseAmount(10);
        break;
      case 'low_bat':
        setBatteryInput(3.35);
        break;
    }
  };

  // Handler: Reset Simulation
  const handleResetSimulation = () => {
    setWaterLevelInput(24.5);
    setNoiseAmount(15);
    setBatteryInput(3.92);
    setConfig({
      mSlope: -0.0500,
      cOffset: 100.0,
      tareOffset: 0.0,
      filterWindowSize: 15,
      batteryR1: 100000,
      batteryR2: 100000,
      batterySoftwareMultiplier: 1.000,
      nvsNamespace: 'flood_cfg'
    });
  };

  // Handler: Dispatch manual payload from API Tester
  const handleDispatchPayload = (payload: TelemetryPayload) => {
    setWaterLevelInput(payload.waterLevel);
    setBatteryInput(payload.batteryVoltage);
    setSelectedMcu(payload.chipModel);
    setTelemetry(payload);
  };

  const currentFilteredFreq = filterBuffer.reduce((a, b) => a + b, 0) / (filterBuffer.length || 1);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* 3-Zone Header Contract */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        onResetSimulation={handleResetSimulation}
      />

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            telemetry={telemetry}
            selectedMcu={selectedMcu}
            setSelectedMcu={setSelectedMcu}
            waterLevelInput={waterLevelInput}
            setWaterLevelInput={setWaterLevelInput}
            noiseAmount={noiseAmount}
            setNoiseAmount={setNoiseAmount}
            batteryInput={batteryInput}
            setBatteryInput={setBatteryInput}
            history={history}
            onAutoZeroTare={handleAutoZeroTare}
            onQuickSimulate={handleQuickSimulate}
          />
        )}

        {activeTab === 'calibration' && (
          <CalibrationStudio
            config={config}
            setConfig={setConfig}
            currentRawFreq={telemetry.rawFrequency}
            currentFilteredFreq={currentFilteredFreq}
            selectedMcu={selectedMcu}
            onAutoZeroTare={handleAutoZeroTare}
            filterBuffer={filterBuffer}
          />
        )}

        {activeTab === 'firmware' && (
          <FirmwareGenerator
            selectedMcu={selectedMcu}
            setSelectedMcu={setSelectedMcu}
            config={config}
          />
        )}

        {activeTab === 'api' && (
          <ApiTestingHub
            currentTelemetry={telemetry}
            onDispatchPayload={handleDispatchPayload}
          />
        )}

        {activeTab === 'flutter' && (
          <FlutterMobileSuite
            telemetry={telemetry}
            selectedMcu={selectedMcu}
            onAutoZeroTare={handleAutoZeroTare}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Sistem Pemantauan Tiang Aras Air Banjir IoT &copy; 2026 · Hak Cipta Terpelihara</span>
          <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
            <span>ESP-IDF / Arduino C++</span>
            <span aria-hidden="true">·</span>
            <span>IC555 Oscillator</span>
            <span aria-hidden="true">·</span>
            <span>Flutter Android</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
