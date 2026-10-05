export const BACKEND_SERVER_CODE = `/**
 * ============================================================================
 * BACKEND GATEWAY & MQTT BROKER INTEGRATION (Node.js / Express / MQTT)
 * Sistem Pemantauan Tiang Aras Air Banjir
 * ============================================================================
 */

import express, { Request, Response } from 'express';
import mqtt from 'mqtt';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// In-Memory Telemetry Cache & History
let latestTelemetry = {
  chipModel: 'ESP32-C3',
  waterLevel: 24.5,
  rawFrequency: 1420.0,
  batteryVoltage: 3.92,
  batteryPercentage: 86,
  status: 'NORMAL',
  timestamp: new Date().toISOString()
};

const telemetryHistory: any[] = [];
let tareOffset = 0.0;

// ============================================================================
// 1. MQTT BROKER CLIENT INITIALIZATION
// ============================================================================
const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://broker.hivemq.com:1883';
const MQTT_TOPIC_DATA = 'flood/telemetry';
const MQTT_TOPIC_ALERT = 'flood/alert';
const MQTT_TOPIC_CMD = 'flood/command/tare';

const mqttClient = mqtt.connect(MQTT_BROKER);

mqttClient.on('connect', () => {
  console.log('[MQTT] Berjaya tersambung ke broker:', MQTT_BROKER);
  mqttClient.subscribe(MQTT_TOPIC_DATA);
});

mqttClient.on('message', (topic, message) => {
  try {
    if (topic === MQTT_TOPIC_DATA) {
      const payload = JSON.parse(message.toString());
      latestTelemetry = {
        ...payload,
        timestamp: new Date().toISOString()
      };
      telemetryHistory.unshift(latestTelemetry);
      if (telemetryHistory.length > 100) telemetryHistory.pop();

      // Semak amaran kritikal
      if (payload.status === 'BAHAYA' || payload.status === 'AMARAN') {
        triggerEmergencyWebhook(payload);
      }
    }
  } catch (err) {
    console.error('[MQTT] Ralat parsing mesej:', err);
  }
});

// ============================================================================
// 2. REST API ENDPOINTS
// ============================================================================

/**
 * Endpoint Utama untuk Mikropengawal ESP32/ESP8266
 * Menerima payload:
 * {
 *   "chipModel": "ESP32-C3",
 *   "waterLevel": 42.5,
 *   "rawFrequency": 1250,
 *   "batteryVoltage": 3.85,
 *   "batteryPercentage": 82,
 *   "status": "AMARAN"
 * }
 */
app.post('/api/data', (req: Request, res: Response) => {
  const { chipModel, waterLevel, rawFrequency, batteryVoltage, batteryPercentage, status } = req.body;

  if (waterLevel === undefined || !chipModel) {
    return res.status(400).json({ error: 'Payload tidak lengkap: chipModel dan waterLevel diperlukan.' });
  }

  latestTelemetry = {
    chipModel,
    waterLevel: Number(waterLevel),
    rawFrequency: Number(rawFrequency || 0),
    batteryVoltage: Number(batteryVoltage || 0),
    batteryPercentage: Number(batteryPercentage || 0),
    status: status || (waterLevel >= 80 ? 'BAHAYA' : waterLevel >= 50 ? 'AMARAN' : waterLevel >= 30 ? 'WASPADA' : 'NORMAL'),
    timestamp: new Date().toISOString()
  };

  telemetryHistory.unshift(latestTelemetry);
  if (telemetryHistory.length > 100) telemetryHistory.pop();

  // Siarkan salinan ke broker MQTT untuk dashboard / aplikasi mudah alih
  if (mqttClient.connected) {
    mqttClient.publish(MQTT_TOPIC_DATA, JSON.stringify(latestTelemetry));
  }

  // Jika mencapai aras AMARAN atau BAHAYA, cetus webhook amaran
  if (latestTelemetry.status === 'BAHAYA' || latestTelemetry.status === 'AMARAN') {
    triggerEmergencyWebhook(latestTelemetry);
  }

  return res.status(200).json({
    success: true,
    message: 'Data telemetri berjaya direkodkan.',
    data: latestTelemetry
  });
});

// Endpoint GET: Digunakan oleh Flutter App untuk polling data terkini
app.get('/api/data', (req: Request, res: Response) => {
  res.json(latestTelemetry);
});

// Endpoint GET: Sejarah pembacaan 50 sampel terakhir
app.get('/api/data/history', (req: Request, res: Response) => {
  res.json(telemetryHistory.slice(0, 50));
});

// Endpoint POST: Kawalan Jauh Auto-Zero / Tare Offset
app.post('/api/calibration/tare', (req: Request, res: Response) => {
  tareOffset = latestTelemetry.waterLevel;
  console.log(\`[TARE] Titik sifar baru ditetapkan: \${tareOffset} cm\`);

  // Hantar arahan melalui MQTT ke mikropengawal di tiang
  if (mqttClient.connected) {
    mqttClient.publish(MQTT_TOPIC_CMD, JSON.stringify({ command: 'TARE_ZERO', tareOffset }));
  }

  res.json({
    success: true,
    message: 'Arahan Tare disiarkan ke tiang sensor.',
    tareOffset
  });
});

// Webhook Fungsi Amaran Kecemasan (cth: Telegram Bot / Siren Komuniti)
async function triggerEmergencyWebhook(telemetry: any) {
  console.warn(\`[ALERT EMERGENCY] \${telemetry.status}! Aras air: \${telemetry.waterLevel} cm pada tiang \${telemetry.chipModel}\`);
  // Boleh disambungkan ke Telegram Bot API, Twilio SMS, atau push notification Firebase FCM.
}

app.listen(PORT, () => {
  console.log(\`[REST API] Pelayan Sistem Banjir beroperasi di http://localhost:\${PORT}\`);
});
`;
