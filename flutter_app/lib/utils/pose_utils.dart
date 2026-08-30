import 'dart:math';
import 'dart:ui';

/// Calculate angle between three points (shoulder-hip-knee)
/// Returns angle in degrees at the middle point (hip)
double calculateAngle(dynamic a, dynamic b, dynamic c) {
  // a = shoulder, b = hip, c = knee
  // Angle at point b
  final ab = Offset(a.x - b.x, a.y - b.y);
  final cb = Offset(c.x - b.x, c.y - b.y);

  final dot = ab.dx * cb.dx + ab.dy * cb.dy;
  final magAB = sqrt(ab.dx * ab.dx + ab.dy * ab.dy);
  final magCB = sqrt(cb.dx * cb.dx + cb.dy * cb.dy);

  if (magAB == 0 || magCB == 0) return 180;

  final cosAngle = (dot / (magAB * magCB)).clamp(-1.0, 1.0);
  return acos(cosAngle) * 180 / pi;
}

/// State machine for situp detection
enum SitupPhase {
  idle,
  waitingUp,
  waitingDown,
}

class SitupDetector {
  SitupPhase _phase = SitupPhase.idle;
  int _confirmCount = 0;
  int _cooldown = 0;
  int _repCount = 0;

  // Thresholds
  static const double lyingAngle = 140; // angle > 140 = lying flat
  static const double sittingAngle = 100; // angle < 100 = sitting up
  static const int confirmFrames = 8; // frames needed to confirm
  static const int cooldownFrames = 20; // cooldown between reps

  int get repCount => _repCount;
  SitupPhase get phase => _phase;
  int get confirmCount => _confirmCount;

  /// Process a new angle measurement. Returns true if a rep was counted.
  bool processAngle(double angle) {
    if (_cooldown > 0) {
      _cooldown--;
      return false;
    }

    final isLying = angle > lyingAngle;
    final isSitting = angle < sittingAngle;

    switch (_phase) {
      case SitupPhase.idle:
        // Wait for lying down position
        if (isLying) {
          _confirmCount++;
          if (_confirmCount >= confirmFrames) {
            _phase = SitupPhase.waitingUp;
            _confirmCount = 0;
          }
        } else {
          _confirmCount = max(0, _confirmCount - 1);
        }
        break;

      case SitupPhase.waitingUp:
        // Wait for sitting up
        if (isSitting) {
          _confirmCount++;
          if (_confirmCount >= confirmFrames) {
            _phase = SitupPhase.waitingDown;
            _confirmCount = 0;
          }
        } else if (isLying) {
          _confirmCount = 0;
        } else {
          _confirmCount = max(0, _confirmCount - 1);
        }
        break;

      case SitupPhase.waitingDown:
        // Wait for lying back down
        if (isLying) {
          _confirmCount++;
          if (_confirmCount >= confirmFrames) {
            // REP COMPLETE!
            _repCount++;
            _cooldown = cooldownFrames;
            _phase = SitupPhase.idle;
            _confirmCount = 0;
            return true;
          }
        } else if (isSitting) {
          _confirmCount = 0;
        } else {
          _confirmCount = max(0, _confirmCount - 1);
        }
        break;
    }

    return false;
  }

  void reset() {
    _phase = SitupPhase.idle;
    _confirmCount = 0;
    _cooldown = 0;
    _repCount = 0;
  }
}
