import 'dart:convert';
import 'package:http/http.dart' as http;

class ConvexService {
  static const String baseUrl = 'https://graceful-mink-900.convex.cloud';

  // Call a Convex query
  static Future<dynamic> query(String functionName, {Map<String, dynamic>? args}) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/query'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'path': functionName,
        'args': args ?? {},
      }),
    );
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    throw Exception('Convex query failed: ${response.body}');
  }

  // Call a Convex mutation
  static Future<dynamic> mutation(String functionName, {Map<String, dynamic>? args}) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/mutation'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'path': functionName,
        'args': args ?? {},
      }),
    );
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    throw Exception('Convex mutation failed: ${response.body}');
  }

  // Get today's situp count
  static Future<int> getTodayCount(String userId) async {
    try {
      final result = await query('situpLogs:getTodayCount', args: {'userId': userId});
      return result ?? 0;
    } catch (_) {
      return 0;
    }
  }

  // Log a situp session
  static Future<void> logSession(String userId, int sessionReps) async {
    await mutation('situpLogs:logSession', args: {
      'userId': userId,
      'sessionReps': sessionReps,
    });
  }

  // Get leaderboard
  static Future<List<Map<String, dynamic>>> getLeaderboard() async {
    try {
      final result = await query('situpLogs:getLeaderboard');
      if (result is List) {
        return List<Map<String, dynamic>>.from(result);
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  // Get overall leaderboard
  static Future<List<Map<String, dynamic>>> getOverallLeaderboard() async {
    try {
      final result = await query('situpLogs:getOverallLeaderboard');
      if (result is List) {
        return List<Map<String, dynamic>>.from(result);
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  // Get history
  static Future<List<Map<String, dynamic>>> getHistory(String userId) async {
    try {
      final result = await query('situpLogs:getHistory', args: {'userId': userId});
      if (result is List) {
        return List<Map<String, dynamic>>.from(result);
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  // Username operations
  static Future<bool> checkUsername(String username) async {
    try {
      final result = await query('username:checkUsername', args: {'username': username});
      return result == true;
    } catch (_) {
      return false;
    }
  }

  static Future<void> setUsername(String userId, String username) async {
    await mutation('username:setUsername', args: {
      'userId': userId,
      'username': username,
    });
  }
}
