import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'situp_counter.dart';
import 'leaderboard_screen.dart';

class DashboardScreen extends StatefulWidget {
  final String username;
  final VoidCallback onSignOut;

  const DashboardScreen({super.key, required this.username, required this.onSignOut});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _currentIndex = 0;

  // Claymorphism colors
  static const Color _bgColor = Color(0xFFFDF5F0);
  static const Color _cardColor = Color(0xFFFFF0E8);
  static const Color _accentColor = Color(0xFFE8734A);
  static const Color _textColor = Color(0xFF3D2C2C);
  static const Color _subtextColor = Color(0xFF9C8A8A);

  @override
  Widget build(BuildContext context) {
    final screens = [
      const SitupCounterScreen(),
      _buildBattlesScreen(),
      const LeaderboardScreen(),
    ];

    return Scaffold(
      backgroundColor: _bgColor,
      body: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.fromLTRB(20, 50, 20, 16),
            decoration: BoxDecoration(
              color: _cardColor,
              borderRadius: const BorderRadius.only(
                bottomLeft: Radius.circular(28),
                bottomRight: Radius.circular(28),
              ),
              boxShadow: [
                BoxShadow(
                  color: _accentColor.withAlpha(15),
                  blurRadius: 20,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: _accentColor.withAlpha(30),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.shield, color: _accentColor, size: 22),
                ),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("Situp Challenge",
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: _textColor)),
                    Text(widget.username,
                        style: TextStyle(fontSize: 13, color: _subtextColor)),
                  ],
                ),
                const Spacer(),
                IconButton(
                  onPressed: widget.onSignOut,
                  icon: Icon(Icons.logout, color: _subtextColor, size: 22),
                ),
              ],
            ),
          ),

          // Body
          Expanded(child: screens[_currentIndex]),

          // Bottom Nav
          Container(
            margin: const EdgeInsets.fromLTRB(20, 0, 20, 20),
            padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 8),
            decoration: BoxDecoration(
              color: _cardColor,
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: _accentColor.withAlpha(20),
                  blurRadius: 20,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildNavItem(0, Icons.camera_alt, "Count"),
                _buildNavItem(1, Icons.flash_on, "Head-to-Head"),
                _buildNavItem(2, Icons.emoji_events, "Leaderboard"),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNavItem(int index, IconData icon, String label) {
    final isSelected = _currentIndex == index;
    return GestureDetector(
      onTap: () => setState(() => _currentIndex = index),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: isSelected
            ? BoxDecoration(
                color: _accentColor.withAlpha(30),
                borderRadius: BorderRadius.circular(16),
              )
            : null,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: isSelected ? _accentColor : _subtextColor, size: 22),
            const SizedBox(height: 4),
            Text(label, style: TextStyle(
              fontSize: 11,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              color: isSelected ? _accentColor : _subtextColor,
            )),
          ],
        ),
      ),
    );
  }

  Widget _buildBattlesScreen() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: _cardColor,
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: _accentColor.withAlpha(20),
                  blurRadius: 20,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: _accentColor.withAlpha(30),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.flash_on, color: _accentColor, size: 28),
                ),
                const SizedBox(height: 16),
                Text("Head-to-Head",
                    style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: _textColor)),
                const SizedBox(height: 8),
                Text("Choose how you want to compete.",
                    style: TextStyle(fontSize: 14, color: _subtextColor)),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity, height: 52,
                  child: ElevatedButton(
                    onPressed: () {},
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _accentColor,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      elevation: 0,
                    ),
                    child: const Text("Open Web App for Battles",
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
