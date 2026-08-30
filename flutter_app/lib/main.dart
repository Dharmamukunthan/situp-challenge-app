import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'screens/auth_screen.dart';
import 'screens/dashboard_screen.dart';

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
          seedColor: const Color(0xFFE8734A),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFFDF5F0),
      ),
      home: const AuthWrapper(),
    );
  }
}

class AuthWrapper extends StatefulWidget {
  const AuthWrapper({super.key});

  @override
  State<AuthWrapper> createState() => _AuthWrapperState();
}

class _AuthWrapperState extends State<AuthWrapper> {
  bool _checking = true;
  bool _isLoggedIn = false;
  String _username = '';

  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  void _checkAuth() async {
    final prefs = await SharedPreferences.getInstance();
    final username = prefs.getString('situp-username');
    setState(() {
      _isLoggedIn = username != null && username.isNotEmpty;
      _username = username ?? '';
      _checking = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_checking) {
      return const Scaffold(
        backgroundColor: Color(0xFFFDF5F0),
        body: Center(child: CircularProgressIndicator(color: Color(0xFFE8734A))),
      );
    }
    if (_isLoggedIn) {
      return DashboardScreen(
        username: _username,
        onSignOut: () async {
          final prefs = await SharedPreferences.getInstance();
          await prefs.remove('situp-username');
          setState(() {
            _isLoggedIn = false;
            _username = '';
          });
        },
      );
    }
    return AuthScreen(onAuth: (username) {
      setState(() {
        _isLoggedIn = true;
        _username = username;
      });
    });
  }
}
