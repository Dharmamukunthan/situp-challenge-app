import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:google_mlkit_pose_detection/google_mlkit_pose_detection.dart';
import '../utils/pose_utils.dart';

class SitupCounterScreen extends StatefulWidget {
  final Function(int reps)? onSessionEnd;
  const SitupCounterScreen({super.key, this.onSessionEnd});

  @override
  State<SitupCounterScreen> createState() => _SitupCounterScreenState();
}

class _SitupCounterScreenState extends State<SitupCounterScreen> {
  CameraController? _cameraController;
  PoseDetector? _poseDetector;
  final SitupDetector _situpDetector = SitupDetector();

  bool _isCameraInitialized = false;
  bool _isProcessing = false;
  double _currentAngle = 180;
  int _repCount = 0;
  int _manualReps = 0;
  String _status = "Tap Start to begin";
  String _phaseLabel = "IDLE";
  int _confirmProgress = 0;
  bool _showSkeleton = false;
  int _rawAngleSamples = 0;
  String _debugInfo = "";

  static const Color _bgColor = Color(0xFFFDF5F0);
  static const Color _cardColor = Color(0xFFFFF0E8);
  static const Color _accentColor = Color(0xFFE8734A);
  static const Color _textColor = Color(0xFF3D2C2C);
  static const Color _subtextColor = Color(0xFF9C8A8A);

  @override
  void initState() {
    super.initState();
    _poseDetector = PoseDetector(
      options: PoseDetectorOptions(
        model: PoseDetectionModel.base,
        mode: PoseDetectionMode.stream,
      ),
    );
  }

  Future<void> _startCamera() async {
    try {
      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        setState(() => _status = "No camera found");
        return;
      }

      // Try back camera first, then front
      CameraDescription? selectedCamera;
      try {
        selectedCamera = cameras.firstWhere(
          (c) => c.lensDirection == CameraLensDirection.back,
        );
      } catch (_) {
        selectedCamera = cameras.first;
      }

      _cameraController = CameraController(
        selectedCamera,
        ResolutionPreset.medium,
        enableAudio: false,
      );

      await _cameraController!.initialize();

      // Check if streaming is supported
      if (_cameraController!.value.isStreamingImages) {
        await _cameraController!.stopImageStream();
      }

      await _cameraController!.startImageStream((CameraImage image) {
        if (!_isProcessing) _processFrame(image);
      });

      setState(() {
        _isCameraInitialized = true;
        _status = "Camera ready — position yourself";
      });
    } catch (e) {
      setState(() => _status = "Camera error: $e");
    }
  }

  Future<void> _processFrame(CameraImage image) async {
    if (_isProcessing || _poseDetector == null) return;
    _isProcessing = true;

    try {
      final inputImage = _convertCameraImage(image);
      if (inputImage == null) {
        _isProcessing = false;
        return;
      }

      final poses = await _poseDetector!.processImage(inputImage);

      if (poses.isNotEmpty) {
        final pose = poses.first;
        final ls = pose.landmarks[PoseLandmarkType.leftShoulder];
        final rs = pose.landmarks[PoseLandmarkType.rightShoulder];
        final lh = pose.landmarks[PoseLandmarkType.leftHip];
        final rh = pose.landmarks[PoseLandmarkType.rightHip];
        final lk = pose.landmarks[PoseLandmarkType.leftKnee];
        final rk = pose.landmarks[PoseLandmarkType.rightKnee];

        double angle = 180;
        String side = "none";
        int keypointsFound = 0;

        // Try left side first
        if (ls != null && lh != null && lk != null) {
          angle = calculateAngle(ls, lh, lk);
          side = "LEFT";
          keypointsFound = 3;
        }
        // Try right side
        else if (rs != null && rh != null && rk != null) {
          angle = calculateAngle(rs, rh, rk);
          side = "RIGHT";
          keypointsFound = 3;
        }
        // Try averaging both sides
        else if (ls != null && lh != null && lk != null && rs != null && rh != null && rk != null) {
          double leftAngle = calculateAngle(ls, lh, lk);
          double rightAngle = calculateAngle(rs, rh, rk);
          angle = (leftAngle + rightAngle) / 2;
          side = "BOTH";
          keypointsFound = 6;
        }
        // Try partial detection
        else {
          // Try to get any angle we can
          if (lh != null && lk != null) {
            // Use shoulder midpoint if available
            if (ls != null) {
              angle = calculateAngle(ls, lh, lk);
              side = "LEFT-partial";
              keypointsFound = 3;
            } else if (rs != null) {
              angle = calculateAngle(rs, lh, lk);
              side = "MIXED";
              keypointsFound = 3;
            }
          }
        }

        _rawAngleSamples++;
        final debug = "Keypoints:$keypointsFound Side:$side Angle:${angle.toStringAsFixed(0)}";

        setState(() {
          _currentAngle = angle;
          _phaseLabel = _situpDetector.phase.name.toUpperCase();
          _confirmProgress = _situpDetector.confirmCount;
          _debugInfo = debug;
        });

        if (keypointsFound >= 3) {
          if (_situpDetector.processAngle(angle)) {
            setState(() {
              _repCount = _situpDetector.repCount;
              _status = "✅ Rep #$_repCount counted!";
            });
          } else {
            if (angle > SitupDetector.lyingAngle) {
              setState(() => _status = "↓ LYING — sit up!");
            } else if (angle < SitupDetector.sittingAngle) {
              setState(() => _status = "↑ SITTING — lie back!");
            } else {
              setState(() => _status = "↔ Moving...");
            }
          }
        } else {
          setState(() => _status = "⚠️ Only $keypointsFound keypoints — adjust position");
        }
      } else {
        setState(() {
          _status = "❌ No body detected — move into view";
          _debugInfo = "No pose found";
        });
      }
    } catch (_) {}

    _isProcessing = false;
  }

  InputImage? _convertCameraImage(CameraImage image) {
    final rotation = InputImageRotationValue.fromRawValue(
          _cameraController!.description.sensorOrientation,
        ) ??
        InputImageRotation.rotation0deg;

    final format = InputImageFormatValue.fromRawValue(image.format.raw);
    if (format == null) return null;

    final plane = image.planes.first;
    return InputImage.fromBytes(
      bytes: plane.bytes,
      metadata: InputImageMetadata(
        size: Size(image.width.toDouble(), image.height.toDouble()),
        rotation: rotation,
        format: format,
        bytesPerRow: plane.bytesPerRow,
      ),
    );
  }

  void _startSession() async {
    _situpDetector.reset();
    setState(() {
      _repCount = 0;
      _manualReps = 0;
      _status = "Starting camera...";
    });
    await _startCamera();
  }

  void _endSession() async {
    await _cameraController?.stopImageStream();
    await _cameraController?.dispose();
    _cameraController = null;
    final totalReps = _repCount + _manualReps;
    setState(() {
      _isCameraInitialized = false;
      _status = "Session ended — $totalReps reps";
    });
    if (widget.onSessionEnd != null) {
      widget.onSessionEnd!(totalReps);
    }
  }

  void _resetSession() {
    _situpDetector.reset();
    setState(() {
      _repCount = 0;
      _manualReps = 0;
      _currentAngle = 180;
      _status = "Reset — ready";
      _phaseLabel = "IDLE";
      _confirmProgress = 0;
      _rawAngleSamples = 0;
      _debugInfo = "";
    });
  }

  void _addManualRep() {
    setState(() {
      _manualReps++;
      _status = "Manual +1 (total: ${_repCount + _manualReps})";
    });
  }

  void _undoRep() {
    if (_manualReps > 0) {
      setState(() {
        _manualReps--;
        _status = "Undid last rep (total: ${_repCount + _manualReps})";
      });
    }
  }

  @override
  void dispose() {
    _cameraController?.dispose();
    _poseDetector?.close();
    super.dispose();
  }

  int get _totalReps => _repCount + _manualReps;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bgColor,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              // Stats row
              Row(
                children: [
                  _buildStatCard("$_totalReps", "Total", Icons.local_fire_department, _accentColor),
                  const SizedBox(width: 10),
                  _buildStatCard("$_repCount", "AI", Icons.smart_toy, const Color(0xFF4CAF50)),
                  const SizedBox(width: 10),
                  _buildStatCard("$_manualReps", "Manual", Icons.touch_app, const Color(0xFF2196F3)),
                ],
              ),

              const SizedBox(height: 16),

              // Camera / placeholder
              Container(
                width: double.infinity,
                height: _isCameraInitialized ? 280 : 180,
                decoration: BoxDecoration(
                  color: _cardColor,
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [
                    BoxShadow(color: _accentColor.withAlpha(20), blurRadius: 20, offset: const Offset(0, 8)),
                  ],
                ),
                clipBehavior: Clip.antiAlias,
                child: _isCameraInitialized && _cameraController != null
                    ? Stack(
                        children: [
                          CameraPreview(_cameraController!),
                          // Angle badge
                          Positioned(
                            top: 12, left: 12,
                            child: _buildBadge("${_currentAngle.toStringAsFixed(0)}°", _getAngleColor()),
                          ),
                          // Reps badge
                          Positioned(
                            top: 12, right: 12,
                            child: _buildBadge("⚡ $_totalReps", _accentColor),
                          ),
                          // Status
                          Positioned(
                            bottom: 12, left: 12, right: 12,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                              decoration: BoxDecoration(
                                color: Colors.white.withAlpha(220),
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: Text(_status,
                                  textAlign: TextAlign.center,
                                  style: TextStyle(color: _textColor, fontSize: 13, fontWeight: FontWeight.w600)),
                            ),
                          ),
                          // +1 button floating
                          Positioned(
                            bottom: 60, right: 16,
                            child: GestureDetector(
                              onTap: _addManualRep,
                              child: Container(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: _accentColor,
                                  shape: BoxShape.circle,
                                  boxShadow: [
                                    BoxShadow(color: _accentColor.withAlpha(80), blurRadius: 12, offset: const Offset(0, 4)),
                                  ],
                                ),
                                child: const Icon(Icons.add, color: Colors.white, size: 28),
                              ),
                            ),
                          ),
                        ],
                      )
                    : Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.videocam_off, size: 48, color: _subtextColor),
                          const SizedBox(height: 12),
                          Text("Camera is off", style: TextStyle(color: _subtextColor, fontSize: 16)),
                        ],
                      ),
              ),

              const SizedBox(height: 16),

              // Rep counter card
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
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(color: _accentColor.withAlpha(30), shape: BoxShape.circle),
                      child: Icon(Icons.emoji_events, size: 40, color: _accentColor),
                    ),
                    const SizedBox(height: 16),
                    Text("$_totalReps reps",
                        style: TextStyle(fontSize: 48, fontWeight: FontWeight.w900, color: _textColor)),
                    const SizedBox(height: 4),
                    Text(_status, style: TextStyle(fontSize: 14, color: _subtextColor)),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
                      child: Text("Goal: 100", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _subtextColor)),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // Daily goal progress
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: _cardColor,
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [BoxShadow(color: _accentColor.withAlpha(20), blurRadius: 20, offset: const Offset(0, 8))],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.emoji_events, size: 20, color: _accentColor),
                            const SizedBox(width: 8),
                            Text("Daily Goal", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: _textColor)),
                          ],
                        ),
                        Text("$_totalReps/100", style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: _textColor)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: LinearProgressIndicator(
                        value: (_totalReps / 100).clamp(0.0, 1.0),
                        backgroundColor: Colors.white,
                        valueColor: AlwaysStoppedAnimation(_totalReps >= 100 ? const Color(0xFF4CAF50) : _accentColor),
                        minHeight: 8,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // Manual +1 button (big, always visible)
              if (_isCameraInitialized)
                SizedBox(
                  width: double.infinity, height: 60,
                  child: ElevatedButton(
                    onPressed: _addManualRep,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _accentColor,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                      elevation: 0,
                    ),
                    child: const Text("+1 Rep", style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  ),
                ),

              if (_isCameraInitialized) const SizedBox(height: 12),

              // Action buttons
              Row(
                children: [
                  if (_isCameraInitialized)
                    Expanded(
                      child: SizedBox(
                        height: 52,
                        child: ElevatedButton(
                          onPressed: _undoRep,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white,
                            foregroundColor: _textColor,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                            elevation: 0,
                          ),
                          child: const Text("Undo"),
                        ),
                      ),
                    ),
                  if (_isCameraInitialized) const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: SizedBox(
                      height: 52,
                      child: ElevatedButton(
                        onPressed: _isCameraInitialized ? _endSession : _startSession,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _isCameraInitialized ? const Color(0xFFE8534A) : _accentColor,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          elevation: 0,
                        ),
                        child: Text(_isCameraInitialized ? "End Session" : "Start AI Counting",
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      ),
                    ),
                  ),
                  if (_isCameraInitialized) const SizedBox(width: 10),
                  if (_isCameraInitialized)
                    Expanded(
                      child: SizedBox(
                        height: 52,
                        child: ElevatedButton(
                          onPressed: _resetSession,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white,
                            foregroundColor: _textColor,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                            elevation: 0,
                          ),
                          child: const Text("Reset"),
                        ),
                      ),
                    ),
                ],
              ),

              const SizedBox(height: 16),

              // Debug info (shown when camera is on)
              if (_isCameraInitialized)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: _cardColor,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text("Debug: $_debugInfo",
                          style: TextStyle(fontSize: 11, color: _subtextColor, fontFamily: 'monospace')),
                      Text("Phase: $_phaseLabel | Confirm: $_confirmProgress/${SitupDetector.confirmFrames}",
                          style: TextStyle(fontSize: 11, color: _subtextColor, fontFamily: 'monospace')),
                      Text("Frames analyzed: $_rawAngleSamples",
                          style: TextStyle(fontSize: 11, color: _subtextColor, fontFamily: 'monospace')),
                    ],
                  ),
                ),

              if (_isCameraInitialized) const SizedBox(height: 16),

              // Phone placement guide
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: _cardColor,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.info_outline, size: 18, color: _accentColor),
                        const SizedBox(width: 8),
                        Text("Phone Placement", style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: _textColor)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      "1. Place phone on floor or prop it up on its SIDE\n"
                      "2. Back camera should see your full body from the side\n"
                      "3. Make sure your whole body is in the frame\n"
                      "4. Lie down → sit up → lie back = 1 rep\n"
                      "5. If AI doesn't count, use the +1 button",
                      style: TextStyle(fontSize: 12, color: _subtextColor, height: 1.6),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
  }

  Color _getAngleColor() {
    if (_currentAngle > SitupDetector.lyingAngle) return const Color(0xFFE8534A);
    if (_currentAngle < SitupDetector.sittingAngle) return const Color(0xFF4CAF50);
    return const Color(0xFFFFC107);
  }

  Widget _buildBadge(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(220),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: Colors.black.withAlpha(15), blurRadius: 8)],
      ),
      child: Text(text, style: TextStyle(color: color, fontSize: 14, fontWeight: FontWeight.bold)),
    );
  }

  Widget _buildStatCard(String value, String label, IconData icon, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: _cardColor,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [BoxShadow(color: color.withAlpha(15), blurRadius: 15, offset: const Offset(0, 6))],
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 18),
            const SizedBox(height: 6),
            Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: _textColor)),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(fontSize: 11, color: _subtextColor)),
          ],
        ),
      ),
    );
  }
}
