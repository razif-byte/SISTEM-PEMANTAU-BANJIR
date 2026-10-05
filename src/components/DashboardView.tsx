import React, { useMemo } from 'react';
import {
  McuChipModel,
  TelemetryPayload,
  AlertStatus,
  HistoryDataPoint
} from '../types/telemetry';
import {
  AlertTriangle,
  BatteryCharging,
  Activity,
  Sliders,
  CloudRain,
  Sun,
  ShieldAlert,
  ArrowUpRight,
  TrendingUp,
  Cpu
} from 'lucide-react';

interface DashboardViewProps {
  telemetry: TelemetryPayload;
  selectedMcu: McuChipModel;
  setSelectedMcu: (mcu: McuChipModel) => void;
  waterLevelInput: number;
  setWaterLevelInput: (val: number) => void;
  noiseAmount: number;
  setNoiseAmount: (val: number) => void;
  batteryInput: number;
  setBatteryInput: (val: number) => void;
  history: HistoryDataPoint[];
  onAutoZeroTare: () => void;
  onQuickSimulate: (scenario: 'rain' | 'flood' | 'normal' | 'low_bat') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  telemetry,
  selectedMcu,
  setSelectedMcu,
  waterLevelInput,
  setWaterLevelInput,
  noiseAmount,
  setNoiseAmount,
  batteryInput,
  setBatteryInput,
  history,
  onAutoZeroTare,
  onQuickSimulate
}) => {
  // Alert color helper
  const getStatusTheme = (status: AlertStatus) => {
    switch (status) {
      case 'BAHAYA':
        return {
          border: 'border-red-500/60',
          bg: 'bg-red-950/30',
          text: 'text-red-400',
          badgeBg: 'bg-red-500/20 text-red-300 border-red-500/40',
          waterGradient: 'from-red-600/70 to-rose-900/90',
          desc: 'BAHAYA TINGGI: Air melimpahi tebing. Penduduk wajib berpindah ke PPS segera!'
        };
      case 'AMARAN':
        return {
          border: 'border-orange-500/60',
          bg: 'bg-orange-950/30',
          text: 'text-orange-400',
          badgeBg: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
          waterGradient: 'from-orange-600/70 to-amber-900/90',
          desc: 'PARAS AMARAN: Aras air menghampiri tahap kritikal. Sediakan beg kecemasan.'
        };
      case 'WASPADA':
        return {
          border: 'border-yellow-500/60',
          bg: 'bg-yellow-950/30',
          text: 'text-yellow-400',
          badgeBg: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
          waterGradient: 'from-yellow-600/70 to-cyan-900/90',
          desc: 'PARAS WASPADA: Aliran sungai meningkat melepasi paras biasa. Bersiap sedia.'
        };
      case 'NORMAL':
      default:
        return {
          border: 'border-emerald-500/50',
          bg: 'bg-emerald-950/20',
          text: 'text-emerald-400',
          badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          waterGradient: 'from-cyan-600/70 to-blue-900/90',
          desc: 'PARAS NORMAL: Aliran air berada dalam kapasiti selamat tiada risiko banjir.'
        };
    }
  };

  const theme = getStatusTheme(telemetry.status);

  // SVG Chart points calculation
  const chartPoints = useMemo(() => {
    if (history.length === 0) return { path: '', area: '', min: 0, max: 100 };
    const slice = history.slice(0, 30).reverse();
    const maxVal = Math.max(100, ...slice.map(d => d.waterLevel + 10));
    const width = 600;
    const height = 150;
    const step = width / (slice.length - 1 || 1);

    const pts = slice.map((d, i) => {
      const x = i * step;
      const y = height - (d.waterLevel / maxVal) * height;
      return { x, y };
    });

    const pathD = pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

    return { path: pathD, area: areaD, min: 0, max: Math.round(maxVal) };
  }, [history]);

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & MCU Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/80 border border-slate-800">
        <div className="flex items-center gap-3">
          <img
            src="/app-logo.jpg"
            alt="NASA DEF SDN BHD Logo"
            className="w-11 h-11 rounded-lg object-contain border border-emerald-500/40 bg-slate-950 p-0.5 shadow-sm shrink-0"
          />
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-white">
                Tiang Pengawasan Aras Air Banjir Sungai
              </h1>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
                NASA DEF
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Stesen ID: ST-SG01</span>
              <span aria-hidden="true">·</span>
              <span>Sensor IC555 Astable</span>
              <span aria-hidden="true">·</span>
              <span>Bateri R1+R2 100kΩ</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Mikropengawal:</span>
          <select
            value={selectedMcu}
            onChange={(e) => setSelectedMcu(e.target.value as McuChipModel)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="ESP32-C3">ESP32-C3 (12-bit ADC, RISC-V)</option>
            <option value="ESP32-S3">ESP32-S3 (12-bit ADC, Xtensa Dual)</option>
            <option value="ESP32-C6">ESP32-C6 (12-bit ADC, Wi-Fi 6)</option>
            <option value="ESP32-P4">ESP32-P4 (12-bit ADC, W5500 Eth)</option>
            <option value="ESP8266">ESP8266 (10-bit ADC, NodeMCU)</option>
          </select>
        </div>
      </div>

      {/* 2. Alert Status Bar */}
      <div className={`p-4 rounded-xl border ${theme.border} ${theme.bg} transition-all duration-300`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg border ${theme.badgeBg}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Status Semasa</span>
                <span className={`text-sm font-bold tracking-wide ${theme.text}`}>
                  [{telemetry.status}]
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">{theme.desc}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={onAutoZeroTare}
              className="px-3 py-1.5 text-xs font-medium text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-700/60 rounded-lg transition-colors whitespace-nowrap"
            >
              Auto-Zero (Tare Titik Sifar)
            </button>
          </div>
        </div>
      </div>

      {/* 3. Main Grid: Physical Pole Simulator + Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Physical Flood Pole Visualization (5 cols) */}
        <div className="lg:col-span-5 p-5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Simulasi Fizikal Tiang Sensor</span>
            <span className="text-xs font-mono text-cyan-400">Skala 0 - 120 cm</span>
          </div>

          {/* Physical Pole SVG */}
          <div className="relative w-full max-w-[280px] h-[380px] bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex justify-center">
            {/* Background Pole Body */}
            <div className="absolute inset-y-0 w-24 bg-slate-900 border-x border-slate-700/60 shadow-inner flex flex-col justify-between py-2">
              {/* Scale Tick marks */}
              {[100, 80, 60, 40, 20, 0].map((level) => {
                const isBahaya = level >= 80;
                const isAmaran = level >= 50 && level < 80;
                const isWaspada = level >= 30 && level < 50;
                return (
                  <div key={level} className="relative flex items-center justify-between px-2 text-[10px] font-mono text-slate-400">
                    <span className="w-4 border-b border-slate-600"></span>
                    <span className={`tabular-nums ${isBahaya ? 'text-red-400 font-bold' : isAmaran ? 'text-orange-400' : isWaspada ? 'text-yellow-400' : 'text-slate-400'}`}>
                      {level}cm
                    </span>
                    <span className="w-4 border-b border-slate-600"></span>
                  </div>
                );
              })}
            </div>

            {/* Threshold zone indicator bars on the side */}
            <div className="absolute right-3 inset-y-6 w-1.5 flex flex-col rounded-full overflow-hidden opacity-60">
              <div className="h-[25%] bg-red-500" title="Bahaya (>80cm)" />
              <div className="h-[25%] bg-orange-500" title="Amaran (50-80cm)" />
              <div className="h-[20%] bg-yellow-500" title="Waspada (30-50cm)" />
              <div className="h-[30%] bg-emerald-500" title="Normal (<30cm)" />
            </div>

            {/* IC555 Sensing Probe (Two conductive copper rods running down) */}
            <div className="absolute top-2 w-8 h-full flex justify-around pointer-events-none z-10 opacity-70">
              <div className="w-1 bg-amber-600/80 rounded-full h-[95%]" />
              <div className="w-1 bg-amber-600/80 rounded-full h-[95%]" />
            </div>

            {/* Top Electronics Box Housing (IC555 + ESP32) */}
            <div className="absolute top-2 z-20 px-3 py-1 bg-slate-800 border border-slate-600 rounded shadow-md text-center">
              <div className="text-[9px] font-mono font-bold text-slate-300">MODUL IC555</div>
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[8px] font-mono text-slate-400">{telemetry.chipModel}</span>
              </div>
            </div>

            {/* Water Fill Layer with dynamic height */}
            <div
              className={`absolute bottom-0 w-full transition-all duration-300 bg-gradient-to-t ${theme.waterGradient} border-t-2 border-cyan-300/80 flex flex-col justify-start items-center overflow-hidden`}
              style={{
                height: `${Math.min(95, Math.max(4, (telemetry.waterLevel / 120) * 100))}%`
              }}
            >
              {/* Animated surface ripple wave */}
              <div className="w-full h-3 bg-cyan-300/30 blur-[1px] animate-pulse" />

              <div className="mt-2 text-center">
                <span className="text-xs font-mono font-bold text-white drop-shadow">
                  {telemetry.waterLevel.toFixed(1)} cm
                </span>
              </div>
            </div>
          </div>

          {/* Quick Reading footer under pole */}
          <div className="mt-4 text-center">
            <span className="text-xs text-slate-400">Ketepatan Sensor: </span>
            <span className="text-xs font-mono text-cyan-300">±0.5 cm (Linear Regressed)</span>
          </div>
        </div>

        {/* Right Column: Key Telemetry Cards & Simulation Studio (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* 4 Metric Cards */}
          <div className="grid grid-cols-2 gap-4">
            {/* 1. Aras Air */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Aras Air Semasa</span>
                <TrendingUp className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold font-mono tabular-nums text-white">
                  {telemetry.waterLevel.toFixed(1)}
                </span>
                <span className="text-sm text-slate-400">cm</span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>Zon: <strong className={theme.text}>{telemetry.status}</strong></span>
                <span>Ambang: 30 / 50 / 80cm</span>
              </div>
            </div>

            {/* 2. Frekuensi Mentah */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Frekuensi Pengayun</span>
                <Activity className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold font-mono tabular-nums text-amber-300">
                  {telemetry.rawFrequency.toFixed(0)}
                </span>
                <span className="text-sm text-slate-400">Hz</span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>Litar: Astable IC555</span>
                <span>Tapis: Moving Avg</span>
              </div>
            </div>

            {/* 3. Voltan Bateri */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Voltan Bateri</span>
                <BatteryCharging className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold font-mono tabular-nums text-white">
                  {telemetry.batteryVoltage.toFixed(2)}
                </span>
                <span className="text-sm text-slate-400">V</span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>Nisbah: 2.0x (100k/100k)</span>
                <span className="text-emerald-400 font-mono">{telemetry.batteryPercentage}%</span>
              </div>
            </div>

            {/* 4. ADC & Mikropengawal */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Resolusi ADC</span>
                <Cpu className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono text-indigo-300">
                  {selectedMcu === 'ESP8266' ? '10-Bit' : '12-Bit'}
                </span>
                <span className="text-xs text-slate-400">
                  ({selectedMcu === 'ESP8266' ? '0-1023' : '0-4095'})
                </span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>Pin: {selectedMcu === 'ESP8266' ? 'A0 (ADC0)' : 'ADC1 (GPIO0/4)'}</span>
                <span>NVS: Aktif</span>
              </div>
            </div>
          </div>

          {/* Interactive Simulation Controls */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                  Panel Kawalan Simulasi Langsung
                </span>
              </div>
              <span className="text-[11px] text-slate-400">Uji tindak balas sistem</span>
            </div>

            {/* Slider 1: Water Level */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">Ketinggian Paras Air Sasaran:</span>
                <span className="font-mono text-cyan-400 tabular-nums font-bold">{waterLevelInput} cm</span>
              </div>
              <input
                type="range"
                min="0"
                max="110"
                step="0.5"
                value={waterLevelInput}
                onChange={(e) => setWaterLevelInput(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>

            {/* Slider 2: Noise / Turbulence */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">Hingar Gelombang Air (Wave Noise):</span>
                <span className="font-mono text-amber-400 tabular-nums font-bold">±{noiseAmount} Hz</span>
              </div>
              <input
                type="range"
                min="0"
                max="80"
                step="5"
                value={noiseAmount}
                onChange={(e) => setNoiseAmount(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            {/* Slider 3: Battery Level */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">Voltan Bateri LiPo:</span>
                <span className="font-mono text-emerald-400 tabular-nums font-bold">{batteryInput.toFixed(2)} V</span>
              </div>
              <input
                type="range"
                min="3.2"
                max="4.2"
                step="0.02"
                value={batteryInput}
                onChange={(e) => setBatteryInput(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            {/* Quick Scenario Triggers */}
            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap gap-2">
              <button
                onClick={() => onQuickSimulate('rain')}
                className="px-2.5 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors flex items-center gap-1"
              >
                <CloudRain size={13} className="text-cyan-400" />
                <span>Hujan Lebat (45cm)</span>
              </button>
              <button
                onClick={() => onQuickSimulate('flood')}
                className="px-2.5 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors flex items-center gap-1"
              >
                <ShieldAlert size={13} className="text-red-400" />
                <span>Banjir Kilat (88cm)</span>
              </button>
              <button
                onClick={() => onQuickSimulate('normal')}
                className="px-2.5 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors flex items-center gap-1"
              >
                <Sun size={13} className="text-emerald-400" />
                <span>Air Surut (12cm)</span>
              </button>
              <button
                onClick={() => onQuickSimulate('low_bat')}
                className="px-2.5 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors flex items-center gap-1"
              >
                <BatteryCharging size={13} className="text-yellow-400" />
                <span>Bateri Lemah (3.35V)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Real-time Telemetry Trend Graph */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white">Trend Paras Air & Garisan Ambang Keselamatan</h3>
            <p className="text-xs text-slate-400">Rakaman data masa nyata setiap 2 saat dengan amaran bertingkat</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> &lt;30cm Normal
            </span>
            <span className="flex items-center gap-1.5 text-yellow-400">
              <span className="w-2 h-2 rounded-full bg-yellow-400" /> 30-50cm Waspada
            </span>
            <span className="flex items-center gap-1.5 text-orange-400">
              <span className="w-2 h-2 rounded-full bg-orange-400" /> 50-80cm Amaran
            </span>
            <span className="flex items-center gap-1.5 text-red-400">
              <span className="w-2 h-2 rounded-full bg-red-400" /> &gt;80cm Bahaya
            </span>
          </div>
        </div>

        {/* SVG Graph */}
        <div className="w-full h-44 bg-slate-950 rounded-lg p-2 relative overflow-hidden">
          {/* Threshold Lines */}
          <div className="absolute inset-x-0 bottom-[80%] border-b border-red-500/40 border-dashed pointer-events-none" />
          <div className="absolute inset-x-0 bottom-[50%] border-b border-orange-500/40 border-dashed pointer-events-none" />
          <div className="absolute inset-x-0 bottom-[30%] border-b border-yellow-500/40 border-dashed pointer-events-none" />

          <svg className="w-full h-full" viewBox="0 0 600 150" preserveAspectRatio="none">
            <defs>
              <linearGradient id="waterAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            {chartPoints.area && (
              <path d={chartPoints.area} fill="url(#waterAreaGrad)" />
            )}
            {chartPoints.path && (
              <path
                d={chartPoints.path}
                fill="none"
                stroke="#22d3ee"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>

          {/* Current point highlight */}
          <div className="absolute top-2 right-3 px-2 py-0.5 rounded bg-slate-900/90 border border-slate-700 text-[11px] font-mono text-cyan-300">
            Kini: {telemetry.waterLevel.toFixed(1)} cm
          </div>
        </div>
      </div>
    </div>
  );
};
