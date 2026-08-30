import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;

class LeaderboardScreen extends StatefulWidget {
  const LeaderboardScreen({super.key});

  @override
  State<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends State<LeaderboardScreen> {
  bool _isToday = true;
  List<Map<String, dynamic>> _rankings = [];
  bool _isLoading = true;

  static const Color _bgColor = Color(0xFFFDF5F0);
  static const Color _cardColor = Color(0xFFFFF0E8);
  static const Color _accentColor = Color(0xFFE8734A);
  static const Color _textColor = Color(0xFF3D2C2C);
  static const Color _subtextColor = Color(0xFF9C8A8A);

  @override
  void initState() {
    super.initState();
    _loadRankings();
  }

  Future<void> _loadRankings() async {
    setState(() => _isLoading = true);
    try {
      final response = await http.get(
        Uri.parse('https://graceful-mink-900.convex.site/api/query/situpLogs.getLeaderboard?isToday=$_isToday'),
      );
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        setState(() {
          _rankings = List<Map<String, dynamic>>.from(data['result'] ?? []);
          _isLoading = false;
        });
      } else {
        setState(() { _isLoading = false; });
      }
    } catch (_) {
      setState(() { _isLoading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Toggle
          Container(
            decoration: BoxDecoration(
              color: _cardColor,
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: _accentColor.withAlpha(15),
                  blurRadius: 15,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() { _isToday = true; _loadRankings(); }),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      decoration: BoxDecoration(
                        color: _isToday ? _accentColor : Colors.transparent,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Center(
                        child: Text("Today",
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: _isToday ? Colors.white : _subtextColor,
                            )),
                      ),
                    ),
                  ),
                ),
                Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() { _isToday = false; _loadRankings(); }),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      decoration: BoxDecoration(
                        color: !_isToday ? _accentColor : Colors.transparent,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Center(
                        child: Text("All Time",
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: !_isToday ? Colors.white : _subtextColor,
                            )),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          Text(_isToday ? "Today's Rankings" : "All Time Rankings",
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: _textColor)),

          const SizedBox(height: 16),

          // Rankings
          if (_isLoading)
            Center(
              child: CircularProgressIndicator(color: _accentColor),
            )
          else if (_rankings.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(40),
              decoration: BoxDecoration(
                color: _cardColor,
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: _accentColor.withAlpha(15),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Icon(Icons.emoji_events, size: 48, color: _subtextColor),
                  const SizedBox(height: 16),
                  Text("No sessions logged today.",
                      style: TextStyle(fontSize: 16, color: _textColor, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  Text("Be the first!",
                      style: TextStyle(fontSize: 14, color: _subtextColor)),
                ],
              ),
            )
          else
            ...List.generate(_rankings.length, (index) {
              final rank = _rankings[index];
              final medals = ['🥇', '🥈', '🥉'];
              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: _cardColor,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: _accentColor.withAlpha(15),
                      blurRadius: 15,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Text(
                      index < 3 ? medals[index] : "${index + 1}",
                      style: TextStyle(
                        fontSize: index < 3 ? 24 : 16,
                        fontWeight: FontWeight.bold,
                        color: _textColor,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(rank['username'] ?? 'Unknown',
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: _textColor)),
                          Text("${rank['count'] ?? 0} reps",
                              style: TextStyle(fontSize: 13, color: _subtextColor)),
                        ],
                      ),
                    ),
                    Icon(Icons.emoji_events, color: _accentColor, size: 20),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}
