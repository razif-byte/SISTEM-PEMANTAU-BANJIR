import React, { useState } from 'react';
import { TelemetryPayload, McuChipModel, AlertStatus } from '../types/telemetry';
import { BACKEND_SERVER_CODE } from '../data/backendCode';
import {
  Send,
  Radio,
  Server,
  Code2,
  Copy,
  Check,
  Terminal,
  Activity,
  ShieldAlert
} from 'lucide-react';

interface ApiTestingHubProps {
  currentTelemetry: TelemetryPayload;
  onDispatchPayload: (payload: TelemetryPayload) => void;
}

export const ApiTestingHub: React.FC<ApiTestingHubProps> = ({
  currentTelemetry,
  onDispatchPayload
}) => {
  const [testChip, setTestChip] = useState<McuChipModel>(currentTelemetry.chipModel);
  const [testWaterLevel, setTestWaterLevel] = useState<number>(currentTelemetry.waterLevel);
  const [testRawFreq, setTestRawFreq] = useState<number>(currentTelemetry.rawFrequency);
  const [testBatVolt, setTestBatVolt] = useState<number>(currentTelemetry.batteryVoltage);
  const [testBatPct, setTestBatPct] = useState<number>(currentTelemetry.batteryPercentage);

  const [apiLogs, setApiLogs] = useState<Array<{ time: string; type: 'REST' | 'MQTT'; text: string; status: number | string }>>([
    {
      time: new Date().toLocaleTimeString(),
      type: 'REST',
      text: 'POST /api/data - 200 OK (Data telemetry awal diterima)',
      status: 200
    },
    {
      time: new Date().toLocaleTimeString(),
      type: 'MQTT',
      text: 'PUB flood/telemetry - Payload diterbitkan ke broker',
      status: 'ACK'
    }
  ]);

  const [copiedServerCode, setCopiedServerCode] = useState(false);
  const [activeTab, setActiveTab] = useState<'tester' | 'serverCode'>('tester');

  // Determine status from water level
  const computedStatus: AlertStatus =
    testWaterLevel >= 80 ? 'BAHAYA' : testWaterLevel >= 50 ? 'AMARAN' : testWaterLevel >= 30 ? 'WASPADA' : 'NORMAL';

  const handleSendPostRequest = () => {
    const payload: TelemetryPayload = {
      chipModel: testChip,
      waterLevel: testWaterLevel,
      rawFrequency: testRawFreq,
      batteryVoltage: testBatVolt,
      batteryPercentage: testBatPct,
      status: computedStatus,
      timestamp: new Date().toISOString()
    };

    onDispatchPayload(payload);

    const nowStr = new Date().toLocaleTimeString();
    setApiLogs(prev => [
      {
        time: nowStr,
        type: 'REST',
        text: `POST /api/data (${payload.chipModel}, ${payload.waterLevel}cm, ${payload.status})`,
        status: 200
      },
      {
        time: nowStr,
        type: 'MQTT',
        text: `PUB flood/telemetry - QOS 1 [${payload.status}]`,
        status: 'PUBLISHED'
      },
      ...prev.slice(0, 15)
    ]);
  };

  const handleCopyServerCode = () => {
    navigator.clipboard.writeText(BACKEND_SERVER_CODE);
    setCopiedServerCode(true);
    setTimeout(() => setCopiedServerCode(false), 2500);
  };

  const jsonPayloadString = JSON.stringify(
    {
      chipModel: testChip,
      waterLevel: testWaterLevel,
      rawFrequency: testRawFreq,
      batteryVoltage: testBatVolt,
      batteryPercentage: testBatPct,
      status: computedStatus
    },
    null,
    2
  );

  return (
    <div className="space-y-6">
      {/* Navigation sub-tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('tester')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'tester'
              ? 'bg-cyan-950 border border-cyan-700/80 text-cyan-300'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Radio size={14} />
          <span>Penguji Langsung REST & MQTT</span>
        </button>
        <button
          onClick={() => setActiveTab('serverCode')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'serverCode'
              ? 'bg-cyan-950 border border-cyan-700/80 text-cyan-300'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Server size={14} />
          <span>Kod Pelayan Backend (Node.js Express + MQTT)</span>
        </button>
      </div>

      {activeTab === 'tester' ? (
        <div className="space-y-6">
          {/* Main tester grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 6 cols: Payload Builder */}
            <div className="lg:col-span-6 p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-semibold text-white">
                    Ujian Hantaran REST API (POST /api/data)
                  </span>
                </div>
                <span className="text-xs font-mono text-emerald-400">Endpoint Aktif</span>
              </div>

              {/* Form Controls */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Cip Mikropengawal:</label>
                  <select
                    value={testChip}
                    onChange={(e) => setTestChip(e.target.value as McuChipModel)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono text-xs"
                  >
                    <option value="ESP32-C3">ESP32-C3</option>
                    <option value="ESP32-S3">ESP32-S3</option>
                    <option value="ESP32-C6">ESP32-C6</option>
                    <option value="ESP32-P4">ESP32-P4</option>
                    <option value="ESP8266">ESP8266</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Aras Air (cm):</label>
                  <input
                    type="number"
                    step="0.5"
                    value={testWaterLevel}
                    onChange={(e) => setTestWaterLevel(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Frekuensi Mentah (Hz):</label>
                  <input
                    type="number"
                    value={testRawFreq}
                    onChange={(e) => setTestRawFreq(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Voltan Bateri (V):</label>
                  <input
                    type="number"
                    step="0.05"
                    value={testBatVolt}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      setTestBatVolt(v);
                      setTestBatPct(Math.round(((v - 3.2) / (4.2 - 3.2)) * 100));
                    }}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Status Alert Badge */}
              <div className="flex items-center justify-between p-2.5 rounded bg-slate-950 border border-slate-800 text-xs">
                <span className="text-slate-400">Status Amaran Terkalkulasi:</span>
                <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                  computedStatus === 'BAHAYA'
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                    : computedStatus === 'AMARAN'
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                    : computedStatus === 'WASPADA'
                    ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}>
                  {computedStatus}
                </span>
              </div>

              {/* JSON preview */}
              <div className="space-y-1">
                <span className="text-[11px] text-slate-400">JSON Payload yang akan dihantar:</span>
                <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-cyan-300 font-mono text-xs overflow-x-auto">
                  <code>{jsonPayloadString}</code>
                </pre>
              </div>

              <button
                onClick={handleSendPostRequest}
                className="w-full py-2.5 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <Send size={14} />
                <span>Hantar HTTP POST & Terbitkan MQTT</span>
              </button>
            </div>

            {/* Right 6 cols: Live Request & MQTT Log Terminal */}
            <div className="lg:col-span-6 p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-semibold text-white">Log Trafik API & Webhook MQTT</span>
                </div>
                <span className="text-xs font-mono text-slate-400">broker.hivemq.com:1883</span>
              </div>

              {/* Terminal Screen */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 font-mono text-xs space-y-2 h-[340px] overflow-y-auto">
                {apiLogs.map((log, index) => (
                  <div key={index} className="flex items-start gap-2 border-b border-slate-900/60 pb-1.5">
                    <span className="text-slate-500 shrink-0">[{log.time}]</span>
                    <span className={`px-1 rounded text-[10px] shrink-0 ${
                      log.type === 'REST' ? 'bg-cyan-950 text-cyan-400' : 'bg-amber-950 text-amber-400'
                    }`}>
                      {log.type}
                    </span>
                    <span className="text-slate-300 flex-1 truncate">{log.text}</span>
                    <span className="text-emerald-400 text-[10px] shrink-0">{log.status}</span>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg text-[11px] text-slate-400">
                Data daripada mikropengawal dihantar secara berkala (1000ms - 5000ms). Sekiranya paras air melebihi ambang <strong>AMARAN</strong> (50cm) atau <strong>BAHAYA</strong> (80cm), webhook kecemasan dicetuskan secara automatik.
              </div>
            </div>
          </div>

          {/* Alert Thresholds Reference Matrix */}
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
            <span className="text-sm font-semibold text-white">Matriks Ambang Amaran Banjir (Threshold Specifications)</span>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30">
                <span className="font-bold text-emerald-400 block mb-1">NORMAL (&lt; 30 cm)</span>
                <p className="text-slate-300 text-[11px]">Paras air sungai berada pada tahap selamat. Tiada ancaman banjir.</p>
              </div>
              <div className="p-3 rounded-lg bg-yellow-950/30 border border-yellow-500/30">
                <span className="font-bold text-yellow-400 block mb-1">WASPADA (30 - 50 cm)</span>
                <p className="text-slate-300 text-[11px]">Aliran air meningkat melepasi tebing rendah. Penduduk dinasihatkan bersiap sedia.</p>
              </div>
              <div className="p-3 rounded-lg bg-orange-950/30 border border-orange-500/30">
                <span className="font-bold text-orange-400 block mb-1">AMARAN (50 - 80 cm)</span>
                <p className="text-slate-300 text-[11px]">Air menghampiri paras bahaya. Pihak berkuasa mula mengaktifkan pusat pemindahan (PPS).</p>
              </div>
              <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/30">
                <span className="font-bold text-red-400 block mb-1">BAHAYA (&gt; 80 cm)</span>
                <p className="text-slate-300 text-[11px]">Banjir besar sedang berlaku. Pemindahan wajib dijalankan segera!</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Server code view */
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Kod Pelayan Gateway (Node.js Express & MQTT)</h3>
              <p className="text-xs text-slate-400">Siap sedia untuk dihoskan pada pelayan awan atau gateway tempatan (Raspberry Pi)</p>
            </div>
            <button
              onClick={handleCopyServerCode}
              className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
            >
              {copiedServerCode ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copiedServerCode ? 'Disalin!' : 'Salin server.ts'}</span>
            </button>
          </div>

          <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-mono text-xs overflow-x-auto max-h-[500px] leading-relaxed">
            <code>{BACKEND_SERVER_CODE}</code>
          </pre>
        </div>
      )}
    </div>
  );
};
