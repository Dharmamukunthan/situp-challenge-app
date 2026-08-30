import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'situp_counter.dart';
import 'leaderboard_screen.dart';
import 'auth_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _currentIndex = 0;
  String _username = "Athlete";

  @override
  void initState() {
    super.initState();
    _loadUsername();
  }

  void _loadUsername() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _username = prefs.getString('username') ?? "Athlete";
    });
  }

  void _logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    if (mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const AuthScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final screens = [
      const SitupCounterScreen(),
      const _BattlesPlaceholder(),
      const LeaderboardScreen(),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text("Situp Challenge", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            Text(_username, style: const TextStyle(fontSize: 11, color: Colors.grey)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout, size: 20),
            onPressed: _logout,
          ),
        ],
        backgroundColor: const Color(0xFF0F0F1A),
        elevation: 0,
      ),
      body: screens[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (i) => setState(() => _currentIndex = i),
        backgroundColor: const Color(0xFF1A1A2E),
        selectedItemColor: const Color(0xFF6366F1),
        unselectedItemColor: Colors.grey,
        type: BottomNavigationBarType.fixed,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.camera_alt), label: "Counter"),
          BottomNavigationBarItem(icon: Icon(Icons.flash_on), label: "Battles"),
          BottomNavigationBarItem(icon: Icon(Icons.leaderboard), label: "Leaderboard"),
        ],
      ),
    );
  }
}

class _BattlesPlaceholder extends StatelessWidget {
  const _BattlesPlaceholder();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.flash_on, size: 60, color: Colors.grey[600]),
          const SizedBox(height: 16),
          Text(
            "Head-to-Head Battles",
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.grey[400]),
          ),
          const SizedBox(height: 8),
          Text(
            "Coming soon!\nUse the web app for battles.",
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: Colors.grey[600]),
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: () {
              // Open web app for battles
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF6366F1),
              foregroundColor: Colors.white,
            ),
            child: const Text("Open Web App"),
          ),
        ],
      ),
    );
  }
}
