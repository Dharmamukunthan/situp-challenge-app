import 'package:flutter/material.dart';
import 'dart:convert';
import 'dart:async';
import 'package:http/http.dart' as http;
import 'situp_counter.dart';
import 'leaderboard_screen.dart';

class DashboardScreen extends StatefulWidget {
  final String username;
  final bool isDark;
  final VoidCallback onToggleTheme;
  final VoidCallback onSignOut;

  const DashboardScreen({
    super.key,
    required this.username,
    required this.isDark,
    required this.onToggleTheme,
    required this.onSignOut,
  });

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
  String _searchStatus = "";

  // Light colors
  static const Color _lightBg = Color(0xFFFDF5F0);
  static const Color _lightCard = Color(0xFFFFF0E8);
  static const Color _lightText = Color(0xFF3D2C2C);
  static const Color _lightSubtext = Color(0xFF9C8A8A);
  static const Color _accent = Color(0xFFE8734A);

  // Dark colors
  static const Color _darkBg = Color(0xFF1A1A2E);
  static const Color _darkCard = Color(0xFF252540);
  static const Color _darkText = Color(0xFFF5F5F5);
  static const Color _darkSubtext = Color(0xFF9CA3AF);

  Color get _bg => widget.isDark ? _darkBg : _lightBg;
  Color get _card => widget.isDark ? _darkCard : _lightCard;
  Color get _text => widget.isDark ? _darkText : _lightText;
  Color get _subtext => widget.isDark ? _darkSubtext : _lightSubtext;

  @override
  void dispose() {
    _battleTimer?.cancel();
    _pollTimer?.cancel();
    super.dispose();
  }

  // --- RANDOM MATCH ---
  void _startRandomMatch() async {
    setState(() {
      _isSearching = true;
      _searchStatus = "Searching for opponent...";
    });

    try {
      final response = await http.post(
        Uri.parse('https://graceful-mink-900.convex.site/api/mutation'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'path': 'matchmaking:findMatch',
          'args': {
            'userId': widget.username,
            'username': widget.username,
            'duration': _selectedDuration,
          }
        }),
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final result = data['result'];

        if (result != null && result is String) {
          setState(() => _battleId = result);
          _fetchBattleAndStart(result);
        } else {
          _pollForMatch();
        }
      } else {
        setState(() => _isSearching = false);
        _showSnackBar("Failed to find match");
      }
    } catch (_) {
      setState(() => _isSearching = false);
      _showSnackBar("Network error");
    }
  }

  void _pollForMatch() {
    _pollTimer?.cancel();
    int attempts = 0;

    _pollTimer = Timer.periodic(const Duration(seconds: 2), (timer) async {
      attempts++;

      if (mounted) {
        setState(() {
          _searchStatus = "Searching for opponent... ($attempts)";
        });
      }

      if (attempts > 90) {
        timer.cancel();
        if (mounted) setState(() => _isSearching = false);
        _showSnackBar("No opponent found. Try again.");
        return;
      }

      try {
        final response = await http.post(
          Uri.parse('https://graceful-mink-900.convex.site/api/query'),
          headers: {'Content-Type': 'application/json'},
          body: json.encode({
            'path': 'matchmaking:getMyMatch',
            'args': {'userId': widget.username},
          }),
        );

        if (response.statusCode == 200) {
          final data = json.decode(response.body);
          final result = data['result'];

          if (result != null && result is Map && result['battleId'] != null) {
            timer.cancel();
            final battleId = result['battleId'] as String;
            setState(() => _battleId = battleId);
            _fetchBattleAndStart(battleId);
          }
        }
      } catch (_) {}
    });
  }

  void _fetchBattleAndStart(String battleId) async {
    try {
      final response = await http.post(
        Uri.parse('https://graceful-mink-900.convex.site/api/query'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'path': 'battles:getBattle',
          'args': {'battleId': battleId},
        }),
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final battle = data['result'];

        if (battle != null && battle is Map) {
          final opponentName = battle['creatorId'] == widget.username
              ? (battle['opponentId'] ?? 'Opponent')
              : (battle['creatorId'] ?? 'Opponent');
          final duration = battle['duration'] ?? _selectedDuration;

          _startBattle(opponentName, duration);
          return;
        }
      }
    } catch (_) {}

    _startBattle("Opponent", _selectedDuration);
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

    _startOpponentScorePolling();
  }

  void _startOpponentScorePolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 3), (timer) async {
      if (!_inBattle || _battleId == null) {
        timer.cancel();
        return;
      }

      try {
        final response = await http.post(
          Uri.parse('https://graceful-mink-900.convex.site/api/query'),
          headers: {'Content-Type': 'application/json'},
          body: json.encode({
            'path': 'battles:getBattle',
            'args': {'battleId': _battleId!},
          }),
        );

        if (response.statusCode == 200) {
          final data = json.decode(response.body);
          final battle = data['result'];

          if (battle != null && battle is Map && mounted) {
            setState(() {
              if (battle['creatorId'] == widget.username) {
                _battleOpponentReps = battle['opponentScore'] ?? 0;
              } else {
                _battleOpponentReps = battle['creatorScore'] ?? 0;
              }
            });

            await http.post(
              Uri.parse('https://graceful-mink-900.convex.site/api/mutation'),
              headers: {'Content-Type': 'application/json'},
              body: json.encode({
                'path': 'battles:updateScore',
                'args': {
                  'battleId': _battleId!,
                  'userId': widget.username,
                  'score': _battleMyReps,
                },
              }),
            );
          }
        }
      } catch (_) {}
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

    if (_battleId != null) {
      http.post(
        Uri.parse('https://graceful-mink-900.convex.site/api/mutation'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'path': 'battles:endBattle',
          'args': {'battleId': _battleId!},
        }),
      ).catchError((_) {});
    }

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        backgroundColor: _card,
        title: Text(resultText, textAlign: TextAlign.center, style: TextStyle(color: _text)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text("You: $myScore reps",
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: _accent)),
            Text("$_opponentName: $oppScore reps",
                style: TextStyle(fontSize: 18, color: _subtext)),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text("OK", style: TextStyle(color: _accent)),
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
      SitupCounterScreen(
        isDark: widget.isDark,
        onSessionEnd: (reps) {},
      ),
      _buildBattlesScreen(),
      LeaderboardScreen(isDark: widget.isDark),
    ];

    return Scaffold(
      backgroundColor: _bg,
      body: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.fromLTRB(20, 50, 20, 16),
            decoration: BoxDecoration(
              color: _card,
              borderRadius: const BorderRadius.only(
                bottomLeft: Radius.circular(28),
                bottomRight: Radius.circular(28),
              ),
              boxShadow: [
                BoxShadow(
                  color: _accent.withAlpha(15),
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
                    color: _accent.withAlpha(30),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.shield, color: _accent, size: 22),
                ),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "Situp Challenge",
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: _text,
                      ),
                    ),
                    Text(
                      widget.username,
                      style: TextStyle(fontSize: 13, color: _subtext),
                    ),
                  ],
                ),
                const Spacer(),
                // Theme toggle
                GestureDetector(
                  onTap: widget.onToggleTheme,
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: _accent.withAlpha(20),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      widget.isDark ? Icons.light_mode : Icons.dark_mode,
                      color: _accent,
                      size: 20,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                // Sign out
                GestureDetector(
                  onTap: widget.onSignOut,
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: _accent.withAlpha(20),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.logout, color: _accent, size: 20),
                  ),
                ),
              ],
            ),
          ),

          // Content
          Expanded(child: screens[_currentIndex]),

          // Bottom nav
          Container(
            margin: const EdgeInsets.fromLTRB(20, 0, 20, 20),
            padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 8),
            decoration: BoxDecoration(
              color: _card,
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: _accent.withAlpha(20),
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
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: isSelected
            ? BoxDecoration(
                color: _accent.withAlpha(30),
                borderRadius: BorderRadius.circular(16),
              )
            : null,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              color: isSelected ? _accent : _subtext,
              size: 22,
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                color: isSelected ? _accent : _subtext,
              ),
            ),
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
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: isSelected ? _accent : (widget.isDark ? const Color(0xFF2D2D44) : Colors.white),
            borderRadius: BorderRadius.circular(16),
            boxShadow: isSelected
                ? [BoxShadow(color: _accent.withAlpha(40), blurRadius: 10)]
                : [],
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.bold,
                color: isSelected ? Colors.white : _text,
              ),
            ),
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
          // Main battle card
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: _card,
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: _accent.withAlpha(20),
                  blurRadius: 20,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Column(
              children: [
                // Title
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: _accent.withAlpha(30),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.flash_on, color: _accent, size: 28),
                ),
                const SizedBox(height: 16),
                Text(
                  "Head-to-Head",
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: _text,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  "Choose how you want to compete.",
                  style: TextStyle(fontSize: 14, color: _subtext),
                ),

                const SizedBox(height: 24),

                // Duration selector
                Text(
                  "Select Duration",
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: _text,
                  ),
                ),
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

                // Random Match button
                _buildBattleOption(
                  icon: Icons.language,
                  title: "Random Match",
                  subtitle: _isSearching ? _searchStatus : "Compete against a random online player",
                  color: _accent,
                  isSearching: _isSearching,
                  onTap: _isSearching ? null : _startRandomMatch,
                ),

                const SizedBox(height: 14),

                // Private Room button
                _buildBattleOption(
                  icon: Icons.lock,
                  title: "Private Room",
                  subtitle: "Create a room and invite friends with a code",
                  color: const Color(0xFF4CAF50),
                  onTap: () => _showSnackBar("Private rooms coming soon!"),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBattleOption({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
    bool isSearching = false,
    VoidCallback? onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: widget.isDark ? const Color(0xFF2D2D44) : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: color.withAlpha(40), width: 2),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: color.withAlpha(30),
                shape: BoxShape.circle,
              ),
              child: isSearching
                  ? SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: color,
                      ),
                    )
                  : Icon(icon, color: color, size: 22),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: _text,
                    ),
                  ),
                  Text(
                    subtitle,
                    style: TextStyle(fontSize: 13, color: _subtext),
                  ),
                ],
              ),
            ),
            if (!isSearching) Icon(Icons.chevron_right, color: color),
          ],
        ),
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
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: _card,
                borderRadius: BorderRadius.circular(28),
                boxShadow: [
                  BoxShadow(
                    color: _accent.withAlpha(20),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Text(
                    "⚔️ BATTLE IN PROGRESS",
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: _accent,
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Timer
                  Text(
                    "${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}",
                    style: TextStyle(
                      fontSize: 56,
                      fontWeight: FontWeight.w900,
                      color: _text,
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Scores
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      Column(
                        children: [
                          Text(
                            "You",
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: _text,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            "$_battleMyReps",
                            style: TextStyle(
                              fontSize: 36,
                              fontWeight: FontWeight.w900,
                              color: _accent,
                            ),
                          ),
                          Text("reps", style: TextStyle(fontSize: 12, color: _subtext)),
                        ],
                      ),
                      Container(
                        width: 2,
                        height: 60,
                        color: _subtext.withAlpha(50),
                      ),
                      Column(
                        children: [
                          Text(
                            _opponentName ?? "Opponent",
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: _text,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            "$_battleOpponentReps",
                            style: const TextStyle(
                              fontSize: 36,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF2196F3),
                            ),
                          ),
                          Text("reps", style: TextStyle(fontSize: 12, color: _subtext)),
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
