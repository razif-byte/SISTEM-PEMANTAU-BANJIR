import React, { useState } from 'react';
import { McuChipModel, CalibrationConfig } from '../types/telemetry';
import { MCU_DEFINITIONS } from '../data/mcuDefinitions';
import {
  generateArduinoCode,
  generatePlatformIoIni,
  generatePartitionsCsv,
  generateOtaCode
} from '../data/firmwareCode';
import {
  Cpu,
  Copy,
  Check,
  Download,
  Code2,
  FileCode,
  Info,
  Radio,
  RefreshCw,
  HardDrive,
  ShieldCheck,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

interface FirmwareGeneratorProps {
  selectedMcu: McuChipModel;
  setSelectedMcu: (mcu: McuChipModel) => void;
  config: CalibrationConfig;
}

export const FirmwareGenerator: React.FC<FirmwareGeneratorProps> = ({
  selectedMcu,
  setSelectedMcu,
  config
}) => {
  const [activeCodeTab, setActiveCodeTab] = useState<'ino' | 'ota' | 'partitions' | 'ini'>('ino');
  const [flashSize, setFlashSize] = useState<'4MB' | '8MB'>('4MB');
  const [enableOtaUpload, setEnableOtaUpload] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  // OTA Interactive Simulation State
  const [otaSimState, setOtaSimState] = useState<'idle' | 'checking' | 'downloading' | 'verifying' | 'rebooting' | 'validated'>('idle');
  const [otaProgress, setOtaProgress] = useState<number>(0);

  const mcuInfo = MCU_DEFINITIONS[selectedMcu];
  const inoCode = generateArduinoCode(selectedMcu, config);
  const otaCode = generateOtaCode(selectedMcu, '2.5.0');
  const partitionsCode = generatePartitionsCsv(flashSize);
  const iniCode = generatePlatformIoIni(selectedMcu, enableOtaUpload);

  const getActiveCode = () => {
    switch (activeCodeTab) {
      case 'ota':
        return otaCode;
      case 'partitions':
        return partitionsCode;
      case 'ini':
        return iniCode;
      case 'ino':
      default:
        return inoCode;
    }
  };

  const activeCode = getActiveCode();

  const handleCopy = () => {
    navigator.clipboard.writeText(activeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    const filenameMap = {
      ino: 'flood_sensor_node.ino',
      ota: 'ota_manager.cpp',
      partitions: 'partitions.csv',
      ini: 'platformio.ini'
    };
    const filename = filenameMap[activeCodeTab];
    const blob = new Blob([activeCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Run interactive OTA Flash Simulation
  const handleStartOtaSimulation = () => {
    if (otaSimState !== 'idle' && otaSimState !== 'validated') return;
    setOtaSimState('checking');
    setOtaProgress(5);

    setTimeout(() => {
      setOtaSimState('downloading');
      let currentP = 15;
      const interval = setInterval(() => {
        currentP += 12;
        if (currentP >= 80) {
          clearInterval(interval);
          setOtaProgress(82);
          setOtaSimState('verifying');

          setTimeout(() => {
            setOtaProgress(94);
            setOtaSimState('rebooting');

            setTimeout(() => {
              setOtaProgress(100);
              setOtaSimState('validated');
            }, 1800);
          }, 1500);
        } else {
          setOtaProgress(currentP);
        }
      }, 300);
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* MCU Chip Selector Tabs */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold text-white uppercase tracking-wider">
              Pilih Mikropengawal Sasaran (Target MCU)
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            Penetapan Compiler Directive: <code className="text-cyan-300 font-mono">#define BOARD_{selectedMcu.replace('-', '_')}</code>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {(['ESP32-C3', 'ESP32-S3', 'ESP32-C6', 'ESP32-P4', 'ESP8266'] as McuChipModel[]).map((chip) => {
            const isSelected = selectedMcu === chip;
            return (
              <button
                key={chip}
                onClick={() => setSelectedMcu(chip)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'border-cyan-500 bg-cyan-950/40 text-cyan-200 shadow-sm'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-bold font-mono">{chip}</div>
                <div className="text-[10px] text-slate-400 mt-1 truncate">
                  {chip === 'ESP8266' ? '10-bit ADC / Wi-Fi 4' : chip === 'ESP32-P4' ? '12-bit / Dual RISC-V' : chip === 'ESP32-C6' ? '12-bit / Wi-Fi 6' : '12-bit / Dual/Single'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Hardware Pinout & Chip Specs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left: Specs & Pinout Definition */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-sm font-semibold text-white">Konfigurasi Pinout ({mcuInfo.model})</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
              {mcuInfo.adcResolution}
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Seni Bina Teras (Architecture):</span>
              <span className="font-mono text-slate-200 text-right">{mcuInfo.coreArch}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Kelajuan Jam (Clock Speed):</span>
              <span className="font-mono text-cyan-300">{mcuInfo.clockSpeed}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Pin Interrupt Frekuensi (IC555):</span>
              <span className="font-mono font-bold text-amber-300">{mcuInfo.interruptPins}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Pin Pembahagi Voltan Bateri (ADC):</span>
              <span className="font-mono font-bold text-emerald-300">{mcuInfo.adcPins}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Voltan Rujukan ADC (Vref):</span>
              <span className="font-mono text-slate-200">{mcuInfo.adcvRef}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Antaramuka Rangkaian:</span>
              <span className="font-mono text-slate-200 text-right">{mcuInfo.networkInterface}</span>
            </div>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 text-[11px] text-slate-400 flex items-start gap-2">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-300 block mb-0.5">Nota Khusus Perkakasan:</strong>
              {mcuInfo.notes}
            </div>
          </div>
        </div>

        {/* Right: Electronic Schematic SVG Diagram */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 flex flex-col justify-between">
          <div className="border-b border-slate-800 pb-2">
            <span className="text-sm font-semibold text-white">Litar Skematik Sambungan Elektronik</span>
            <p className="text-[11px] text-slate-400">
              Litar Pengayun IC555 Astable + Probe Tiang Air + Pembahagi Voltan Bateri R1/R2
            </p>
          </div>

          {/* SVG Diagram */}
          <div className="w-full h-56 bg-slate-950 rounded-lg border border-slate-800 p-2 flex items-center justify-center overflow-hidden">
            <svg viewBox="0 0 450 200" className="w-full h-full text-slate-300">
              {/* IC555 Box */}
              <rect x="140" y="40" width="100" height="90" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
              <text x="190" y="65" fill="#f8fafc" fontSize="12" fontWeight="bold" textAnchor="middle">IC 555</text>
              <text x="190" y="80" fill="#94a3b8" fontSize="9" textAnchor="middle">Astable Mode</text>
              <text x="190" y="115" fill="#38bdf8" fontSize="10" textAnchor="middle" fontFamily="monospace">Pin 3 (OUT)</text>

              {/* Water Probe Box (Variable capacitor) */}
              <rect x="20" y="55" width="80" height="60" rx="4" fill="#0f172a" stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="3 2" />
              <text x="60" y="80" fill="#22d3ee" fontSize="10" fontWeight="bold" textAnchor="middle">PROBE AIR</text>
              <text x="60" y="95" fill="#64748b" fontSize="8" textAnchor="middle">Tiang Sensor (C)</text>

              {/* Wire Probe to IC555 */}
              <path d="M 100 85 L 140 85" stroke="#38bdf8" strokeWidth="1.5" />

              {/* Wire IC555 Pin 3 to MCU */}
              <path d="M 240 85 L 310 85" stroke="#f59e0b" strokeWidth="2" />
              <text x="275" y="78" fill="#f59e0b" fontSize="8" textAnchor="middle" fontFamily="monospace">Frekuensi</text>

              {/* MCU Box */}
              <rect x="310" y="30" width="120" height="135" rx="6" fill="#0f172a" stroke="#10b981" strokeWidth="1.5" />
              <text x="370" y="52" fill="#10b981" fontSize="12" fontWeight="bold" textAnchor="middle">{selectedMcu}</text>
              <text x="370" y="68" fill="#64748b" fontSize="8" textAnchor="middle">Mikropengawal</text>

              {/* MCU Pins */}
              <rect x="315" y="75" width="110" height="20" rx="3" fill="#1e293b" />
              <text x="370" y="89" fill="#f59e0b" fontSize="9" textAnchor="middle" fontFamily="monospace">
                Freq: {mcuInfo.interruptPins.split(' ')[0]}
              </text>

              <rect x="315" y="105" width="110" height="20" rx="3" fill="#1e293b" />
              <text x="370" y="119" fill="#10b981" fontSize="9" textAnchor="middle" fontFamily="monospace">
                ADC: {mcuInfo.adcPins.split(' ')[0]}
              </text>

              {/* Battery & Voltage divider */}
              <rect x="20" y="140" width="70" height="35" rx="4" fill="#1e293b" stroke="#10b981" strokeWidth="1" />
              <text x="55" y="157" fill="#34d399" fontSize="9" fontWeight="bold" textAnchor="middle">BATERI 3.7V</text>
              <text x="55" y="168" fill="#64748b" fontSize="8" textAnchor="middle">LiPo 1S</text>

              {/* Divider Box */}
              <rect x="135" y="140" width="110" height="35" rx="4" fill="#0f172a" stroke="#64748b" strokeWidth="1" />
              <text x="190" y="155" fill="#cbd5e1" fontSize="8" textAnchor="middle">R1 (100k) + R2 (100k)</text>
              <text x="190" y="167" fill="#38bdf8" fontSize="8" textAnchor="middle">Vout = Vin * 0.5</text>

              {/* Wire Battery to Divider to MCU ADC */}
              <path d="M 90 157 L 135 157" stroke="#10b981" strokeWidth="1.5" />
              <path d="M 245 157 L 280 157 L 280 115 L 315 115" stroke="#10b981" strokeWidth="1.5" />
            </svg>
          </div>

          <div className="text-[11px] text-slate-400">
            Litar IC555 menghasilkan denyutan gelombang segi empat yang berkadar terus dengan kapasitans probe aras air.
          </div>
        </div>
      </div>

      {/* NEW MODULE: OTA UPDATE & PARTITION TABLE ARCHITECTURE */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-white">
                Modul Kemas Kini OTA (Over-the-Air) & Jadual Partisi Flash (Dual-OTA)
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Sistem kemas kini tanpa wayar dengan skim partisi Dual-OTA (A/B testing) dan perlindungan pemulihan automatik (Anti-Rollback Protection).
            </p>
          </div>

          {/* Flash Size Selector & OTA Protocol */}
          <div className="flex items-center gap-2">
            <select
              value={flashSize}
              onChange={(e) => setFlashSize(e.target.value as '4MB' | '8MB')}
              className="px-2.5 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono"
            >
              <option value="4MB">Flash 4MB (Standard Dual-OTA)</option>
              <option value="8MB">Flash 8MB (Extended Dual-OTA)</option>
            </select>

            <button
              onClick={() => setEnableOtaUpload(!enableOtaUpload)}
              className={`px-3 py-1 text-xs rounded border transition-colors ${
                enableOtaUpload
                  ? 'bg-cyan-950/70 border-cyan-700/80 text-cyan-300 font-medium'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              {enableOtaUpload ? 'Protokol: espota (3232)' : 'Protokol: Serial USB'}
            </button>
          </div>
        </div>

        {/* Visual Flash Partition Allocation Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium flex items-center gap-1.5">
              <HardDrive size={14} className="text-cyan-400" />
              <span>Peta Agihan Memori Flash (Dual-OTA Partition Scheme):</span>
            </span>
            <span className="font-mono text-cyan-400 text-[11px]">
              Kapasiti Penuh: {flashSize} (Offset 0x000000 - {flashSize === '4MB' ? '0x400000' : '0x800000'})
            </span>
          </div>

          {/* Graphical Partition Bar */}
          <div className="w-full h-8 bg-slate-950 rounded-lg border border-slate-700/80 p-1 flex gap-1 overflow-hidden font-mono text-[10px]">
            {/* NVS */}
            <div
              className="h-full bg-indigo-700/80 rounded flex items-center justify-center text-white px-1 font-bold truncate"
              style={{ width: '4%' }}
              title="nvs (0x9000, 20KB) - Parameter Kalibrasi"
            >
              nvs
            </div>
            {/* otadata */}
            <div
              className="h-full bg-amber-600/80 rounded flex items-center justify-center text-white px-1 font-bold truncate"
              style={{ width: '3%' }}
              title="otadata (0xe000, 8KB) - Penunjuk Status Bootloader"
            >
              ota
            </div>
            {/* app0 (ota_0) */}
            <div
              className="h-full bg-emerald-700/90 rounded flex items-center justify-center text-white px-2 font-bold truncate"
              style={{ width: '46%' }}
              title="app0 (0x10000, 1.875MB) - Slot Firmware Aktif (Slot A)"
            >
              app0 (ota_0) - Slot Aktif (1.875MB)
            </div>
            {/* app1 (ota_1) */}
            <div
              className="h-full bg-cyan-700/90 rounded flex items-center justify-center text-white px-2 font-bold truncate"
              style={{ width: '43%' }}
              title="app1 (0x1F0000, 1.875MB) - Slot OTA Sasaran (Slot B)"
            >
              app1 (ota_1) - Slot OTA (1.875MB)
            </div>
            {/* spiffs */}
            <div
              className="h-full bg-slate-700 rounded flex items-center justify-center text-slate-300 px-1 font-bold truncate"
              style={{ width: '4%' }}
              title="spiffs (0x3D0000, 192KB) - Storan Fail"
            >
              fs
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] text-slate-400 font-mono mt-1">
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-indigo-600" /> nvs: 20KB (Kalibrasi)</div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500" /> otadata: 8KB (Boot Selector)</div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-600" /> app0: 1920KB (Slot A)</div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-cyan-600" /> app1: 1920KB (Slot B)</div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-slate-600" /> spiffs: 192KB (Filesystem)</div>
          </div>
        </div>

        {/* Interactive OTA Process Simulator Widget */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-slate-200">
                Simulator Proses Kemas Kini OTA Masa Nyata
              </span>
              <p className="text-[11px] text-slate-400">
                Uji kitaran hayat kemas kini: Muat turun binari, penulisan partisi ota_1, dan pengesahan Anti-Rollback.
              </p>
            </div>

            <button
              onClick={handleStartOtaSimulation}
              disabled={otaSimState !== 'idle' && otaSimState !== 'validated'}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm self-start sm:self-auto"
            >
              <RefreshCw size={13} className={otaSimState !== 'idle' && otaSimState !== 'validated' ? 'animate-spin' : ''} />
              <span>{otaSimState === 'idle' ? 'Mulakan Ujian Kemas Kini OTA' : otaSimState === 'validated' ? 'Uji Semula OTA' : 'Sedang Kemas Kini...'}</span>
            </button>
          </div>

          {/* Progress Bar & Status Details */}
          {otaSimState !== 'idle' && (
            <div className="space-y-2 p-3 rounded-lg bg-slate-900 border border-slate-800">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-300">
                  {otaSimState === 'checking' && 'Langkah 1/5: Menyemak versi binari di pelayan pusat (v2.4.0 -> v2.5.0)...'}
                  {otaSimState === 'downloading' && `Langkah 2/5: Menulis fail binari ke partisi app1 (ota_1)... ${otaProgress}%`}
                  {otaSimState === 'verifying' && 'Langkah 3/5: Mengesahkan integriti hash SHA-256 dan RSA signature...'}
                  {otaSimState === 'rebooting' && 'Langkah 4/5: Kemas kini otadata selesai. Memulakan but semula (Reboot)...'}
                  {otaSimState === 'validated' && 'Langkah 5/5: But ke app1 berjaya! Sensor beroperasi nominal (Rollback dibatalkan).'}
                </span>
                <span className="text-cyan-400 font-bold">{otaProgress}%</span>
              </div>

              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    otaSimState === 'validated' ? 'bg-emerald-500' : 'bg-cyan-500'
                  }`}
                  style={{ width: `${otaProgress}%` }}
                />
              </div>

              {otaSimState === 'validated' && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono mt-1">
                  <CheckCircle2 size={13} />
                  <span>[ESP-IDF] esp_ota_mark_app_valid_cancel_rollback() berjaya dipanggil. Peranti kini kekal pada versi 2.5.0!</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Code Viewer Panel */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setActiveCodeTab('ino')}
              className={`px-3 py-1.5 font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeCodeTab === 'ino'
                  ? 'bg-cyan-950 border border-cyan-700/80 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 size={14} />
              <span>flood_sensor_node.ino</span>
            </button>
            <button
              onClick={() => setActiveCodeTab('ota')}
              className={`px-3 py-1.5 font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeCodeTab === 'ota'
                  ? 'bg-cyan-950 border border-cyan-700/80 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio size={14} />
              <span>ota_manager.cpp (OTA Module)</span>
            </button>
            <button
              onClick={() => setActiveCodeTab('partitions')}
              className={`px-3 py-1.5 font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeCodeTab === 'partitions'
                  ? 'bg-cyan-950 border border-cyan-700/80 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <HardDrive size={14} />
              <span>partitions.csv (Dual-OTA)</span>
            </button>
            <button
              onClick={() => setActiveCodeTab('ini')}
              className={`px-3 py-1.5 font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeCodeTab === 'ini'
                  ? 'bg-cyan-950 border border-cyan-700/80 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode size={14} />
              <span>platformio.ini</span>
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copied ? 'Disalin!' : 'Salin Kod'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Download size={14} />
              <span>Muat Turun Fail</span>
            </button>
          </div>
        </div>

        {/* Code Content Block */}
        <div className="relative">
          <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-mono text-xs overflow-x-auto max-h-[500px] leading-relaxed">
            <code>{activeCode}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
