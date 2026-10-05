import React, { useState } from 'react';
import { TelemetryPayload, McuChipModel } from '../types/telemetry';
import { FLUTTER_PROJECT_FILES, FlutterFile } from '../data/flutterCode';
import {
  Smartphone,
  Code2,
  Copy,
  Check,
  Download,
  Wifi,
  Battery,
  Waves,
  Sliders,
  AlertTriangle,
  RotateCcw,
  CheckCircle,
  ExternalLink
} from 'lucide-react';

interface FlutterMobileSuiteProps {
  telemetry: TelemetryPayload;
  selectedMcu: McuChipModel;
  onAutoZeroTare: () => void;
}

export const FlutterMobileSuite: React.FC<FlutterMobileSuiteProps> = ({
  telemetry,
  selectedMcu,
  onAutoZeroTare
}) => {
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);
  const [phoneScreenTab, setPhoneScreenTab] = useState<'monitor' | 'calibrate'>('monitor');
  const [phoneTareToast, setPhoneTareToast] = useState<string | null>(null);

  const selectedFile = FLUTTER_PROJECT_FILES[selectedFileIndex];

  const handleCopyCode = () => {
    navigator.clipboard.writeText(selectedFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadFile = () => {
    const blob = new Blob([selectedFile.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = selectedFile.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePhoneTareClick = () => {
    onAutoZeroTare();
    setPhoneTareToast('Auto-Zero berjaya: Titik sifar 0.0cm disimpan!');
    setTimeout(() => setPhoneTareToast(null), 3500);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'BAHAYA':
        return '#ef4444';
      case 'AMARAN':
        return '#f97316';
      case 'WASPADA':
        return '#eab308';
      case 'NORMAL':
      default:
        return '#10b981';
    }
  };

  const statusColor = getStatusColor(telemetry.status);

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-semibold text-white">
              Seni Bina & Simulator Aplikasi Mudah Alih Flutter (Android)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Aplikasi Android asli menggunakan Flutter SDK (Material 3, Provider State, HTTP REST Client & Remote Tare)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-cyan-300 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800">
            Flutter 3.x / Dart 3.x
          </span>
        </div>
      </div>

      {/* Main Grid: Interactive Mobile Phone Mockup (5 cols) + Dart Code Explorer (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Phone Mockup (5 cols) */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="text-xs font-medium text-slate-400 mb-3 flex items-center gap-2">
            <span>Pratonton Interaktif Skrin Android</span>
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>

          {/* Android Smartphone Bezel Frame */}
          <div className="w-[310px] h-[590px] bg-slate-950 border-[6px] border-slate-800 rounded-[38px] shadow-2xl p-2.5 flex flex-col justify-between relative overflow-hidden ring-1 ring-slate-700/50">
            {/* Top Speaker / Camera Notch */}
            <div className="absolute top-3 inset-x-0 flex justify-center pointer-events-none z-30">
              <div className="w-20 h-4 bg-slate-800 rounded-full flex items-center justify-end px-2">
                <div className="w-2 h-2 rounded-full bg-slate-900" />
              </div>
            </div>

            {/* Inner Phone Screen */}
            <div className="w-full h-full bg-[#0a0f1d] rounded-[28px] overflow-hidden flex flex-col text-slate-100 select-none relative pt-4">
              {/* Phone Status Bar */}
              <div className="px-4 py-1 flex items-center justify-between text-[10px] font-mono text-slate-400 z-20">
                <span>12:45</span>
                <div className="flex items-center gap-1.5">
                  <Wifi size={11} className="text-cyan-400" />
                  <Battery size={12} className="text-emerald-400" />
                  <span>{telemetry.batteryPercentage}%</span>
                </div>
              </div>

              {/* Phone App Bar */}
              <div className="px-3 py-2 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between z-20">
                <div className="flex items-center gap-1.5">
                  <img
                    src="/app-logo.jpg"
                    alt="NASA DEF Logo"
                    className="w-5 h-5 rounded object-contain border border-emerald-500/50 bg-slate-900"
                  />
                  <span className="text-[11px] font-bold text-white tracking-tight truncate max-w-[140px]">
                    NASA DEF ({telemetry.chipModel})
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>ONLINE</span>
                </div>
              </div>

              {/* Phone Content Screen */}
              <div className="flex-1 p-3 overflow-y-auto space-y-3 font-sans">
                {phoneTareToast && (
                  <div className="p-2 bg-emerald-950/90 border border-emerald-500/50 text-[10px] text-emerald-300 rounded-lg flex items-center gap-1.5 shadow-md animate-fadeIn">
                    <CheckCircle size={12} className="shrink-0" />
                    <span>{phoneTareToast}</span>
                  </div>
                )}

                {phoneScreenTab === 'monitor' ? (
                  <>
                    {/* Status Alert Card */}
                    <div
                      className="p-3 rounded-xl border flex items-center gap-2.5 transition-all"
                      style={{
                        backgroundColor: `${statusColor}18`,
                        borderColor: `${statusColor}60`
                      }}
                    >
                      <div
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: `${statusColor}30`, color: statusColor }}
                      >
                        <AlertTriangle size={18} />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold tracking-wider uppercase text-slate-400">STATUS KESELAMATAN</div>
                        <div className="text-xs font-bold" style={{ color: statusColor }}>
                          [{telemetry.status}]
                        </div>
                        <div className="text-[9px] text-slate-300 mt-0.5">
                          {telemetry.status === 'BAHAYA'
                            ? 'Banjir besar! Berpindah ke PPS.'
                            : telemetry.status === 'AMARAN'
                            ? 'Air meningkat cepat. Sedia berpindah.'
                            : telemetry.status === 'WASPADA'
                            ? 'Paras waspada, teruskan memantau.'
                            : 'Paras air selamat tiada ancaman.'}
                        </div>
                      </div>
                    </div>

                    {/* Main Water Level Gauge Container */}
                    <div className="p-3.5 rounded-xl bg-[#131d33] border border-white/5 text-center space-y-2">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Ketinggian Aras Air Semasa
                      </span>

                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-4xl font-extrabold font-mono" style={{ color: statusColor }}>
                          {telemetry.waterLevel.toFixed(1)}
                        </span>
                        <span className="text-sm font-bold text-slate-400">cm</span>
                      </div>

                      {/* Animated Water Bar Level */}
                      <div className="w-full h-3.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-700/60">
                        <div
                          className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-cyan-500 to-blue-500"
                          style={{
                            width: `${Math.min(100, Math.max(5, (telemetry.waterLevel / 100) * 100))}%`,
                            backgroundColor: statusColor
                          }}
                        />
                      </div>

                      <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                        <span>0cm Dasar</span>
                        <span>50cm Waspada</span>
                        <span>100cm+</span>
                      </div>
                    </div>

                    {/* Sensor and Battery Tiles */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-[#131d33] border border-white/5 space-y-1">
                        <span className="text-[9px] text-slate-400 block">Frekuensi IC555</span>
                        <span className="text-xs font-mono font-bold text-amber-300 block">
                          {telemetry.rawFrequency.toFixed(0)} Hz
                        </span>
                        <span className="text-[8px] text-slate-500">Tapis Moving Avg</span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-[#131d33] border border-white/5 space-y-1">
                        <span className="text-[9px] text-slate-400 block">Bateri Tiang</span>
                        <span className="text-xs font-mono font-bold text-emerald-300 block">
                          {telemetry.batteryVoltage.toFixed(2)} V ({telemetry.batteryPercentage}%)
                        </span>
                        <span className="text-[8px] text-slate-500">LiPo 1S Solar</span>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Calibration Screen on Phone */
                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded-xl bg-[#131d33] border border-cyan-500/30 space-y-2">
                      <span className="font-bold text-cyan-300 text-xs block">Auto-Zero (Tare Offset)</span>
                      <p className="text-[10px] text-slate-300 leading-tight">
                        Tetapkan aras air semasa sebagai 0 cm dari jauh. Peranti tiang akan mengemas kini NVS Flash.
                      </p>
                      <button
                        onClick={handlePhoneTareClick}
                        className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-[10px] transition-colors shadow"
                      >
                        LAKUKAN AUTO-ZERO (TARE)
                      </button>
                    </div>

                    <div className="p-3 rounded-xl bg-[#131d33] border border-white/5 space-y-2">
                      <span className="font-bold text-slate-200 text-xs block">Gateway Endpoint</span>
                      <div className="p-2 bg-slate-900 rounded border border-slate-700 font-mono text-[9px] text-slate-300 truncate">
                        http://192.168.1.100:3000
                      </div>
                      <span className="text-[9px] text-emerald-400 block">✓ Status: Bersambung</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Phone Bottom Navigation Bar */}
              <div className="h-12 bg-[#0f172a] border-t border-slate-800 flex items-center justify-around px-2 z-20">
                <button
                  onClick={() => setPhoneScreenTab('monitor')}
                  className={`flex flex-col items-center gap-0.5 text-[9px] ${
                    phoneScreenTab === 'monitor' ? 'text-cyan-400 font-bold' : 'text-slate-500'
                  }`}
                >
                  <Waves size={15} />
                  <span>Pemantauan</span>
                </button>
                <button
                  onClick={() => setPhoneScreenTab('calibrate')}
                  className={`flex flex-col items-center gap-0.5 text-[9px] ${
                    phoneScreenTab === 'calibrate' ? 'text-cyan-400 font-bold' : 'text-slate-500'
                  }`}
                >
                  <RotateCcw size={15} />
                  <span>Kalibrasi & Tare</span>
                </button>
              </div>

              {/* Android Home Bar Indicator */}
              <div className="w-full flex justify-center pb-1">
                <div className="w-24 h-1 bg-slate-600 rounded-full" />
              </div>
            </div>
          </div>

          {/* App Launcher Icon Badge Box */}
          <div className="mt-4 p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3 w-[310px]">
            <img
              src="/app-logo.jpg"
              alt="NASA DEF SDN BHD App Icon"
              className="w-12 h-12 rounded-xl object-contain border border-emerald-500/50 bg-slate-950 p-1 shadow-lg shrink-0"
            />
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-white block">NASA DEF SDN BHD</span>
              <span className="text-[10px] text-slate-400 font-mono block">ic_launcher.png (Adaptive Icon)</span>
              <span className="text-[9px] text-emerald-400 block">✓ Logo Rasmi Aplikasi Android</span>
            </div>
          </div>
        </div>

        {/* Right: Flutter Dart Code Explorer (7 cols) */}
        <div className="lg:col-span-7 p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-semibold text-white">
                  Penjelajah Kod Sumber Flutter (Flutter Dart Project)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{selectedFile.description}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyCode}
                className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copied ? 'Disalin!' : 'Salin Dart'}</span>
              </button>
              <button
                onClick={handleDownloadFile}
                className="px-3 py-1.5 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Download size={14} />
                <span>Muat Turun Fail</span>
              </button>
            </div>
          </div>

          {/* File selector pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {FLUTTER_PROJECT_FILES.map((file, idx) => {
              const isSelected = selectedFileIndex === idx;
              return (
                <button
                  key={file.path}
                  onClick={() => setSelectedFileIndex(idx)}
                  className={`px-3 py-1.5 rounded-lg border font-mono whitespace-nowrap transition-colors ${
                    isSelected
                      ? 'bg-cyan-950 border-cyan-700/80 text-cyan-300 font-bold'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {file.filename}
                </button>
              );
            })}
          </div>

          {/* Code Viewer */}
          <div className="relative">
            <div className="absolute top-2 right-3 text-[10px] font-mono text-slate-500">
              {selectedFile.path}
            </div>
            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-mono text-xs overflow-x-auto max-h-[460px] leading-relaxed">
              <code>{selectedFile.code}</code>
            </pre>
          </div>

          {/* Quick instructions to build Flutter APK */}
          <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-lg text-xs space-y-1.5">
            <span className="font-semibold text-slate-300 block">Langkah Menjalankan Aplikasi Flutter:</span>
            <div className="font-mono text-[11px] text-cyan-300 space-y-1">
              <div>$ flutter create flood_sensor_monitor</div>
              <div>$ cd flood_sensor_monitor && flutter pub get</div>
              <div>$ flutter run -d android</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
