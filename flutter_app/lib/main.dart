import 'package:flutter/material.dart';
import 'screens/situp_counter.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const SitupChallengeApp());
}

class SitupChallengeApp extends StatelessWidget {
  const SitupChallengeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Situp Challenge',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF6366F1),
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFF0F0F1A),
      ),
      home: const SitupCounterScreen(),
    );
  }
}
