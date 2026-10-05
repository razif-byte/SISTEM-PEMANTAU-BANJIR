import React from 'react';
import { Volume2, VolumeX, RotateCcw } from 'lucide-react';

interface HeaderProps {
  activeTab: 'dashboard' | 'calibration' | 'firmware' | 'api' | 'flutter';
  setActiveTab: (tab: 'dashboard' | 'calibration' | 'firmware' | 'api' | 'flutter') => void;
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  onResetSimulation: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  soundEnabled,
  setSoundEnabled,
  onResetSimulation
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Papan Pemuka' },
    { id: 'calibration', label: 'Kalibrasi & NVS' },
    { id: 'firmware', label: 'Firmware Multi-MCU' },
    { id: 'api', label: 'API & MQTT Hub' },
    { id: 'flutter', label: 'Aplikasi Flutter' },
  ] as const;

  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Zone 1: Brand mark with official logo */}
        <div className="flex items-center gap-3">
          <img
            src="/app-logo.jpg"
            alt="NASA DEF SDN BHD Logo"
            className="w-9 h-9 rounded-lg object-contain border border-emerald-600/40 bg-slate-900 shadow-md p-0.5 shrink-0"
          />
          <div>
            <span className="text-sm font-bold tracking-tight text-white font-['Plus_Jakarta_Sans'] block leading-none">
              NASA DEF SDN BHD
            </span>
            <span className="text-[10px] font-mono text-emerald-400 block mt-1 leading-none">
              Sistem Pemantauan Banjir IoT
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 sm:gap-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  isActive
                    ? 'text-cyan-300 bg-cyan-950/60 border border-cyan-800/70'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Matikan Siren Bunyi' : 'Aktifkan Siren Bunyi'}
            className={`p-2 rounded-lg border transition-colors ${
              soundEnabled
                ? 'border-cyan-600/60 text-cyan-300 bg-cyan-950/40'
                : 'border-slate-800 text-slate-500 hover:text-slate-300 bg-slate-900/60'
            }`}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          <button
            onClick={onResetSimulation}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg transition-colors whitespace-nowrap"
          >
            <RotateCcw size={13} />
            <span>Reset Simulasi</span>
          </button>
        </div>
      </div>

      {/* Mobile nav row */}
      <div className="md:hidden flex items-center gap-1 px-4 py-2 overflow-x-auto border-t border-slate-900 bg-slate-950">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap ${
                isActive
                  ? 'text-cyan-300 bg-cyan-950/60 border border-cyan-800/70'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
};
