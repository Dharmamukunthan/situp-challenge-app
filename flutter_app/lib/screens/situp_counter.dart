import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:google_mlkit_pose_detection/google_mlkit_pose_detection.dart';
import '../utils/pose_utils.dart';

class SitupCounterScreen extends StatefulWidget {
  const SitupCounterScreen({super.key});

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
  String _status = "Start counting";
  String _phaseLabel = "IDLE";
  int _confirmProgress = 0;

  // Claymorphism colors
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

      final backCamera = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.back,
        orElse: () => cameras.first,
      );

      _cameraController = CameraController(
        backCamera,
        ResolutionPreset.medium,
        enableAudio: false,
      );

      await _cameraController!.initialize();

      await _cameraController!.startImageStream((CameraImage image) {
        if (!_isProcessing) _processFrame(image);
      });

      setState(() {
        _isCameraInitialized = true;
        _status = "Camera ready - lie down to start";
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

        if (ls != null && lh != null && lk != null) {
          angle = calculateAngle(ls, lh, lk);
        } else if (rs != null && rh != null && rk != null) {
          angle = calculateAngle(rs, rh, rk);
        }

        setState(() {
          _currentAngle = angle;
          _phaseLabel = _situpDetector.phase.name.toUpperCase();
          _confirmProgress = _situpDetector.confirmCount;
        });

        if (_situpDetector.processAngle(angle)) {
          setState(() {
            _repCount = _situpDetector.repCount;
            _status = "Rep #$_repCount counted!";
          });
        } else {
          if (angle > SitupDetector.lyingAngle) {
            setState(() => _status = "LYING - Sit up!");
          } else if (angle < SitupDetector.sittingAngle) {
            setState(() => _status = "SITTING - Lie back down!");
          } else {
            setState(() => _status = "Moving...");
          }
        }
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
    setState(() { _repCount = 0; _status = "Starting camera..."; });
    await _startCamera();
  }

  void _endSession() async {
    await _cameraController?.stopImageStream();
    await _cameraController?.dispose();
    _cameraController = null;
    setState(() {
      _isCameraInitialized = false;
      _status = "Session ended - $_repCount reps";
    });
  }

  void _resetSession() {
    _situpDetector.reset();
    setState(() {
      _repCount = 0;
      _currentAngle = 180;
      _status = "Reset - ready to start";
      _phaseLabel = "IDLE";
      _confirmProgress = 0;
    });
  }

  @override
  void dispose() {
    _cameraController?.dispose();
    _poseDetector?.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final angleColor = _currentAngle > SitupDetector.lyingAngle
        ? _accentColor
        : _currentAngle < SitupDetector.sittingAngle
            ? const Color(0xFF4CAF50)
            : _accentColor;

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
                  _buildStatCard("$_repCount", "Reps", Icons.local_fire_department, _accentColor),
                  const SizedBox(width: 10),
                  _buildStatCard(_situpDetector.repCount > 0 ? "${_situpDetector.repCount}" : "0", "Session", Icons.trending_up, const Color(0xFF4CAF50)),
                  const SizedBox(width: 10),
                  _buildStatCard("${(_repCount / 100 * 100).toInt().clamp(0, 100)}%", "Goal", Icons.track_changes, _accentColor),
                ],
              ),

              const SizedBox(height: 16),

              // Camera card
              Container(
                width: double.infinity,
                height: _isCameraInitialized ? 280 : 200,
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
                clipBehavior: Clip.antiAlias,
                child: _isCameraInitialized && _cameraController != null
                    ? Stack(
                        children: [
                          CameraPreview(_cameraController!),
                          Positioned(
                            top: 12, left: 12,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                              decoration: BoxDecoration(
                                color: Colors.white.withAlpha(200),
                                borderRadius: BorderRadius.circular(20),
                                boxShadow: [
                                  BoxShadow(color: Colors.black.withAlpha(15), blurRadius: 10),
                                ],
                              ),
                              child: Text("⚡ $_repCount reps",
                                  style: TextStyle(color: _accentColor, fontSize: 14, fontWeight: FontWeight.bold)),
                            ),
                          ),
                          Positioned(
                            top: 12, right: 12,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                              decoration: BoxDecoration(
                                color: Colors.white.withAlpha(200),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text("${_currentAngle.toStringAsFixed(0)}°",
                                  style: TextStyle(color: _textColor, fontSize: 14, fontWeight: FontWeight.bold)),
                            ),
                          ),
                          Positioned(
                            bottom: 12, left: 0, right: 0,
                            child: Center(
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                decoration: BoxDecoration(
                                  color: Colors.white.withAlpha(200),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(_status,
                                    style: TextStyle(color: angleColor, fontSize: 13, fontWeight: FontWeight.w600)),
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
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: _accentColor.withAlpha(30),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(Icons.emoji_events, size: 40, color: _accentColor),
                    ),
                    const SizedBox(height: 16),
                    Text("$_repCount reps", style: TextStyle(fontSize: 36, fontWeight: FontWeight.w900, color: _textColor)),
                    const SizedBox(height: 4),
                    Text(_status, style: TextStyle(fontSize: 14, color: _subtextColor)),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                      ),
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
                  boxShadow: [
                    BoxShadow(
                      color: _accentColor.withAlpha(20),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    ),
                  ],
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
                        Text("$_repCount/100", style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: _textColor)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: LinearProgressIndicator(
                        value: (_repCount / 100).clamp(0.0, 1.0),
                        backgroundColor: Colors.white,
                        valueColor: AlwaysStoppedAnimation(_repCount >= 100 ? const Color(0xFF4CAF50) : _accentColor),
                        minHeight: 8,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // Start/End buttons
              Row(
                children: [
                  Expanded(
                    child: SizedBox(
                      height: 56,
                      child: ElevatedButton(
                        onPressed: _isCameraInitialized ? _endSession : _startSession,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _accentColor,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                          elevation: 0,
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(_isCameraInitialized ? Icons.stop : Icons.camera_alt, size: 20),
                            const SizedBox(width: 8),
                            Text(_isCameraInitialized ? "End Session" : "Start Session",
                                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  SizedBox(
                    height: 56, width: 56,
                    child: ElevatedButton(
                      onPressed: _resetSession,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: _textColor,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                        elevation: 0,
                      ),
                      child: const Icon(Icons.refresh, size: 22),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 16),

              // Debug info
              if (_isCameraInitialized)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: _cardColor,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Text(
                    "Phase: $_phaseLabel | Confirm: $_confirmProgress/${SitupDetector.confirmFrames} | Angle: ${_currentAngle.toStringAsFixed(0)}°",
                    style: TextStyle(fontSize: 11, color: _subtextColor, fontFamily: 'monospace'),
                  ),
                ),

              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatCard(String value, String label, IconData icon, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: _cardColor,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: color.withAlpha(15),
              blurRadius: 15,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(height: 8),
            Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: _textColor)),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(fontSize: 11, color: _subtextColor)),
          ],
        ),
      ),
    );
  }
}
