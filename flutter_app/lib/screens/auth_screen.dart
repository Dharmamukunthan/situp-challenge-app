import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;

class AuthScreen extends StatefulWidget {
  final Function(String username) onAuth;

  const AuthScreen({super.key, required this.onAuth});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _controller = TextEditingController();
  bool _isLoading = false;
  String? _error;

  static const Color _bgColor = Color(0xFFFDF5F0);
  static const Color _cardColor = Color(0xFFFFF0E8);
  static const Color _accentColor = Color(0xFFE8734A);
  static const Color _textColor = Color(0xFF3D2C2C);
  static const Color _subtextColor = Color(0xFF9C8A8A);

  Future<void> _signIn() async {
    final username = _controller.text.trim();
    if (username.isEmpty) {
      setState(() => _error = "Please enter a username");
      return;
    }

    setState(() { _isLoading = true; _error = null; });

    try {
      final response = await http.post(
        Uri.parse('https://graceful-mink-900.convex.site/api/mutation/users.signInWithUsername'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'args': {'username': username}}),
      );

      if (response.statusCode == 200) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('situp-username', username);
        widget.onAuth(username);
      } else {
        setState(() { _error = "Failed to sign in"; _isLoading = false; });
      }
    } catch (_) {
      setState(() { _error = "Network error"; _isLoading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bgColor,
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              color: _cardColor,
              borderRadius: BorderRadius.circular(28),
              boxShadow: [
                BoxShadow(
                  color: _accentColor.withAlpha(20),
                  blurRadius: 30,
                  offset: const Offset(0, 12),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Logo
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: _accentColor.withAlpha(30),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.shield, color: _accentColor, size: 36),
                ),

                const SizedBox(height: 24),

                Text("Situp Challenge",
                    style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: _textColor)),

                const SizedBox(height: 8),

                Text("Count situps with precision.",
                    style: TextStyle(fontSize: 16, color: _subtextColor)),

                const SizedBox(height: 32),

                // Username input
                TextField(
                  controller: _controller,
                  decoration: InputDecoration(
                    hintText: "Enter username",
                    hintStyle: TextStyle(color: _subtextColor),
                    filled: true,
                    fillColor: Colors.white,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: BorderSide.none,
                    ),
                    prefixIcon: Icon(Icons.person, color: _accentColor),
                  ),
                  style: TextStyle(color: _textColor, fontSize: 16),
                  onSubmitted: (_) => _signIn(),
                ),

                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: TextStyle(color: Colors.red, fontSize: 14)),
                ],

                const SizedBox(height: 24),

                // Sign in button
                SizedBox(
                  width: double.infinity, height: 56,
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _signIn,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _accentColor,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                      elevation: 0,
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            width: 24, height: 24,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                          )
                        : const Text("Get Started",
                            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
