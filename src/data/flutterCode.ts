export interface FlutterFile {
  filename: string;
  path: string;
  language: string;
  description: string;
  code: string;
}

export const FLUTTER_PROJECT_FILES: FlutterFile[] = [
  {
    filename: 'main.dart',
    path: 'lib/main.dart',
    language: 'dart',
    description: 'Titik masuk aplikasi Flutter, tema Material 3, provider state management, dan navigasi bottom bar.',
    code: `import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'screens/dashboard_screen.dart';
import 'screens/calibration_screen.dart';
import 'services/flood_api_service.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => FloodApiService()),
      ],
      child: const FloodMonitorApp(),
    ),
  );
}

class FloodMonitorApp extends StatelessWidget {
  const FloodMonitorApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Pantau Tiang Banjir IoT',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        colorSchemeSeed: Colors.cyan,
        scaffoldBackgroundColor: const Color(0xFF0A0F1D),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF0F172A),
          elevation: 0,
          centerTitle: true,
        ),
      ),
      home: const MainNavigationShell(),
    );
  }
}

class MainNavigationShell extends StatefulWidget {
  const MainNavigationShell({super.key});

  @override
  State<MainNavigationShell> createState() => _MainNavigationShellState();
}

class _MainNavigationShellState extends State<MainNavigationShell> {
  int _currentIndex = 0;

  final List<Widget> _screens = const [
    DashboardScreen(),
    CalibrationScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (idx) => setState(() => _currentIndex = idx),
        backgroundColor: const Color(0xFF0F172A),
        indicatorColor: Colors.cyan.withOpacity(0.25),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.waves_outlined),
            selectedIcon: Icon(Icons.waves, color: Colors.cyanAccent),
            label: 'Pemantauan',
          ),
          NavigationDestination(
            icon: Icon(Icons.tune_outlined),
            selectedIcon: Icon(Icons.tune, color: Colors.cyanAccent),
            label: 'Kalibrasi & Tare',
          ),
        ],
      ),
    );
  }
}
`
  },
  {
    filename: 'telemetry_model.dart',
    path: 'lib/models/telemetry_model.dart',
    language: 'dart',
    description: 'Model data JSON yang memetakan payload sensor dari ESP32/ESP8266.',
    code: `enum AlertStatus {
  normal,
  waspada,
  amaran,
  bahaya;

  static AlertStatus fromString(String status) {
    switch (status.toUpperCase()) {
      case 'BAHAYA':
        return AlertStatus.bahaya;
      case 'AMARAN':
        return AlertStatus.amaran;
      case 'WASPADA':
        return AlertStatus.waspada;
      case 'NORMAL':
      default:
        return AlertStatus.normal;
    }
  }

  String get label {
    switch (this) {
      case AlertStatus.bahaya:
        return 'BAHAYA';
      case AlertStatus.amaran:
        return 'AMARAN';
      case AlertStatus.waspada:
        return 'WASPADA';
      case AlertStatus.normal:
        return 'NORMAL';
    }
  }
}

class TelemetryData {
  final String chipModel;
  final double waterLevel;
  final double rawFrequency;
  final double batteryVoltage;
  final int batteryPercentage;
  final AlertStatus status;
  final DateTime timestamp;

  TelemetryData({
    required this.chipModel,
    required this.waterLevel,
    required this.rawFrequency,
    required this.batteryVoltage,
    required this.batteryPercentage,
    required this.status,
    required this.timestamp,
  });

  factory TelemetryData.fromJson(Map<String, dynamic> json) {
    return TelemetryData(
      chipModel: json['chipModel'] ?? 'ESP32',
      waterLevel: (json['waterLevel'] as num?)?.toDouble() ?? 0.0,
      rawFrequency: (json['rawFrequency'] as num?)?.toDouble() ?? 0.0,
      batteryVoltage: (json['batteryVoltage'] as num?)?.toDouble() ?? 0.0,
      batteryPercentage: (json['batteryPercentage'] as num?)?.toInt() ?? 0,
      status: AlertStatus.fromString(json['status'] ?? 'NORMAL'),
      timestamp: DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'chipModel': chipModel,
      'waterLevel': waterLevel,
      'rawFrequency': rawFrequency,
      'batteryVoltage': batteryVoltage,
      'batteryPercentage': batteryPercentage,
      'status': status.label,
    };
  }
}
`
  },
  {
    filename: 'flood_api_service.dart',
    path: 'lib/services/flood_api_service.dart',
    language: 'dart',
    description: 'Servis komunikasi HTTP REST API, polling automatik berkala, dan arahan remote Tare/Auto-Zero.',
    code: `import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/telemetry_model.dart';

class FloodApiService extends ChangeNotifier {
  String _baseUrl = 'http://192.168.1.100:3000';
  TelemetryData? _latestTelemetry;
  bool _isLoading = false;
  bool _isConnected = false;
  String? _errorMessage;
  Timer? _pollingTimer;

  final List<TelemetryData> _history = [];

  FloodApiService() {
    startAutoPolling();
  }

  String get baseUrl => _baseUrl;
  TelemetryData? get latestTelemetry => _latestTelemetry;
  bool get isLoading => _isLoading;
  bool get isConnected => _isConnected;
  String? get errorMessage => _errorMessage;
  List<TelemetryData> get history => List.unmodifiable(_history);

  void updateBaseUrl(String newUrl) {
    _baseUrl = newUrl;
    notifyListeners();
    fetchLatestTelemetry();
  }

  void startAutoPolling() {
    _pollingTimer?.cancel();
    _pollingTimer = Timer.periodic(const Duration(seconds: 3), (timer) {
      fetchLatestTelemetry();
    });
  }

  Future<void> fetchLatestTelemetry() async {
    try {
      final uri = Uri.parse('$_baseUrl/api/data');
      final response = await http.get(uri).timeout(const Duration(seconds: 4));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        _latestTelemetry = TelemetryData.fromJson(data);
        _isConnected = true;
        _errorMessage = null;

        // Tambah ke senarai rekod sejarah (simpan 50 data terakhir)
        if (_latestTelemetry != null) {
          _history.insert(0, _latestTelemetry!);
          if (_history.length > 50) _history.removeLast();
        }
      } else {
        _isConnected = false;
        _errorMessage = 'Ralat Server: \${response.statusCode}';
      }
    } catch (e) {
      _isConnected = false;
      _errorMessage = 'Gagal menghubungi sensor tiang: \$e';
    } finally {
      notifyListeners();
    }
  }

  // Arahan Auto-Zero / Tare dari jauh ke mikropengawal
  Future<bool> sendRemoteTareCommand() async {
    _isLoading = true;
    notifyListeners();
    try {
      final uri = Uri.parse('$_baseUrl/api/calibration/tare');
      final response = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'action': 'TARE_ZERO'}),
      ).timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        await fetchLatestTelemetry();
        _isLoading = false;
        notifyListeners();
        return true;
      }
    } catch (e) {
      _errorMessage = 'Gagal menghantar arahan Tare: \$e';
    }
    _isLoading = false;
    notifyListeners();
    return false;
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    super.dispose();
  }
}
`
  },
  {
    filename: 'dashboard_screen.dart',
    path: 'lib/screens/dashboard_screen.dart',
    language: 'dart',
    description: 'Papan pemuka utama Flutter: Tiang aras air visual, tolok radial, amaran banjir bertingkat, dan status bateri.',
    code: `import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/flood_api_service.dart';
import '../models/telemetry_model.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  Color _getStatusColor(AlertStatus status) {
    switch (status) {
      case AlertStatus.bahaya:
        return const Color(0xFFEF4444); // Merah
      case AlertStatus.amaran:
        return const Color(0xFFF97316); // Oren
      case AlertStatus.waspada:
        return const Color(0xFFEAB308); // Kuning
      case AlertStatus.normal:
        return const Color(0xFF10B981); // Hijau
    }
  }

  @override
  Widget build(BuildContext context) {
    final apiService = context.watch<FloodApiService>();
    final data = apiService.latestTelemetry;
    final statusColor = data != null ? _getStatusColor(data.status) : Colors.grey;

    return Scaffold(
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cell_tower, color: Colors.cyanAccent, size: 20),
            const SizedBox(width: 8),
            Text(
              data != null ? 'Tiang Sensor (\${data.chipModel})' : 'Tiang Sensor Banjir',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: Icon(
              apiService.isConnected ? Icons.wifi : Icons.wifi_off,
              color: apiService.isConnected ? Colors.greenAccent : Colors.redAccent,
            ),
            tooltip: apiService.isConnected ? 'Dalam Talian' : 'Terputus',
            onPressed: () => apiService.fetchLatestTelemetry(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => apiService.fetchLatestTelemetry(),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 1. Kad Amaran Status Utama
              Container(
                padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
                decoration: BoxDecoration(
                  color: statusColor.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: statusColor.withOpacity(0.5), width: 1.5),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: statusColor.withOpacity(0.2),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        data?.status == AlertStatus.bahaya ? Icons.warning : Icons.info_outline,
                        color: statusColor,
                        size: 30,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'STATUS: \${data?.status.label ?? "TIADA DATA"}',
                            style: TextStyle(
                              color: statusColor,
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.0,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            data?.status == AlertStatus.bahaya
                                ? 'AMARAN BAHAYA: Lakukan pemindahan segera!'
                                : data?.status == AlertStatus.amaran
                                    ? 'Paras air meningkat laju. Sedia untuk berpindah.'
                                    : data?.status == AlertStatus.waspada
                                        ? 'Paras waspada, pantau maklumat semasa.'
                                        : 'Paras air sungai dalam keadaan selamat.',
                            style: const TextStyle(fontSize: 12, color: Colors.white70),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // 2. Visual Tiang Aras Air & Tolok Utama
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: const Color(0xFF131D33),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.white.withOpacity(0.08)),
                ),
                child: Column(
                  children: [
                    const Text(
                      'KETINGGIAN ARAS AIR SEMASA',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white54),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(
                          (data?.waterLevel ?? 0.0).toStringAsFixed(1),
                          style: TextStyle(
                            fontSize: 54,
                            fontWeight: FontWeight.w900,
                            color: statusColor,
                            fontFamily: 'monospace',
                          ),
                        ),
                        const SizedBox(width: 8),
                        const Text(
                          'cm',
                          style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white70),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // Bar Ketinggian Visual Tiang Air
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        height: 20,
                        color: Colors.black26,
                        child: LayoutBuilder(
                          builder: (context, constraints) {
                            final fraction = ((data?.waterLevel ?? 0.0) / 100.0).clamp(0.0, 1.0);
                            return Stack(
                              children: [
                                FractionallySizedBox(
                                  widthFactor: fraction,
                                  child: Container(
                                    decoration: BoxDecoration(
                                      gradient: LinearGradient(
                                        colors: [Colors.cyan, statusColor],
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            );
                          },
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('0 cm (Dasar)', style: TextStyle(fontSize: 10, color: Colors.white38)),
                        Text('50 cm (Waspada)', style: TextStyle(fontSize: 10, color: Colors.white38)),
                        Text('100+ cm (Bahaya)', style: TextStyle(fontSize: 10, color: Colors.white38)),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // 3. Grid Kad Telemetri Sensor & Bateri
              Row(
                children: [
                  Expanded(
                    child: _buildMetricTile(
                      title: 'Frekuensi Sensor',
                      value: '\${(data?.rawFrequency ?? 0.0).toStringAsFixed(1)} Hz',
                      subtitle: 'Litar IC555 Gating',
                      icon: Icons.graphic_eq,
                      accentColor: Colors.cyanAccent,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildMetricTile(
                      title: 'Bateri Tiang',
                      value: '\${(data?.batteryVoltage ?? 0.0).toStringAsFixed(2)} V',
                      subtitle: '\${data?.batteryPercentage ?? 0}% (LiPo 1S)',
                      icon: Icons.battery_charging_full,
                      accentColor: Colors.amberAccent,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMetricTile({
    required String title,
    required String value,
    required String subtitle,
    required IconData icon,
    required Color accentColor,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF131D33),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.06)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: accentColor, size: 18),
              const SizedBox(width: 6),
              Text(title, style: const TextStyle(fontSize: 11, color: Colors.white60)),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            value,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, fontFamily: 'monospace'),
          ),
          const SizedBox(height: 4),
          Text(subtitle, style: const TextStyle(fontSize: 10, color: Colors.white38)),
        ],
      ),
    );
  }
}
`
  },
  {
    filename: 'calibration_screen.dart',
    path: 'lib/screens/calibration_screen.dart',
    language: 'dart',
    description: 'Skrin kawalan jauh untuk Auto-Zero / Tare Offset, penetapan URL Gateway, dan maklumat kalibrasi NVS.',
    code: `import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/flood_api_service.dart';

class CalibrationScreen extends StatefulWidget {
  const CalibrationScreen({super.key});

  @override
  State<CalibrationScreen> createState() => _CalibrationScreenState();
}

class _CalibrationScreenState extends State<CalibrationScreen> {
  final TextEditingController _urlController = TextEditingController();

  @override
  void initState() {
    super.initState();
    final apiService = context.read<FloodApiService>();
    _urlController.text = apiService.baseUrl;
  }

  @override
  Widget build(BuildContext context) {
    final apiService = context.watch<FloodApiService>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Tetapan Kalibrasi & NVS', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Kad 1: Auto-Zero / Tare Offset
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: const Color(0xFF131D33),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.cyan.withOpacity(0.3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.adjust, color: Colors.cyanAccent),
                      SizedBox(width: 8),
                      Text('Auto-Zero (Tare Offset)', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Tetapkan aras air semasa sebagai titik sifar (0.0 cm). Nilai offset akan disimpan ke dalam Flash NVS mikropengawal secara kekal.',
                    style: TextStyle(fontSize: 12, color: Colors.white70),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.cyan.shade600,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      onPressed: apiService.isLoading
                          ? null
                          : () async {
                              final success = await apiService.sendRemoteTareCommand();
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(
                                      success
                                          ? 'Berjaya: Titik sifar (Tare 0 cm) disimpan ke NVS!'
                                          : 'Gagal melakukan Tare dari jauh.',
                                    ),
                                    backgroundColor: success ? Colors.green : Colors.red,
                                  ),
                                );
                              }
                            },
                      icon: apiService.isLoading
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Icon(Icons.restore),
                      label: const Text('LAKUKAN AUTO-ZERO (TARE 0 CM)', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // Kad 2: Konfigurasi Endpoint Gateway Sensor
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: const Color(0xFF131D33),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white.withOpacity(0.06)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Endpoint Gateway Sensor (REST API)', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _urlController,
                    decoration: InputDecoration(
                      hintText: 'http://192.168.1.100:3000',
                      prefixIcon: const Icon(Icons.link, size: 20),
                      filled: true,
                      fillColor: Colors.black26,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton.icon(
                      onPressed: () {
                        apiService.updateBaseUrl(_urlController.text.trim());
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Endpoint gateway dikemas kini.')),
                        );
                      },
                      icon: const Icon(Icons.save),
                      label: const Text('Simpan Endpoint'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
`
  },
  {
    filename: 'pubspec.yaml',
    path: 'pubspec.yaml',
    language: 'yaml',
    description: 'Konfigurasi pakej dependensi Flutter untuk HTTP, Provider, dan UI ikon.',
    code: `name: flood_sensor_monitor
description: "Aplikasi Pemantauan Tiang Aras Air Banjir IoT untuk ESP32/ESP8266"
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  http: ^1.2.0
  provider: ^6.1.1
  cupertino_icons: ^1.0.6

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.0

flutter:
  uses-material-design: true
`
  },
  {
    filename: 'AndroidManifest.xml',
    path: 'android/app/src/main/AndroidManifest.xml',
    language: 'xml',
    description: 'Kebenaran Android (INTERNET & ACCESS_NETWORK_STATE) serta pengecualian cleartext HTTP untuk gateway IoT LAN tempatan.',
    code: `<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.example.flood_sensor_monitor">

    <!-- Kebenaran capaian rangkaian IoT & REST API -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:label="Tiang Aras Air Banjir IoT"
        android:name="\${applicationName}"
        android:icon="@mipmap/ic_launcher"
        android:usesCleartextTraffic="true">
        
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTop"
            android:theme="@style/LaunchTheme"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|smallestScreenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
            android:hardwareAccelerated="true"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
        </activity>
    </application>
</manifest>
`
  }
];
