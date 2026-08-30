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
  String _status = "Tap Start to begin";
  String _phaseLabel = "IDLE";
  int _confirmProgress = 0;

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
        _status = "Camera ready — lie down to start";
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

        if (ls != null && lh != null && lk != null &&
            ls.inFrameLikelihood > 0.5 && lh.inFrameLikelihood > 0.5 && lk.inFrameLikelihood > 0.5) {
          angle = calculateAngle(ls, lh, lk);
        } else if (rs != null && rh != null && rk != null &&
            rs.inFrameLikelihood > 0.5 && rh.inFrameLikelihood > 0.5 && rk.inFrameLikelihood > 0.5) {
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
            setState(() => _status = "LYING — Sit up!");
          } else if (angle < SitupDetector.sittingAngle) {
            setState(() => _status = "SITTING — Lie back down!");
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
      _status = "Session ended — $_repCount reps";
    });
  }

  void _resetSession() {
    _situpDetector.reset();
    setState(() {
      _repCount = 0;
      _currentAngle = 180;
      _status = "Reset — ready to start";
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
        ? Colors.red
        : _currentAngle < SitupDetector.sittingAngle
            ? Colors.green
            : Colors.amber;

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              const Text("Situp Challenge",
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white)),
              const SizedBox(height: 20),

              if (_isCameraInitialized && _cameraController != null)
                Container(
                  height: 300,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: angleColor.withOpacity(0.5), width: 2),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Stack(
                    children: [
                      CameraPreview(_cameraController!),
                      Positioned(
                        top: 10, left: 10,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(20)),
                          child: Text("${_currentAngle.toStringAsFixed(0)}°",
                              style: TextStyle(color: angleColor, fontSize: 20, fontWeight: FontWeight.bold)),
                        ),
                      ),
                      Positioned(
                        top: 10, right: 10,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(20)),
                          child: Text("$_repCount reps",
                              style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                        ),
                      ),
                      Positioned(
                        bottom: 10, left: 0, right: 0,
                        child: Center(
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(20)),
                            child: Text(_status, style: TextStyle(color: angleColor, fontSize: 14, fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

              if (!_isCameraInitialized)
                Container(
                  height: 200,
                  decoration: BoxDecoration(color: const Color(0xFF1A1A2E), borderRadius: BorderRadius.circular(20)),
                  child: const Center(child: Icon(Icons.camera_alt, size: 60, color: Colors.grey)),
                ),

              const SizedBox(height: 20),

              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(color: const Color(0xFF1A1A2E), borderRadius: BorderRadius.circular(20)),
                child: Column(
                  children: [
                    const Text("REPS COMPLETED", style: TextStyle(fontSize: 12, color: Colors.grey, letterSpacing: 2)),
                    const SizedBox(height: 8),
                    Text("$_repCount", style: const TextStyle(fontSize: 72, fontWeight: FontWeight.w900, color: Colors.white)),
                    const SizedBox(height: 8),
                    Text("of 100 daily goal", style: TextStyle(fontSize: 14, color: Colors.grey[400])),
                    const SizedBox(height: 12),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: LinearProgressIndicator(
                        value: (_repCount / 100).clamp(0.0, 1.0),
                        backgroundColor: const Color(0xFF2A2A3E),
                        valueColor: AlwaysStoppedAnimation(_repCount >= 100 ? Colors.green : const Color(0xFF6366F1)),
                        minHeight: 8,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              if (_isCameraInitialized)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: const Color(0xFF1A1A2E), borderRadius: BorderRadius.circular(12)),
                  child: Text(
                    "Phase: $_phaseLabel | Confirm: $_confirmProgress/${SitupDetector.confirmFrames} | Angle: ${_currentAngle.toStringAsFixed(0)}°",
                    style: const TextStyle(fontSize: 11, color: Colors.grey, fontFamily: 'monospace'),
                  ),
                ),

              const SizedBox(height: 16),

              if (!_isCameraInitialized)
                SizedBox(
                  width: double.infinity, height: 60,
                  child: ElevatedButton(
                    onPressed: _startSession,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF6366F1),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    child: const Text("Start AI Counting", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  ),
                ),

              if (_isCameraInitialized)
                Row(
                  children: [
                    Expanded(
                      child: SizedBox(
                        height: 55,
                        child: ElevatedButton(
                          onPressed: _endSession,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF2A2A3E), foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          ),
                          child: const Text("End Session"),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: SizedBox(
                        height: 55,
                        child: ElevatedButton(
                          onPressed: _resetSession,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF2A2A3E), foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          ),
                          child: const Text("Reset"),
                        ),
                      ),
                    ),
                  ],
                ),

              const SizedBox(height: 12),

              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: const Color(0xFF1A1A2E), borderRadius: BorderRadius.circular(12)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text("Phone Placement", style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white)),
                    const SizedBox(height: 8),
                    Text(
                      "• Place phone on floor to your SIDE\n• Back camera facing your body\n• Full body visible from the side\n• Lie down → Sit up → Lie back = 1 rep",
                      style: TextStyle(fontSize: 12, color: Colors.grey[400], height: 1.5),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
