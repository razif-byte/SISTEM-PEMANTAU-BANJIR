import React, { useState } from 'react';
import { CalibrationConfig, McuChipModel } from '../types/telemetry';
import {
  Sliders,
  CheckCircle2,
  Save,
  RotateCcw,
  Zap,
  Battery,
  Layers,
  Database
} from 'lucide-react';

interface CalibrationStudioProps {
  config: CalibrationConfig;
  setConfig: React.Dispatch<React.SetStateAction<CalibrationConfig>>;
  currentRawFreq: number;
  currentFilteredFreq: number;
  selectedMcu: McuChipModel;
  onAutoZeroTare: () => void;
  filterBuffer: number[];
}

export const CalibrationStudio: React.FC<CalibrationStudioProps> = ({
  config,
  setConfig,
  currentRawFreq,
  currentFilteredFreq,
  selectedMcu,
  onAutoZeroTare,
  filterBuffer
}) => {
  // 2-Point Linear Regression Helper State
  const [point1Level, setPoint1Level] = useState<number>(0);
  const [point1Freq, setPoint1Freq] = useState<number>(2000);
  const [point2Level, setPoint2Level] = useState<number>(100);
  const [point2Freq, setPoint2Freq] = useState<number>(500);

  const [nvsStatusMessage, setNvsStatusMessage] = useState<string | null>(null);

  // Compute linear regression from 2 calibration points
  const handleComputeLinearRegression = () => {
    const deltaX = point2Freq - point1Freq;
    if (deltaX === 0) return;

    const deltaY = point2Level - point1Level;
    const computedM = deltaY / deltaX;
    const computedC = point1Level - (computedM * point1Freq);

    setConfig(prev => ({
      ...prev,
      mSlope: computedM,
      cOffset: computedC,
      tareOffset: 0
    }));

    showNvsAlert('Kecerunan m dan pintasan c berjaya dikira semula.');
  };

  const showNvsAlert = (msg: string) => {
    setNvsStatusMessage(msg);
    setTimeout(() => setNvsStatusMessage(null), 4000);
  };

  const handleSaveToNvs = () => {
    showNvsAlert(`[NVS COMMIT] Parameter berjaya disimpan ke Flash NVS namespace "flood_cfg"!`);
  };

  const handleFactoryReset = () => {
    setConfig({
      mSlope: -0.05,
      cOffset: 100.0,
      tareOffset: 0.0,
      filterWindowSize: 15,
      batteryR1: 100000,
      batteryR2: 100000,
      batterySoftwareMultiplier: 1.000,
      nvsNamespace: 'flood_cfg'
    });
    showNvsAlert('Semua parameter kalibrasi dikembalikan ke tetapan asal kilang.');
  };

  // Battery calculations preview
  const is10Bit = selectedMcu === 'ESP8266';
  const adcMax = is10Bit ? 1023 : 4095;
  const sampleRawAdc = Math.round(adcMax * (3.85 / 2.0 / 3.3));
  const pinVoltage = (sampleRawAdc / adcMax) * 3.3;
  const calculatedBatVoltage = pinVoltage * 2.0 * config.batterySoftwareMultiplier;

  return (
    <div className="space-y-6">
      {/* Status feedback toast */}
      {nvsStatusMessage && (
        <div className="p-3 bg-cyan-950/80 border border-cyan-700/70 text-cyan-200 text-xs rounded-xl flex items-center justify-between transition-all">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-cyan-400" />
            <span>{nvsStatusMessage}</span>
          </div>
          <button onClick={() => setNvsStatusMessage(null)} className="text-cyan-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Section 1: IC555 Frequency-to-Level Linear Regression & Tare */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-white">
                1. Kalibrasi Sensor Aras Air (Formula Linear Regression & Auto-Zero Tare)
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Metodologi: Formula <code className="text-cyan-300 font-mono">y = (m * x) + c - tare_offset</code> di mana <code className="text-slate-300">y</code> = aras air (cm) dan <code className="text-slate-300">x</code> = frekuensi IC555 (Hz).
            </p>
          </div>
          <button
            onClick={onAutoZeroTare}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors whitespace-nowrap shadow-sm"
          >
            Lakukan Auto-Zero / Tare Kini
          </button>
        </div>

        {/* 2-Point Linear Regression Tool */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-4">
            <span className="text-xs font-semibold text-slate-300">Pengiraan 2-Titik Kalibrasi (Two-Point Calibration)</span>
            
            <div className="grid grid-cols-2 gap-3 text-xs">
              {/* Point 1: Kering / Minimum */}
              <div className="space-y-1.5 p-3 rounded-lg bg-slate-900/90 border border-slate-800">
                <span className="font-semibold text-cyan-400">Titik 1 (Air Kering / Min):</span>
                <div>
                  <label className="text-slate-400 block text-[11px]">Paras y1 (cm):</label>
                  <input
                    type="number"
                    value={point1Level}
                    onChange={(e) => setPoint1Level(parseFloat(e.target.value) || 0)}
                    className="w-full mt-1 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block text-[11px]">Frekuensi x1 (Hz):</label>
                  <input
                    type="number"
                    value={point1Freq}
                    onChange={(e) => setPoint1Freq(parseFloat(e.target.value) || 0)}
                    className="w-full mt-1 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Point 2: Penuh / Maksimum */}
              <div className="space-y-1.5 p-3 rounded-lg bg-slate-900/90 border border-slate-800">
                <span className="font-semibold text-cyan-400">Titik 2 (Air Penuh / Max):</span>
                <div>
                  <label className="text-slate-400 block text-[11px]">Paras y2 (cm):</label>
                  <input
                    type="number"
                    value={point2Level}
                    onChange={(e) => setPoint2Level(parseFloat(e.target.value) || 0)}
                    className="w-full mt-1 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block text-[11px]">Frekuensi x2 (Hz):</label>
                  <input
                    type="number"
                    value={point2Freq}
                    onChange={(e) => setPoint2Freq(parseFloat(e.target.value) || 0)}
                    className="w-full mt-1 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleComputeLinearRegression}
              className="w-full py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Kira Kecerunan m & Pintasan c</span>
            </button>
          </div>

          {/* Active Calibration Parameters */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-4">
            <span className="text-xs font-semibold text-slate-300">Nilai Parameter Aktif (Disimpan dalam NVS)</span>
            
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Kecerunan (m_slope):</span>
                <span className="font-mono text-cyan-300 tabular-nums font-bold">
                  {config.mSlope.toFixed(5)} cm/Hz
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Pintasan Asas (c_offset):</span>
                <span className="font-mono text-cyan-300 tabular-nums font-bold">
                  {config.cOffset.toFixed(2)} cm
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Auto-Zero Tare Offset:</span>
                <span className="font-mono text-amber-300 tabular-nums font-bold">
                  {config.tareOffset.toFixed(2)} cm
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-800 pt-2">
                <span className="text-slate-400">Frekuensi Semasa (Tapis):</span>
                <span className="font-mono text-emerald-400 tabular-nums font-bold">
                  {currentFilteredFreq.toFixed(1)} Hz (Mentah: {currentRawFreq.toFixed(1)} Hz)
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-400 font-mono">
              Aras Air = ({config.mSlope.toFixed(4)} * {currentFilteredFreq.toFixed(1)}) + {config.cOffset.toFixed(2)} - {config.tareOffset.toFixed(2)}
              <div className="text-cyan-400 font-bold mt-1">
                = {Math.max(0, (config.mSlope * currentFilteredFreq) + config.cOffset - config.tareOffset).toFixed(2)} cm
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Moving Average Noise Filter Visualizer (10 - 20 samples) */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">
                2. Penapis Hingar Riak Air (Moving Average Filter Ring Buffer)
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Menghapuskan hingar gelombang permukaan air dengan mengambil purata bergerak {config.filterWindowSize} sampel frekuensi berturut-turut.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">Saiz Sampel Buffer:</span>
            <span className="text-xs font-mono font-bold text-amber-300">{config.filterWindowSize}</span>
            <input
              type="range"
              min="10"
              max="20"
              step="1"
              value={config.filterWindowSize}
              onChange={(e) => setConfig(prev => ({ ...prev, filterWindowSize: parseInt(e.target.value) }))}
              className="w-24 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>
        </div>

        {/* Ring Buffer Sample Cells */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Buffer Sampel Frekuensi Mentah (Hz):</span>
            <span className="font-mono text-emerald-400">
              Purata Tapis: <strong>{currentFilteredFreq.toFixed(1)} Hz</strong>
            </span>
          </div>

          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {Array.from({ length: config.filterWindowSize }).map((_, idx) => {
              const val = filterBuffer[idx] || currentRawFreq;
              return (
                <div
                  key={idx}
                  className="p-2 rounded bg-slate-950 border border-slate-800 text-center font-mono text-[11px]"
                >
                  <div className="text-[9px] text-slate-500">#{idx + 1}</div>
                  <div className="text-slate-200 font-medium tabular-nums">{val.toFixed(0)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Section 3: Battery Voltage Divider Calibration & Resistor Multiplier */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Battery className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">
              3. Kalibrasi Voltan Bateri (Voltage Divider & Software Multiplier)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Litar Pembahagi Voltan R1=100kΩ, R2=100kΩ (Nisbah 2.0x). Software multiplier membetulkan ralat toleransi perintang 5%.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* ADC Spec Card */}
          <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
            <span className="font-semibold text-slate-300">Spesifikasi ADC Cip:</span>
            <div className="flex justify-between text-slate-400">
              <span>Resolusi:</span>
              <span className="font-mono text-white">{is10Bit ? '10-bit (0-1023)' : '12-bit (0-4095)'}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Voltan Rujukan (Vref):</span>
              <span className="font-mono text-white">3.30 V</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Pin Digunakan:</span>
              <span className="font-mono text-cyan-300">{is10Bit ? 'A0' : 'ADC1 (GPIO0/4)'}</span>
            </div>
          </div>

          {/* Resistors & Divider Card */}
          <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
            <span className="font-semibold text-slate-300">Litar Pembahagi (Divider):</span>
            <div className="flex justify-between text-slate-400">
              <span>R1 (Atas):</span>
              <span className="font-mono text-white">100 kΩ</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>R2 (Bawah):</span>
              <span className="font-mono text-white">100 kΩ</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Faktor Nisbah:</span>
              <span className="font-mono text-emerald-400">2.000x</span>
            </div>
          </div>

          {/* Software Multiplier Adjuster */}
          <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-300">Software Multiplier:</span>
              <span className="font-mono font-bold text-cyan-400">
                {config.batterySoftwareMultiplier.toFixed(4)}
              </span>
            </div>
            <input
              type="range"
              min="0.900"
              max="1.100"
              step="0.005"
              value={config.batterySoftwareMultiplier}
              onChange={(e) => setConfig(prev => ({ ...prev, batterySoftwareMultiplier: parseFloat(e.target.value) }))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>-10%</span>
              <span>1.000 (Nominal)</span>
              <span>+10%</span>
            </div>
          </div>
        </div>

        {/* Calculation verification box */}
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-slate-400">
            Kiraan: (({sampleRawAdc} / {adcMax}) * 3.3V) * 2.0 * {config.batterySoftwareMultiplier.toFixed(4)}
          </div>
          <div className="text-emerald-400 font-bold">
            Voltan Bateri Terkira: = {calculatedBatVoltage.toFixed(2)} V
          </div>
        </div>
      </div>

      {/* Section 4: NVS Flash Memory & Persistence Inspector */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-white">
                4. Pengurusan Memori Kekal (NVS Flash / EEPROM Storage)
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Parameter kalibrasi tidak akan hilang apabila peranti dimatikan atau berlaku pemotongan bekalan elektrik.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleFactoryReset}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <RotateCcw size={13} />
              <span>Reset Kilang</span>
            </button>
            <button
              onClick={handleSaveToNvs}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Save size={13} />
              <span>Simpan ke NVS Flash</span>
            </button>
          </div>
        </div>

        {/* NVS Partition Table Inspector */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2 px-3">Partition / Namespace</th>
                <th className="py-2 px-3">Kunci (Key)</th>
                <th className="py-2 px-3">Jenis Data</th>
                <th className="py-2 px-3">Nilai Tersimpan</th>
                <th className="py-2 px-3">Status Flash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              <tr>
                <td className="py-2 px-3 text-indigo-400">flood_cfg</td>
                <td className="py-2 px-3">m_slope</td>
                <td className="py-2 px-3 text-slate-500">float32</td>
                <td className="py-2 px-3 text-cyan-300">{config.mSlope.toFixed(5)}</td>
                <td className="py-2 px-3 text-emerald-400">COMMITTED</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-indigo-400">flood_cfg</td>
                <td className="py-2 px-3">c_offset</td>
                <td className="py-2 px-3 text-slate-500">float32</td>
                <td className="py-2 px-3 text-cyan-300">{config.cOffset.toFixed(2)}</td>
                <td className="py-2 px-3 text-emerald-400">COMMITTED</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-indigo-400">flood_cfg</td>
                <td className="py-2 px-3">tare_offset</td>
                <td className="py-2 px-3 text-slate-500">float32</td>
                <td className="py-2 px-3 text-amber-300">{config.tareOffset.toFixed(2)}</td>
                <td className="py-2 px-3 text-emerald-400">COMMITTED</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-indigo-400">flood_cfg</td>
                <td className="py-2 px-3">bat_mul</td>
                <td className="py-2 px-3 text-slate-500">float32</td>
                <td className="py-2 px-3 text-cyan-300">{config.batterySoftwareMultiplier.toFixed(4)}</td>
                <td className="py-2 px-3 text-emerald-400">COMMITTED</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-indigo-400">flood_cfg</td>
                <td className="py-2 px-3">flt_win</td>
                <td className="py-2 px-3 text-slate-500">int32</td>
                <td className="py-2 px-3 text-cyan-300">{config.filterWindowSize}</td>
                <td className="py-2 px-3 text-emerald-400">COMMITTED</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
