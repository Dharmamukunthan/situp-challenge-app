import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import 'dart:async';
import 'package:http/http.dart' as http;
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

  // Battle state
  int _selectedDuration = 60;
  bool _isSearching = false;
  String? _battleId;
  String? _opponentName;
  bool _inBattle = false;
  int _battleTimeLeft = 0;
  int _battleMyReps = 0;
  int _battleOpponentReps = 0;
  Timer? _battleTimer;
  Timer? _pollTimer;
  CameraCounterForBattle? _battleCounter;

  static const Color _bgColor = Color(0xFFFDF5F0);
  static const Color _cardColor = Color(0xFFFFF0E8);
  static const Color _accentColor = Color(0xFFE8734A);
  static const Color _textColor = Color(0xFF3D2C2C);
  static const Color _subtextColor = Color(0xFF9C8A8A);

  @override
  void dispose() {
    _battleTimer?.cancel();
    _pollTimer?.cancel();
    super.dispose();
  }

  void _startRandomMatch() async {
    setState(() => _isSearching = true);

    try {
      final response = await http.post(
        Uri.parse('https://graceful-mink-900.convex.site/api/mutation/battles.createBattle'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'args': {
            'playerName': widget.username,
            'duration': _selectedDuration,
          }
        }),
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final battleId = data['result'] ?? '';

        setState(() {
          _battleId = battleId;
          _isSearching = true;
        });

        // Poll for opponent
        _pollForOpponent(battleId);
      } else {
        setState(() => _isSearching = false);
        _showSnackBar("Failed to create battle");
      }
    } catch (_) {
      setState(() => _isSearching = false);
      _showSnackBar("Network error");
    }
  }

  void _pollForOpponent(String battleId) {
    _pollTimer?.cancel();
    int attempts = 0;

    _pollTimer = Timer.periodic(const Duration(seconds: 3), (timer) async {
      attempts++;
      if (attempts > 60) { // 3 minutes timeout
        timer.cancel();
        setState(() => _isSearching = false);
        _showSnackBar("No opponent found. Try again.");
        return;
      }

      try {
        final response = await http.get(
          Uri.parse('https://graceful-mink-900.convex.site/api/query/battles.getBattle?id=$battleId'),
        );

        if (response.statusCode == 200) {
          final data = json.decode(response.body);
          final battle = data['result'];

          if (battle != null && battle['status'] == 'active') {
            timer.cancel();
            _startBattle(battle['opponentName'] ?? 'Opponent', battle['duration'] ?? _selectedDuration);
          }
        }
      } catch (_) {}
    });
  }

  void _startBattle(String opponent, int duration) {
    setState(() {
      _isSearching = false;
      _inBattle = true;
      _opponentName = opponent;
      _battleTimeLeft = duration;
      _battleMyReps = 0;
      _battleOpponentReps = 0;
    });

    _battleTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      setState(() {
        _battleTimeLeft--;
        if (_battleTimeLeft <= 0) {
          timer.cancel();
          _endBattle();
        }
      });
    });
  }

  void _endBattle() {
    _battleTimer?.cancel();
    _pollTimer?.cancel();

    final myScore = _battleMyReps;
    final oppScore = _battleOpponentReps;
    final won = myScore > oppScore;
    final tied = myScore == oppScore;

    String resultText;
    if (tied) {
      resultText = "It's a tie!";
    } else if (won) {
      resultText = "You won! 🎉";
    } else {
      resultText = "You lost 😔";
    }

    setState(() => _inBattle = false);

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: Text(resultText, textAlign: TextAlign.center),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text("You: $myScore reps", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: _accentColor)),
            Text("$_opponentName: $oppScore reps", style: TextStyle(fontSize: 18, color: _subtextColor)),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text("OK", style: TextStyle(color: _accentColor)),
          ),
        ],
      ),
    );
  }

  void _showSnackBar(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    final screens = [
      SitupCounterScreen(onSessionEnd: (reps) {}),
      _buildBattlesScreen(),
      const LeaderboardScreen(),
    ];

    return Scaffold(
      backgroundColor: _bgColor,
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(20, 50, 20, 16),
            decoration: BoxDecoration(
              color: _cardColor,
              borderRadius: const BorderRadius.only(bottomLeft: Radius.circular(28), bottomRight: Radius.circular(28)),
              boxShadow: [BoxShadow(color: _accentColor.withAlpha(15), blurRadius: 20, offset: const Offset(0, 6))],
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(color: _accentColor.withAlpha(30), shape: BoxShape.circle),
                  child: Icon(Icons.shield, color: _accentColor, size: 22),
                ),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("Situp Challenge", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: _textColor)),
                    Text(widget.username, style: TextStyle(fontSize: 13, color: _subtextColor)),
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
          Expanded(child: screens[_currentIndex]),
          Container(
            margin: const EdgeInsets.fromLTRB(20, 0, 20, 20),
            padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 8),
            decoration: BoxDecoration(
              color: _cardColor,
              borderRadius: BorderRadius.circular(24),
              boxShadow: [BoxShadow(color: _accentColor.withAlpha(20), blurRadius: 20, offset: const Offset(0, 8))],
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
        decoration: isSelected ? BoxDecoration(color: _accentColor.withAlpha(30), borderRadius: BorderRadius.circular(16)) : null,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: isSelected ? _accentColor : _subtextColor, size: 22),
            const SizedBox(height: 4),
            Text(label, style: TextStyle(fontSize: 11, fontWeight: isSelected ? FontWeight.bold : FontWeight.normal, color: isSelected ? _accentColor : _subtextColor)),
          ],
        ),
      ),
    );
  }

  Widget _buildDurationChip(int seconds, String label) {
    final isSelected = _selectedDuration == seconds;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedDuration = seconds),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: isSelected ? _accentColor : Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: isSelected ? [BoxShadow(color: _accentColor.withAlpha(40), blurRadius: 10)] : [],
          ),
          child: Center(
            child: Text(label,
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: isSelected ? Colors.white : _textColor)),
          ),
        ),
      ),
    );
  }

  Widget _buildBattlesScreen() {
    if (_inBattle) return _buildActiveBattle();

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
              boxShadow: [BoxShadow(color: _accentColor.withAlpha(20), blurRadius: 20, offset: const Offset(0, 8))],
            ),
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(color: _accentColor.withAlpha(30), shape: BoxShape.circle),
                  child: Icon(Icons.flash_on, color: _accentColor, size: 28),
                ),
                const SizedBox(height: 16),
                Text("Head-to-Head", style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: _textColor)),
                const SizedBox(height: 8),
                Text("Choose how you want to compete.", style: TextStyle(fontSize: 14, color: _subtextColor)),
                const SizedBox(height: 24),

                Text("Select Duration", style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: _textColor)),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _buildDurationChip(30, "30s"),
                    const SizedBox(width: 10),
                    _buildDurationChip(60, "1 min"),
                    const SizedBox(width: 10),
                    _buildDurationChip(300, "5 min"),
                  ],
                ),

                const SizedBox(height: 24),

                // Random Match
                GestureDetector(
                  onTap: _isSearching ? null : _startRandomMatch,
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: _accentColor.withAlpha(40), width: 2),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(color: _accentColor.withAlpha(30), shape: BoxShape.circle),
                          child: Icon(Icons.language, color: _accentColor, size: 22),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text("Random Match", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: _textColor)),
                              Text(_isSearching ? "Searching for opponent..." : "Compete against a random online player",
                                  style: TextStyle(fontSize: 13, color: _subtextColor)),
                            ],
                          ),
                        ),
                        if (_isSearching)
                          SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: _accentColor))
                        else
                          Icon(Icons.chevron_right, color: _accentColor),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 14),

                // Private Room
                GestureDetector(
                  onTap: () => _showSnackBar("Private rooms coming soon!"),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: const Color(0xFF4CAF50).withAlpha(40), width: 2),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(color: const Color(0xFF4CAF50).withAlpha(30), shape: BoxShape.circle),
                          child: Icon(Icons.lock, color: const Color(0xFF4CAF50), size: 22),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text("Private Room", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: _textColor)),
                              Text("Create a room and invite friends with a code",
                                  style: TextStyle(fontSize: 13, color: _subtextColor)),
                            ],
                          ),
                        ),
                        Icon(Icons.chevron_right, color: const Color(0xFF4CAF50)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActiveBattle() {
    final minutes = _battleTimeLeft ~/ 60;
    final seconds = _battleTimeLeft % 60;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Timer
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: _cardColor,
                borderRadius: BorderRadius.circular(28),
                boxShadow: [BoxShadow(color: _accentColor.withAlpha(20), blurRadius: 20, offset: const Offset(0, 8))],
              ),
              child: Column(
                children: [
                  Text("⚔️ BATTLE IN PROGRESS", style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: _accentColor)),
                  const SizedBox(height: 16),
                  Text("${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}",
                      style: TextStyle(fontSize: 56, fontWeight: FontWeight.w900, color: _textColor)),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      Column(
                        children: [
                          Text("You", style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: _textColor)),
                          const SizedBox(height: 4),
                          Text("$_battleMyReps", style: TextStyle(fontSize: 36, fontWeight: FontWeight.w900, color: _accentColor)),
                          Text("reps", style: TextStyle(fontSize: 12, color: _subtextColor)),
                        ],
                      ),
                      Container(width: 2, height: 60, color: _subtextColor.withAlpha(50)),
                      Column(
                        children: [
                          Text(_opponentName ?? "Opponent", style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: _textColor)),
                          const SizedBox(height: 4),
                          Text("$_battleOpponentReps", style: TextStyle(fontSize: 36, fontWeight: FontWeight.w900, color: const Color(0xFF2196F3))),
                          Text("reps", style: TextStyle(fontSize: 12, color: _subtextColor)),
                        ],
                      ),
                    ],
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

// Placeholder class for battle camera integration
class CameraCounterForBattle {
  int reps = 0;
}
