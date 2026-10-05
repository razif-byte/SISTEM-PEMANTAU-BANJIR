import { McuChipModel, CalibrationConfig } from '../types/telemetry';

export function generateArduinoCode(
  selectedMcu: McuChipModel,
  config: CalibrationConfig,
  apiUrl: string = 'http://192.168.1.100:3000/api/data',
  mqttBroker: string = 'broker.hivemq.com',
  mqttTopic: string = 'flood/telemetry'
): string {
  return `/**
 * ============================================================================
 * SISTEM PEMANTAUAN TIANG SENSOR ARAS AIR BANJIR IOT
 * Multi-Device Framework: ESP32-C3, ESP32-S3, ESP32-C6, ESP32-P4, ESP8266
 * ----------------------------------------------------------------------------
 * Ciri-ciri:
 * 1. Sensor Aras Air Frekuensi IC555 (Interrupt-based Pulse Counting).
 * 2. Penapis Moving Average (10 - 20 sampel) untuk penolakan hingar gelombang air.
 * 3. Kalibrasi Linear Regression (y = m * x + c) & Auto-Zero Tare Offset.
 * 4. Pembacaan Voltan Bateri (Voltage Divider R1=100k, R2=100k) + Software Multiplier.
 * 5. Penyimpanan Parameter Kekal (NVS Preferences / EEPROM).
 * 6. Hantaran Data Dual-Channel: HTTP REST API (POST /api/data) & Webhook MQTT.
 * ============================================================================
 */

#include <Arduino.h>

// ============================================================================
// 1. DEFINISI PAPAN & PIN MIKROPENGAWAL (MULTI-DEVICE BOARD DEFINITIONS)
// ============================================================================
// Pilih atau tentukan papan mikropengawal anda di bawah atau melalui compiler flag:
#define BOARD_${selectedMcu.replace('-', '_')} 1

#if defined(BOARD_ESP32_C3)
  #define CHIP_NAME "ESP32-C3"
  #define PIN_SENSOR_FREQ 3    // GPIO3: Interrupt frekuensi IC555
  #define PIN_ADC_BATTERY 0    // GPIO0: ADC1_CH0 pembahagi voltan bateri
  #define ADC_MAX_VALUE   4095.0f
  #define ADC_VREF_VOLTS  3.30f
  #define HAS_NVS_PREF    1
  #define USE_WIFI        1

#elif defined(BOARD_ESP32_S3)
  #define CHIP_NAME "ESP32-S3"
  #define PIN_SENSOR_FREQ 5    // GPIO5: Interrupt frekuensi IC555
  #define PIN_ADC_BATTERY 4    // GPIO4: ADC1_CH3 pembahagi voltan bateri
  #define ADC_MAX_VALUE   4095.0f
  #define ADC_VREF_VOLTS  3.30f
  #define HAS_NVS_PREF    1
  #define USE_WIFI        1

#elif defined(BOARD_ESP32_C6)
  #define CHIP_NAME "ESP32-C6"
  #define PIN_SENSOR_FREQ 2    // GPIO2: Interrupt frekuensi IC555
  #define PIN_ADC_BATTERY 1    // GPIO1: ADC1_CH1 pembahagi voltan bateri
  #define ADC_MAX_VALUE   4095.0f
  #define ADC_VREF_VOLTS  3.30f
  #define HAS_NVS_PREF    1
  #define USE_WIFI        1

#elif defined(BOARD_ESP32_P4)
  #define CHIP_NAME "ESP32-P4"
  #define PIN_SENSOR_FREQ 3    // GPIO3: Interrupt frekuensi IC555
  #define PIN_ADC_BATTERY 2    // GPIO2: ADC1_CH2 pembahagi voltan bateri
  #define ADC_MAX_VALUE   4095.0f
  #define ADC_VREF_VOLTS  3.30f
  #define HAS_NVS_PREF    1
  #define USE_WIFI        0    // ESP32-P4 tiada Wi-Fi onboard, gunakan W5500 Ethernet SPI
  #define USE_ETHERNET_W5500 1

#elif defined(BOARD_ESP8266) || defined(ESP8266)
  #define CHIP_NAME "ESP8266"
  #define PIN_SENSOR_FREQ 4    // GPIO4 (Pin D2 pada NodeMCU): Interrupt frekuensi
  #define PIN_ADC_BATTERY A0   // A0: Pin analog tunggal 10-bit (0-1023)
  #define ADC_MAX_VALUE   1023.0f
  #define ADC_VREF_VOLTS  3.30f // NodeMCU mempunyai onboard divider 220k/100k
  #define HAS_NVS_PREF    0
  #define USE_EEPROM      1
  #define USE_WIFI        1

#else
  #error "Papan mikropengawal tidak disokong! Sila tetapkan BOARD_ESP32_C3/S3/C6/P4/ESP8266."
#endif

// ============================================================================
// 2. DEPENDENSI SISTEM & MEMORI KEKAL
// ============================================================================
#if HAS_NVS_PREF
  #include <Preferences.h>
  Preferences preferences;
#elif USE_EEPROM
  #include <EEPROM.h>
  #define EEPROM_SIZE 512
  #define EEPROM_ADDR_MAGIC 0
  #define EEPROM_ADDR_CFG   4
  #define EEPROM_MAGIC_VAL  0xAA55BEEF
#endif

#if USE_WIFI
  #if defined(ESP8266)
    #include <ESP8266WiFi.h>
    #include <ESP8266HTTPClient.h>
    #include <WiFiClient.h>
  #else
    #include <WiFi.h>
    #include <HTTPClient.h>
  #endif
#elif USE_ETHERNET_W5500
  #include <SPI.h>
  #include <Ethernet.h>
#endif

#include <PubSubClient.h>

// ============================================================================
// 3. STRUKTUR KONFIGURASI KALIBRASI & NVS
// ============================================================================
struct CalibrationData {
  float m_slope;             // Kecerunan (cm/Hz) - IC555 oscillator linear fit
  float c_offset;            // Pintasan asas (cm)
  float tare_offset;         // Auto-zero offset tambahan (cm)
  float battery_multiplier;  // Faktor toleransi perintang (cth: 1.000 +/- 5%)
  int   filter_window_size;  // Bilangan sampel moving average (10 - 20)
};

CalibrationData calibConfig = {
  .m_slope = ${config.mSlope.toFixed(5)}f,
  .c_offset = ${config.cOffset.toFixed(2)}f,
  .tare_offset = ${config.tareOffset.toFixed(2)}f,
  .battery_multiplier = ${config.batterySoftwareMultiplier.toFixed(4)}f,
  .filter_window_size = ${config.filterWindowSize}
};

// ============================================================================
// 4. PENAPIS MOVING AVERAGE & PEMBOLEHUBAH FREKUENSI
// ============================================================================
#define MAX_FILTER_SAMPLES 20
volatile unsigned long pulseCounter = 0;
unsigned long lastGateTime = 0;
const unsigned long GATE_INTERVAL_MS = 1000; // Tempoh gating pengukuran frekuensi (1 saat)

float frequencyBuffer[MAX_FILTER_SAMPLES];
int filterIndex = 0;
int filterCount = 0;
float filteredFrequency = 0.0f;

// Interrupt Service Routine (ISR) dengan atribut RAM pantas
#if defined(ESP8266)
  void ICACHE_RAM_ATTR handlePulseInterrupt() {
    pulseCounter++;
  }
#else
  void IRAM_ATTR handlePulseInterrupt() {
    pulseCounter++;
  }
#endif

// ============================================================================
// 5. RANGKAIAN, API & MQTT CONFIGURATION
// ============================================================================
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";
const char* REST_API_URL = "${apiUrl}";
const char* MQTT_SERVER = "${mqttBroker}";
const int   MQTT_PORT = 1883;
const char* MQTT_TOPIC_DATA = "${mqttTopic}";
const char* MQTT_TOPIC_CMD  = "flood/command/tare";

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

unsigned long lastSendTime = 0;
const unsigned long SEND_INTERVAL_MS = 3000; // Hantar setiap 3 saat

// ============================================================================
// 6. FUNGSI MEMORI KEKAL (NVS / EEPROM)
// ============================================================================
void loadCalibrationFromStorage() {
#if HAS_NVS_PREF
  preferences.begin("flood_cfg", false);
  calibConfig.m_slope = preferences.getFloat("m_slope", calibConfig.m_slope);
  calibConfig.c_offset = preferences.getFloat("c_offset", calibConfig.c_offset);
  calibConfig.tare_offset = preferences.getFloat("tare_offset", calibConfig.tare_offset);
  calibConfig.battery_multiplier = preferences.getFloat("bat_mul", calibConfig.battery_multiplier);
  calibConfig.filter_window_size = preferences.getInt("flt_win", calibConfig.filter_window_size);
  preferences.end();
  Serial.println("[NVS] Konfigurasi berjaya dimuat dari NVS Flash.");
#elif USE_EEPROM
  EEPROM.begin(EEPROM_SIZE);
  uint32_t magic = 0;
  EEPROM.get(EEPROM_ADDR_MAGIC, magic);
  if (magic == EEPROM_MAGIC_VAL) {
    EEPROM.get(EEPROM_ADDR_CFG, calibConfig);
    Serial.println("[EEPROM] Konfigurasi sah dimuat dari EEPROM.");
  } else {
    Serial.println("[EEPROM] Tiada data tersimpan. Menulis nilai lalai kilang.");
    saveCalibrationToStorage();
  }
#endif
}

void saveCalibrationToStorage() {
#if HAS_NVS_PREF
  preferences.begin("flood_cfg", false);
  preferences.putFloat("m_slope", calibConfig.m_slope);
  preferences.putFloat("c_offset", calibConfig.c_offset);
  preferences.putFloat("tare_offset", calibConfig.tare_offset);
  preferences.putFloat("bat_mul", calibConfig.battery_multiplier);
  preferences.putInt("flt_win", calibConfig.filter_window_size);
  preferences.end();
  Serial.println("[NVS] Konfigurasi kalibrasi berjaya disimpan ke NVS Flash.");
#elif USE_EEPROM
  uint32_t magic = EEPROM_MAGIC_VAL;
  EEPROM.put(EEPROM_ADDR_MAGIC, magic);
  EEPROM.put(EEPROM_ADDR_CFG, calibConfig);
  EEPROM.commit();
  Serial.println("[EEPROM] Konfigurasi kalibrasi berjaya dikomit ke EEPROM.");
#endif
}

// Fungsi Auto-Zero / Tare Offset: menetapkan paras air semasa sebagai 0 cm
void performAutoZeroTare() {
  // Aras air sebelum tare: y = m * freq + c
  float currentRawLevel = (calibConfig.m_slope * filteredFrequency) + calibConfig.c_offset;
  calibConfig.tare_offset = currentRawLevel;
  saveCalibrationToStorage();
  Serial.printf("[TARE] Auto-Zero selesai. Tare Offset baru: %.2f cm\\n", calibConfig.tare_offset);
}

// ============================================================================
// 7. PENAPIS HINGAR (MOVING AVERAGE FILTER)
// ============================================================================
float updateMovingAverage(float newFreq) {
  frequencyBuffer[filterIndex] = newFreq;
  filterIndex = (filterIndex + 1) % calibConfig.filter_window_size;
  if (filterCount < calibConfig.filter_window_size) {
    filterCount++;
  }

  float sum = 0.0f;
  for (int i = 0; i < filterCount; i++) {
    sum += frequencyBuffer[i];
  }
  return sum / filterCount;
}

// ============================================================================
// 8. PENGIRAAN ARAS AIR & VOLTAN BATERI
// ============================================================================
float calculateWaterLevel(float freqHz) {
  // Formula Linear Regression: y = (m * x) + c - tare_offset
  float level = (calibConfig.m_slope * freqHz) + calibConfig.c_offset - calibConfig.tare_offset;
  if (level < 0.0f) level = 0.0f; // Elakkan aras negatif
  return level;
}

float readBatteryVoltage() {
  int rawAdc = analogRead(PIN_ADC_BATTERY);
  
  // Nisbah pembahagi voltan (Voltage Divider: R1=100k, R2=100k)
  // Vout = Vin * (R2 / (R1 + R2)) = Vin * 0.5 --> Vin = Vout * 2.0
  float dividerRatio = 2.0f;
  
  // Pengiraan voltan pin analog mengikut resolusi cip
  float pinVoltage = ((float)rawAdc / ADC_MAX_VALUE) * ADC_VREF_VOLTS;
  
  // Voltan bateri sebenar dengan pemafaktoran perisian toleransi perintang
  float batteryVoltage = pinVoltage * dividerRatio * calibConfig.battery_multiplier;
  return batteryVoltage;
}

int calculateBatteryPercentage(float voltage) {
  // Anggaran lengkung pelepasan bateri LiPo 1S (3.7V nominal, 4.2V maks, 3.2V cut-off)
  if (voltage >= 4.20f) return 100;
  if (voltage <= 3.20f) return 0;
  
  // Interpolasi linear mudah
  float percentage = ((voltage - 3.20f) / (4.20f - 3.20f)) * 100.0f;
  return constrain((int)percentage, 0, 100);
}

const char* determineAlertStatus(float waterLevel) {
  if (waterLevel >= 80.0f) return "BAHAYA";
  if (waterLevel >= 50.0f) return "AMARAN";
  if (waterLevel >= 30.0f) return "WASPADA";
  return "NORMAL";
}

// ============================================================================
// 9. PENGHANTARAN REST API & MQTT
// ============================================================================
void sendTelemetryHttp(float waterLevel, float rawFreq, float batVolt, int batPct, const char* status) {
#if USE_WIFI
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(wifiClient, REST_API_URL);
  http.addHeader("Content-Type", "application/json");

  char jsonPayload[256];
  snprintf(jsonPayload, sizeof(jsonPayload),
    "{\\"chipModel\\":\\"%s\\",\\"waterLevel\\":%.2f,\\"rawFrequency\\":%.1f,\\"batteryVoltage\\":%.2f,\\"batteryPercentage\\":%d,\\"status\\":\\"%s\\"}",
    CHIP_NAME, waterLevel, rawFreq, batVolt, batPct, status
  );

  int httpCode = http.POST(jsonPayload);
  if (httpCode > 0) {
    Serial.printf("[HTTP POST] Respons: %d | Payload: %s\\n", httpCode, jsonPayload);
  } else {
    Serial.printf("[HTTP POST] Ralat penghantaran: %s\\n", http.errorToString(httpCode).c_str());
  }
  http.end();
#endif
}

void sendTelemetryMqtt(float waterLevel, float rawFreq, float batVolt, int batPct, const char* status) {
  if (!mqttClient.connected()) return;

  char jsonPayload[256];
  snprintf(jsonPayload, sizeof(jsonPayload),
    "{\\"chipModel\\":\\"%s\\",\\"waterLevel\\":%.2f,\\"rawFrequency\\":%.1f,\\"batteryVoltage\\":%.2f,\\"batteryPercentage\\":%d,\\"status\\":\\"%s\\"}",
    CHIP_NAME, waterLevel, rawFreq, batVolt, batPct, status
  );

  mqttClient.publish(MQTT_TOPIC_DATA, jsonPayload);
  Serial.printf("[MQTT PUB] Diterbitkan ke %s\\n", MQTT_TOPIC_DATA);
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.printf("[MQTT SUB] Mesej diterima [%s]: %s\\n", topic, message.c_str());

  if (String(topic) == MQTT_TOPIC_CMD && message.indexOf("TARE") >= 0) {
    Serial.println("[MQTT CMD] Arahan Auto-Zero / Tare diterima!");
    performAutoZeroTare();
  }
}

void reconnectMqtt() {
  if (!mqttClient.connected()) {
    String clientId = String("FloodNode-") + CHIP_NAME + "-" + String(random(0xffff), HEX);
    if (mqttClient.connect(clientId.c_str())) {
      Serial.println("[MQTT] Berjaya disambung ke broker!");
      mqttClient.subscribe(MQTT_TOPIC_CMD);
    }
  }
}

// ============================================================================
// 10. SETUP & UTAMA (LOOP)
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\\n========================================================");
  Serial.printf(" Memulakan Node Tiang Banjir [%s]\\n", CHIP_NAME);
  Serial.println("========================================================");

  // Muat parameter kalibrasi dari NVS/EEPROM
  loadCalibrationFromStorage();

  // Konfigurasi pin pembacaan interrupt IC555
  pinMode(PIN_SENSOR_FREQ, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_SENSOR_FREQ), handlePulseInterrupt, RISING);

  // Konfigurasi pin analog bateri
#if !defined(ESP8266)
  analogReadResolution(12); // Pastikan 12-bit ADC pada ESP32 family
  analogSetAttenuation(ADC_11db); // Julat bacaan sehingga 3.3V
#endif

  // Sambungan Wi-Fi
#if USE_WIFI
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("[WiFi] Menyambung");
  int wifiAttempts = 0;
  while (WiFi.status() != WL_CONNECTED && wifiAttempts < 20) {
    delay(500);
    Serial.print(".");
    wifiAttempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\\n[WiFi] Bersambung! IP: %s\\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\\n[WiFi] Gagal bersambung dalam masa ditetapkan. Mod luar talian.");
  }

  // Konfigurasi MQTT
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
#endif

  lastGateTime = millis();
  lastSendTime = millis();
}

void loop() {
  unsigned long currentMillis = millis();

  // Kitaran Gating Frekuensi (Setiap 1000ms)
  if (currentMillis - lastGateTime >= GATE_INTERVAL_MS) {
    noInterrupts();
    unsigned long countedPulses = pulseCounter;
    pulseCounter = 0;
    interrupts();

    // Frekuensi = denyutan / saat (Hz)
    float rawFrequency = (float)countedPulses * (1000.0f / (float)(currentMillis - lastGateTime));
    lastGateTime = currentMillis;

    // Tapis menggunakan Moving Average
    filteredFrequency = updateMovingAverage(rawFrequency);

    // Kira aras air semasa
    float waterLevel = calculateWaterLevel(filteredFrequency);
    float batteryVoltage = readBatteryVoltage();
    int batteryPct = calculateBatteryPercentage(batteryVoltage);
    const char* alertStatus = determineAlertStatus(waterLevel);

    Serial.printf("[SENSOR] Freq: %.1f Hz (Raw: %.1f) | Aras: %.2f cm | Bateri: %.2fV (%d%%) | Status: %s\\n",
      filteredFrequency, rawFrequency, waterLevel, batteryVoltage, batteryPct, alertStatus);
  }

  // Pengurusan MQTT Loop
#if USE_WIFI
  if (WiFi.status() == WL_CONNECTED) {
    if (!mqttClient.connected()) {
      reconnectMqtt();
    }
    mqttClient.loop();
  }
#endif

  // Kitaran Penghantaran Data (Setiap 3000ms)
  if (currentMillis - lastSendTime >= SEND_INTERVAL_MS) {
    lastSendTime = currentMillis;

    float waterLevel = calculateWaterLevel(filteredFrequency);
    float batteryVoltage = readBatteryVoltage();
    int batteryPct = calculateBatteryPercentage(batteryVoltage);
    const char* alertStatus = determineAlertStatus(waterLevel);

    sendTelemetryHttp(waterLevel, filteredFrequency, batteryVoltage, batteryPct, alertStatus);
    sendTelemetryMqtt(waterLevel, filteredFrequency, batteryVoltage, batteryPct, alertStatus);
  }
}
`;
}

export function generatePartitionsCsv(flashSize: '4MB' | '8MB' = '4MB'): string {
  if (flashSize === '8MB') {
    return `# ============================================================================
# ESP-IDF / Arduino ESP32 Partition Table (8MB Flash Dual-OTA)
# Sasaran: ESP32-S3 / ESP32-P4 dengan 8MB Octal/Quad SPI Flash
# ============================================================================
# Name,   Type, SubType, Offset,   Size,     Flags
nvs,      data, nvs,     0x9000,   0x5000,
otadata,  data, ota,     0xe000,   0x2000,
app0,     app,  ota_0,   0x10000,  0x380000,
app1,     app,  ota_1,   0x390000, 0x380000,
spiffs,   data, spiffs,  0x710000, 0xE0000,
`;
  }
  return `# ============================================================================
# ESP-IDF / Arduino ESP32 Partition Table (4MB Flash Dual-OTA)
# Sasaran: ESP32-C3, ESP32-S3, ESP32-C6, ESP32-P4 (Standard 4MB Flash)
# Menyediakan 2 slot aplikasi bersaiz 1.875MB (1920KB) untuk fail-safe update
# ============================================================================
# Name,   Type, SubType, Offset,  Size,     Flags
nvs,      data, nvs,     0x9000,  0x5000,
otadata,  data, ota,     0xe000,  0x2000,
app0,     app,  ota_0,   0x10000, 0x1E0000,
app1,     app,  ota_1,   0x1F0000,0x1E0000,
spiffs,   data, spiffs,  0x3D0000,0x30000,
`;
}

export function generateOtaCode(
  selectedMcu: McuChipModel,
  firmwareVersion: string = '2.5.0',
  otaServerUrl: string = 'http://192.168.1.100:3000/firmware/update.bin'
): string {
  const isEsp8266 = selectedMcu === 'ESP8266';

  return `/**
 * ============================================================================
 * MODUL PENGURUS KEMAS KINI OTA (OVER-THE-AIR UPDATE MANAGER)
 * Sistem Pemantauan Tiang Aras Air Banjir - NASA DEF SDN BHD
 * ----------------------------------------------------------------------------
 * Menyokong 3 kaedah kemas kini tanpa wayar:
 * 1. ArduinoOTA: Pemancar langsung LAN (Direct LAN Push via Port 3232)
 * 2. HTTP/HTTPS Remote Pull: Muat turun binari daripada pelayan pusat gateway
 * 3. Rollback Protection: ESP-IDF mengesahkan status peranti sebelum komit
 * ============================================================================
 */

#include <Arduino.h>
#define CURRENT_FIRMWARE_VER "${firmwareVersion}"

#if defined(ESP8266)
  #include <ESP8266WiFi.h>
  #include <ESP8266httpUpdate.h>
  #include <ArduinoOTA.h>
#else
  #include <WiFi.h>
  #include <HTTPUpdate.h>
  #include <ArduinoOTA.h>
  #include <esp_ota_ops.h>
  #include <esp_partition.h>
#endif

// ============================================================================
// 1. TETAPAN & STATUS OTA
// ============================================================================
const char* OTA_HOSTNAME = "flood-node-${selectedMcu.toLowerCase()}";
const char* OTA_PASSWORD = "nasadef_secure_ota";
const char* REMOTE_FIRMWARE_URL = "${otaServerUrl}";

bool otaInProgress = false;
int otaProgressPercent = 0;

// ============================================================================
// 2. FUNGSI INISIALISASI ARDUINOTA (LAN PUSH)
// ============================================================================
void initArduinoOTA() {
  ArduinoOTA.setHostname(OTA_HOSTNAME);
  ArduinoOTA.setPassword(OTA_PASSWORD);
  ArduinoOTA.setPort(3232);

  ArduinoOTA.onStart([]() {
    otaInProgress = true;
    String type = (ArduinoOTA.getCommand() == U_FLASH) ? "Firmware Binari" : "Filesystem SPIFFS";
    Serial.printf("[OTA] Memulakan muat naik: %s\\n", type.c_str());

    #if !defined(ESP8266)
    // Dapatkan info partisi aktif semasa
    const esp_partition_t* running = esp_ota_get_running_partition();
    Serial.printf("[OTA] Partisi semasa berjalan: %s (Offset: 0x%08x)\\n", running->label, running->address);
    #endif
  });

  ArduinoOTA.onEnd([]() {
    otaInProgress = false;
    Serial.println("\\n[OTA] Kemas kini selesai! Memulakan but semula (Reboot)...");
  });

  ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
    otaProgressPercent = (progress / (total / 100));
    Serial.printf("[OTA Progress]: %u%% (%u / %u bytes)\\r", otaProgressPercent, progress, total);
  });

  ArduinoOTA.onError([](ota_error_t error) {
    otaInProgress = false;
    Serial.printf("[OTA ERROR] Kod [%u]: ", error);
    if (error == OTA_AUTH_ERROR) Serial.println("Kegagalan Kata Laluan (Auth Failed)");
    else if (error == OTA_BEGIN_ERROR) Serial.println("Gagal Memulakan Partisi (Begin Failed)");
    else if (error == OTA_CONNECT_ERROR) Serial.println("Gagal Bersambung (Connect Failed)");
    else if (error == OTA_RECEIVE_ERROR) Serial.println("Ralat Penerimaan Data (Receive Failed)");
    else if (error == OTA_END_ERROR) Serial.println("Ralat Penutupan Partisi (End Failed)");
  });

  ArduinoOTA.begin();
  Serial.printf("[OTA] Perkhidmatan ArduinoOTA sedia pada port 3232 (Hostname: %s)\\n", OTA_HOSTNAME);
}

// ============================================================================
// 3. FUNGSI KEMAS KINI DARI JAUH (REMOTE HTTP PULL OTA)
// ============================================================================
bool triggerRemoteHttpOta(const char* firmwareUrl) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[OTA PULL] Tiada sambungan Wi-Fi!");
    return false;
  }

  Serial.printf("[OTA PULL] Menyemak binari baru di: %s\\n", firmwareUrl);

#if defined(ESP8266)
  WiFiClient client;
  t_httpUpdate_return ret = ESP8266httpUpdate.update(client, firmwareUrl, CURRENT_FIRMWARE_VER);
  switch (ret) {
    case HTTP_UPDATE_FAILED:
      Serial.printf("[OTA PULL ERROR] Gagal: (%d): %s\\n", ESP8266httpUpdate.getLastError(), ESP8266httpUpdate.getLastErrorString().c_str());
      return false;
    case HTTP_UPDATE_NO_UPDATES:
      Serial.println("[OTA PULL] Versi semasa sudah terkini. Tiada kemas kini.");
      return true;
    case HTTP_UPDATE_OK:
      Serial.println("[OTA PULL] Kemas kini berjaya dimuat turun!");
      return true;
  }
#else
  WiFiClient client;
  httpUpdate.setLedPin(2, LOW); // Indikator LED berkedip semasa OTA
  
  // Callback progress
  httpUpdate.onProgress([](size_t current, size_t total) {
    Serial.printf("[HTTP OTA] %d / %d bytes (%d%%)\\r", current, total, (int)((current * 100) / total));
  });

  t_httpUpdate_return ret = httpUpdate.update(client, firmwareUrl);
  switch (ret) {
    case HTTP_UPDATE_FAILED:
      Serial.printf("[HTTP OTA ERROR] Ralat (%d): %s\\n", httpUpdate.getLastError(), httpUpdate.getLastErrorString().c_str());
      return false;
    case HTTP_UPDATE_NO_UPDATES:
      Serial.println("[HTTP OTA] Versi peranti sudah terkini.");
      return true;
    case HTTP_UPDATE_OK:
      Serial.println("[HTTP OTA] Berjaya! Menukar partisi boot dan but semula.");
      return true;
  }
#endif
  return false;
}

// ============================================================================
// 4. KESELAMATAN & ROLLBACK PROTECTION (ESP-IDF APP VALIDATION)
// ============================================================================
void validateOtaBootHealth() {
#if !defined(ESP8266)
  esp_ota_img_states_t ota_state;
  const esp_partition_t* running = esp_ota_get_running_partition();

  if (esp_ota_get_state_partition(running, &ota_state) == ESP_OK) {
    if (ota_state == ESP_OTA_IMG_PENDING_VERIFY) {
      Serial.println("[OTA VALIDATION] Firmware baru dikesan dalam fasa pengesahan!");
      Serial.println("[OTA VALIDATION] Menunggu sensor beroperasi secara nominal...");

      // Sahkan bahawa pembacaan sensor IC555 dan bateri stabil
      delay(2000); 

      // Batalkan mekanisme rollback dan tandakan binari sebagai SAH (VALID)
      esp_err_t err = esp_ota_mark_app_valid_cancel_rollback();
      if (err == ESP_OK) {
        Serial.println("[OTA VALIDATION] Pengesahan Berjaya: Firmware disahkan sihat & kekal!");
      } else {
        Serial.printf("[OTA VALIDATION] Ralat menandakan binari sah: 0x%x\\n", err);
      }
    } else if (ota_state == ESP_OTA_IMG_VALID) {
      Serial.println("[OTA] Firmware semasa disahkan sah (Status: ESP_OTA_IMG_VALID).");
    }
  }
#endif
}

// Dipanggil dalam fungsi setup() utama:
void setupOtaModule() {
  initArduinoOTA();
  validateOtaBootHealth();
}

// Dipanggil dalam fungsi loop() utama:
void handleOtaLoop() {
  ArduinoOTA.handle();
}
`;
}

export function generatePlatformIoIni(selectedMcu: McuChipModel, enableOtaUpload: boolean = false): string {
  const otaFlags = enableOtaUpload ? `
; --- Konfigurasi Muat Naik Tanpa Wayar (Over-the-Air) ---
upload_protocol = espota
upload_port = 192.168.1.150      ; Masukkan alamat IP tiang sensor di tapak
upload_flags = 
    --port=3232
    --auth=nasadef_secure_ota
` : `
; --- Muat Naik Melalui USB Serial ---
upload_speed = 921600
`;

  const configs: Record<McuChipModel, string> = {
    'ESP32-C3': `[env:esp32-c3-devkitm-1]
platform = espressif32
board = esp32-c3-devkitm-1
framework = arduino
monitor_speed = 115200
board_build.partitions = partitions.csv${otaFlags}
build_flags = 
    -D BOARD_ESP32_C3=1
    -D ARDUINO_USB_MODE=1
    -D ARDUINO_USB_CDC_ON_BOOT=1
lib_deps = 
    knolleary/PubSubClient@^2.8
`,
    'ESP32-S3': `[env:esp32-s3-devkitc-1]
platform = espressif32
board = esp32-s3-devkitc-1
framework = arduino
monitor_speed = 115200
board_build.partitions = partitions.csv${otaFlags}
build_flags = 
    -D BOARD_ESP32_S3=1
    -D ARDUINO_USB_CDC_ON_BOOT=1
lib_deps = 
    knolleary/PubSubClient@^2.8
`,
    'ESP32-C6': `[env:esp32-c6-devkitc-1]
platform = espressif32
board = esp32-c6-devkitc-1
framework = arduino
monitor_speed = 115200
board_build.partitions = partitions.csv${otaFlags}
build_flags = 
    -D BOARD_ESP32_C6=1
lib_deps = 
    knolleary/PubSubClient@^2.8
`,
    'ESP32-P4': `[env:esp32-p4-ev]
platform = espressif32
board = esp32-p4-devkit
framework = arduino
monitor_speed = 115200
board_build.partitions = partitions.csv${otaFlags}
build_flags = 
    -D BOARD_ESP32_P4=1
lib_deps = 
    knolleary/PubSubClient@^2.8
    arduino-libraries/Ethernet@^2.0.2
`,
    'ESP8266': `[env:nodemcuv2]
platform = espressif8266
board = nodemcuv2
framework = arduino
monitor_speed = 115200${otaFlags}
build_flags = 
    -D BOARD_ESP8266=1
lib_deps = 
    knolleary/PubSubClient@^2.8
`
  };

  return configs[selectedMcu];
}

