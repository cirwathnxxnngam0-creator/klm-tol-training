import React, { useState, useEffect, useRef } from 'react';
import { loadCustomExercises } from '../data/exercises';

const JOINT_NAMES = [
  'Left Shoulder (Humerus/Torso)',
  'Right Shoulder (Humerus/Torso)',
  'Left Elbow (Radius/Humerus)',
  'Right Elbow (Radius/Humerus)',
  'Left Hip',
  'Right Hip',
  'Left Knee',
  'Right Knee'
];

export default function ExerciseCreatorModal({ onClose, onSaveComplete }) {
  const [step, setStep] = useState(1);
  const [exerciseName, setExerciseName] = useState('');
  const [category, setCategory] = useState('Custom Exercise');
  const [selectedMuscles, setSelectedMuscles] = useState([]);
  const [muscleSearch, setMuscleSearch] = useState('');
  
  // Camera & Tracking states
  const cameraActive = step === 3 || step === 4;
  const mpActive = cameraActive || step === 7;
  const tfActive = cameraActive || step === 5;
  const [mpStatus, setMpStatus] = useState('idle');
  const [tfStatus, setTfStatus] = useState('idle');
  
  // Creation method: 'live' (Webcam) or 'video' (Upload Video)
  const [creationMethod, setCreationMethod] = useState(null);

  // Video processing states
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [videoProcessProgress, setVideoProcessProgress] = useState(0);
  const [videoProcessLog, setVideoProcessLog] = useState('');

  // All video scanned frames and currently configured start/peak frame indexes
  const [allScannedFrames, setAllScannedFrames] = useState([]);
  const [startFrameIndex, setStartFrameIndex] = useState(0);
  const [peakFrameIndex, setPeakFrameIndex] = useState(0);
  // Parallel array of thumbnails for preview underlay
  const [allScannedThumbnails, setAllScannedThumbnails] = useState([]);
  const [selectedJoints, setSelectedJoints] = useState([true, true, true, true, true, true, true, true]);
  // Collected datasets
  const [startFrames, setStartFrames] = useState([]);
  const [peakFrames, setPeakFrames] = useState([]);
  const [recordingMode, setRecordingMode] = useState(null); // 'start' | 'peak' | null
  const [recordedCount, setRecordedCount] = useState(0);

  // Training states
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [lossValue, setLossValue] = useState(null);

  // Video and Canvas refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const startCanvasRef = useRef(null);
  const peakCanvasRef = useRef(null);
  const poseInstanceRef = useRef(null);
  const requestRef = useRef(null);
  const currentJointsRef = useRef(null);
  const currentJointsRawRef = useRef(null);

  const MUSCLE_OPTIONS = [
    'Sternocleidomastoid (Neck)',
    'Biceps Brachii',
    'Triceps Brachii',
    'Brachialis',
    'Brachioradialis (Forearms)',
    'Anterior Deltoid',
    'Lateral Deltoid',
    'Posterior Deltoid',
    'Pectoralis Major (Chest)',
    'Latissimus Dorsi (Lats)',
    'Trapezius (Traps)',
    'Rhomboids',
    'Erector Spinae (Lower Back)',
    'Rectus Abdominis (Abs)',
    'Obliques',
    'Gluteus Maximus',
    'Gluteus Medius',
    'Biceps Femoris (Hamstrings)',
    'Semitendinosus (Hamstrings)',
    'Semimembranosus (Hamstrings)',
    'Rectus Femoris (Quads)',
    'Vastus Lateralis (Quads)',
    'Vastus Medialis (Quads)',
    'Gastrocnemius (Calves)',
    'Soleus (Calves)',
    'Iliopsoas (Hip Flexors)'
  ];

  // Load MediaPipe Pose (check window first to prevent double-loader issues)
  useEffect(() => {
    if (mpActive) {
      if (window.Pose && !poseInstanceRef.current) {
        try {
          const pose = new window.Pose({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
          });
          pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
          });
          pose.onResults(onPoseResults);
          poseInstanceRef.current = pose;
          setMpStatus('loaded');
        } catch (e) {
          console.error('Error starting cached MediaPipe Pose:', e);
          setMpStatus('error');
        }
        return;
      }

      if (mpStatus === 'idle') {
        setMpStatus('loading');
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js';
        script.async = true;
        script.onload = () => {
          if (window.Pose) {
            try {
              const pose = new window.Pose({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
              });
              pose.setOptions({
                modelComplexity: 1,
                smoothLandmarks: true,
                enableSegmentation: false,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
              });
              pose.onResults(onPoseResults);
              poseInstanceRef.current = pose;
              setMpStatus('loaded');
            } catch (e) {
              console.error('Error starting MediaPipe Pose:', e);
              setMpStatus('error');
            }
          } else {
            setMpStatus('error');
          }
        };
        script.onerror = () => setMpStatus('error');
        document.body.appendChild(script);
      }
    }
  }, [mpActive, mpStatus]);

  // Load TensorFlow.js (check window first to prevent double-loader issues)
  useEffect(() => {
    if (tfActive) {
      if (window.tf) {
        setTfStatus('loaded');
        return;
      }
      if (tfStatus === 'idle') {
        setTfStatus('loading');
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.20.0/dist/tf.min.js';
        script.async = true;
        script.onload = () => {
          if (window.tf) {
            setTfStatus('loaded');
          } else {
            setTfStatus('error');
          }
        };
        script.onerror = () => setTfStatus('error');
        document.body.appendChild(script);
      }
    }
  }, [tfActive, tfStatus]);

  // Initialize default active joints based on Category
  useEffect(() => {
    if (step === 2 || step === 5 || step === 6) {
      const isUpper = category.includes('Arms') || category.includes('Shoulders') || category.includes('Chest') || category.includes('Back');
      const isLower = category.includes('Legs');
      if (isUpper) {
        setSelectedJoints([true, true, true, true, false, false, false, false]);
      } else if (isLower) {
        setSelectedJoints([false, false, false, false, true, true, true, true]);
      } else {
        setSelectedJoints([true, true, true, true, true, true, true, true]);
      }
    }
  }, [category, step]);

  // Draw skeleton previews on Step 6 (Save screen)
  useEffect(() => {
    if (step === 6) {
      const drawPreview = (canvas, frame, thumbnail, color) => {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        const drawSkeleton = () => {
          if (!frame) return;
          const joints = reconstructJoints(frame);
          const connections = [
            [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
            [11, 23], [12, 24], [23, 24],
            [23, 25], [24, 26], [25, 27], [26, 28]
          ];

          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          
          connections.forEach(([i, j]) => {
            const p1 = joints[i];
            const p2 = joints[j];
            if (p1 && p2 && p1.visibility > 0.1 && p2.visibility > 0.1) {
              ctx.beginPath();
              ctx.moveTo(p1.x * w, p1.y * h);
              ctx.lineTo(p2.x * w, p2.y * h);
              ctx.stroke();
            }
          });

          Object.keys(joints).forEach((idxStr) => {
            const idx = parseInt(idxStr);
            const pt = joints[idx];
            if (pt && pt.visibility > 0.1) {
              let jointIdx = -1;
              if (idx === 11) jointIdx = 0;
              else if (idx === 12) jointIdx = 1;
              else if (idx === 13) jointIdx = 2;
              else if (idx === 14) jointIdx = 3;
              else if (idx === 23) jointIdx = 4;
              else if (idx === 24) jointIdx = 5;
              else if (idx === 25) jointIdx = 6;
              else if (idx === 26) jointIdx = 7;

              if (jointIdx !== -1) {
                const isActive = selectedJoints[jointIdx];
                ctx.fillStyle = isActive ? color : 'rgba(128,128,128,0.5)';
                ctx.beginPath();
                ctx.arc(pt.x * w, pt.y * h, isActive ? 5 : 3, 0, 2 * Math.PI);
                ctx.fill();
              } else {
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(pt.x * w, pt.y * h, 3, 0, 2 * Math.PI);
                ctx.fill();
              }
            }
          });
        };

        if (thumbnail) {
          const img = new Image();
          img.src = thumbnail;
          img.onload = () => {
            ctx.drawImage(img, 0, 0, w, h);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.fillRect(0, 0, w, h);
            drawSkeleton();
          };
        } else {
          ctx.fillStyle = 'hsl(240, 16%, 6%)';
          ctx.fillRect(0, 0, w, h);
          drawSkeleton();
        }
      };

      if (creationMethod === 'video' && allScannedFrames.length > 0) {
        drawPreview(startCanvasRef.current, allScannedFrames[startFrameIndex], allScannedThumbnails[startFrameIndex], 'var(--primary)');
        drawPreview(peakCanvasRef.current, allScannedFrames[peakFrameIndex], allScannedThumbnails[peakFrameIndex], 'var(--secondary)');
      } else {
        if (startFrames.length > 0) {
          drawPreview(startCanvasRef.current, startFrames[0], null, 'var(--primary)');
        }
        if (peakFrames.length > 0) {
          drawPreview(peakCanvasRef.current, peakFrames[0], null, 'var(--secondary)');
        }
      }
    }
  }, [step, startFrameIndex, peakFrameIndex, startFrames, peakFrames, allScannedFrames, allScannedThumbnails, selectedJoints, creationMethod]);

  // Start video feed webcam
  useEffect(() => {
    let stream = null;
    async function startWebcam() {
      if (cameraActive) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: 'user' },
            audio: false
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
        } catch (err) {
          console.error("Webcam access error:", err);
        }
      }
    }
    startWebcam();
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [cameraActive]);

  // Video processing, canvas rendering, and MediaPipe send loop
  useEffect(() => {
    let active = true;

    const renderLoop = async () => {
      if (!active) return;

      if (videoRef.current && videoRef.current.readyState >= 2) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          
          // Clear canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Draw raw camera feed mirrored instantly at 30fps
          ctx.save();
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          ctx.restore();

          // Draw skeleton overlay on top if body coordinates are detected
          if (currentJointsRawRef.current) {
            ctx.strokeStyle = 'hsl(142, 85%, 62%)';
            ctx.lineWidth = 3;
            
            const connections = [
              [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], // Upper body
              [11, 23], [12, 24], [23, 24], // Torso
              [23, 25], [24, 26], [25, 27], [26, 28] // Lower body
            ];

            connections.forEach(([i, j]) => {
              const p1 = currentJointsRawRef.current[i];
              const p2 = currentJointsRawRef.current[j];
              if (p1 && p2 && p1.visibility > 0.5 && p2.visibility > 0.5) {
                ctx.beginPath();
                ctx.moveTo(canvas.width - p1.x * canvas.width, p1.y * canvas.height);
                ctx.lineTo(canvas.width - p2.x * canvas.width, p2.y * canvas.height);
                ctx.stroke();
              }
            });

            currentJointsRawRef.current.forEach((lm) => {
              if (lm.visibility > 0.5) {
                ctx.fillStyle = 'var(--text-primary)';
                ctx.beginPath();
                ctx.arc(canvas.width - lm.x * canvas.width, lm.y * canvas.height, 4, 0, 2 * Math.PI);
                ctx.fill();
              }
            });
          }
        }

        // Process MediaPipe landmarks detection in the background
        if (poseInstanceRef.current && mpStatus === 'loaded') {
          try {
            await poseInstanceRef.current.send({ image: video });
          } catch (err) {
            console.error("Frame processing error:", err);
          }
        }
      }

      if (cameraActive) {
        requestRef.current = requestAnimationFrame(renderLoop);
      }
    };

    if (cameraActive) {
      requestRef.current = requestAnimationFrame(renderLoop);
    }

    return () => {
      active = false;
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [cameraActive, mpStatus]);

  const cocoMapping = [0, 2, 5, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
  
  const extractFeatures = (landmarks) => {
    const features = [];
    for (let i = 0; i < cocoMapping.length; i++) {
      const idx = cocoMapping[i];
      const j = landmarks[idx];
      // Filter by confidence visibility > 0.5 to keep symmetry
      if (j && (j.visibility === undefined || j.visibility >= 0.5)) {
        features.push(Math.round(j.x * 640));
        features.push(Math.round(j.y * 480));
      } else {
        features.push(0);
        features.push(0);
      }
    }
    return features;
  };

  const calculateAngle = (p1, p2, p3) => {
    if (!p1 || !p2 || !p3) return 180;
    const radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) angle = 360.0 - angle;
    return angle;
  };

  const reconstructJoints = (features) => {
    const joints = {};
    const cocoMappingLocal = [0, 2, 5, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
    for (let i = 0; i < cocoMappingLocal.length; i++) {
      const idx = cocoMappingLocal[i];
      const x = features[i * 2];
      const y = features[i * 2 + 1];
      joints[idx] = {
        x: x / 640.0,
        y: y / 480.0,
        visibility: (x === 0 && y === 0) ? 0.0 : 1.0
      };
    }
    return joints;
  };

  const extractAngles = (joints) => {
    const getPoint = (idx) => {
      const pt = joints[idx];
      if (!pt || (pt.visibility !== undefined && pt.visibility < 0.5)) return null;
      return pt;
    };
    const leftShoulder = getPoint(11);
    const rightShoulder = getPoint(12);
    const leftElbow = getPoint(13);
    const rightElbow = getPoint(14);
    const leftWrist = getPoint(15);
    const rightWrist = getPoint(16);
    const leftHip = getPoint(23);
    const rightHip = getPoint(24);
    const leftKnee = getPoint(25);
    const rightKnee = getPoint(26);
    const leftAnkle = getPoint(27);
    const rightAnkle = getPoint(28);

    const effLeftHip = leftHip || (leftShoulder ? { x: leftShoulder.x, y: leftShoulder.y + 0.1, visibility: 1.0 } : null);
    const effRightHip = rightHip || (rightShoulder ? { x: rightShoulder.x, y: rightShoulder.y + 0.1, visibility: 1.0 } : null);

    return [
      calculateAngle(effLeftHip, leftShoulder, leftElbow) / 180.0,
      calculateAngle(effRightHip, rightShoulder, rightElbow) / 180.0,
      calculateAngle(leftShoulder, leftElbow, leftWrist) / 180.0,
      calculateAngle(rightShoulder, rightElbow, rightWrist) / 180.0,
      calculateAngle(leftShoulder, leftHip, leftKnee) / 180.0,
      calculateAngle(rightShoulder, rightHip, rightKnee) / 180.0,
      calculateAngle(leftHip, leftKnee, leftAnkle) / 180.0,
      calculateAngle(rightHip, rightKnee, rightAnkle) / 180.0
    ];
  };

  const runKMeans2 = (featuresList) => {
    if (featuresList.length < 2) return { cluster0Indices: [], cluster1Indices: [] };

    let centroidA = [...featuresList[0]];
    let maxDist = -1;
    let centroidB = [...featuresList[0]];
    featuresList.forEach(f => {
      let dist = 0;
      for (let i = 0; i < 8; i++) dist += Math.pow(f[i] - centroidA[i], 2);
      if (dist > maxDist) {
        maxDist = dist;
        centroidB = [...f];
      }
    });

    let assignments = new Array(featuresList.length).fill(0);
    const iterations = 15;
    
    for (let iter = 0; iter < iterations; iter++) {
      featuresList.forEach((f, idx) => {
        let distA = 0;
        let distB = 0;
        for (let i = 0; i < 8; i++) {
          distA += Math.pow(f[i] - centroidA[i], 2);
          distB += Math.pow(f[i] - centroidB[i], 2);
        }
        assignments[idx] = distA < distB ? 0 : 1;
      });

      const sumA = new Array(8).fill(0);
      let countA = 0;
      const sumB = new Array(8).fill(0);
      let countB = 0;

      featuresList.forEach((f, idx) => {
        if (assignments[idx] === 0) {
          for (let i = 0; i < 8; i++) sumA[i] += f[i];
          countA++;
        } else {
          for (let i = 0; i < 8; i++) sumB[i] += f[i];
          countB++;
        }
      });

      if (countA > 0) centroidA = sumA.map(v => v / countA);
      if (countB > 0) centroidB = sumB.map(v => v / countB);
    }

    const cluster0Indices = [];
    const cluster1Indices = [];
    assignments.forEach((assign, idx) => {
      if (assign === 0) cluster0Indices.push(idx);
      else cluster1Indices.push(idx);
    });

    return { cluster0Indices, cluster1Indices, centroidA, centroidB };
  };

  const processVideoFile = async (file) => {
    if (!window.Pose) {
      alert("MediaPipe Pose library is not loaded. Please wait.");
      return;
    }
    
    setIsProcessingVideo(true);
    setVideoProcessProgress(0);
    setVideoProcessLog("Initializing video extraction...");

    try {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.playsInline = true;
      video.muted = true;
      
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Failed to load video file."));
      });

      const duration = video.duration;
      const stepSize = 0.4;
      const frames = [];
      const thumbnails = [];

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 640;
      tempCanvas.height = 480;
      const ctx = tempCanvas.getContext('2d');

      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 160;
      thumbCanvas.height = 120;
      const thumbCtx = thumbCanvas.getContext('2d');

      const scannerPose = new window.Pose({
        locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}`
      });
      scannerPose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      let currentScannedFrame = null;
      scannerPose.onResults((results) => {
        if (results.poseLandmarks) {
          currentScannedFrame = extractFeatures(results.poseLandmarks);
        } else {
          currentScannedFrame = null;
        }
      });

      let currentTime = 0;
      while (currentTime < duration) {
        video.currentTime = currentTime;
        
        await new Promise((resolve) => {
          video.onseeked = () => resolve();
        });

        ctx.drawImage(video, 0, 0, 640, 480);
        
        currentScannedFrame = null;
        await scannerPose.send({ image: tempCanvas });
        
        if (currentScannedFrame) {
          frames.push(currentScannedFrame);
          thumbCtx.drawImage(tempCanvas, 0, 0, 160, 120);
          thumbnails.push(thumbCanvas.toDataURL('image/jpeg', 0.5));
        }

        currentTime += stepSize;
        const percent = Math.round((currentTime / duration) * 100);
        setVideoProcessProgress(Math.min(percent, 99));
        setVideoProcessLog(`Scanning video: ${percent}% (detected ${frames.length} skeletal structures)`);
      }

      scannerPose.close();
      URL.revokeObjectURL(video.src);

      if (frames.length < 6) {
        throw new Error("Could not detect enough clear skeletal frames in the video. Please verify body visibility and lighting.");
      }

      setVideoProcessLog("Executing 2-Means clustering to distinguish start and peak poses...");

      const angleVectors = frames.map(f => extractAngles(reconstructJoints(f)));
      const { cluster0Indices, cluster1Indices, centroidA, centroidB } = runKMeans2(angleVectors);

      if (cluster0Indices.length === 0 || cluster1Indices.length === 0) {
        throw new Error("Clustering failed to split the movements. Make sure the video contains full repetitions.");
      }

      const sumAnglesA = centroidA[2] + centroidA[3] + centroidA[6] + centroidA[7];
      const sumAnglesB = centroidB[2] + centroidB[3] + centroidB[6] + centroidB[7];
      
      const is0Start = sumAnglesA > sumAnglesB;
      const startIndices = is0Start ? cluster0Indices : cluster1Indices;
      const peakIndices = is0Start ? cluster1Indices : cluster0Indices;
      const startCentroid = is0Start ? centroidA : centroidB;
      const peakCentroid = is0Start ? centroidB : centroidA;

      // Find the frame index in startIndices that is closest to startCentroid
      let bestStartIdx = startIndices[0];
      let minStartDist = Infinity;
      startIndices.forEach(idx => {
        let dist = 0;
        for (let i = 0; i < 8; i++) dist += Math.pow(angleVectors[idx][i] - startCentroid[i], 2);
        if (dist < minStartDist) {
          minStartDist = dist;
          bestStartIdx = idx;
        }
      });

      // Find the frame index in peakIndices that is closest to peakCentroid
      let bestPeakIdx = peakIndices[0];
      let minPeakDist = Infinity;
      peakIndices.forEach(idx => {
        let dist = 0;
        for (let i = 0; i < 8; i++) dist += Math.pow(angleVectors[idx][i] - peakCentroid[i], 2);
        if (dist < minPeakDist) {
          minPeakDist = dist;
          bestPeakIdx = idx;
        }
      });

      setAllScannedFrames(frames);
      setAllScannedThumbnails(thumbnails);
      setStartFrameIndex(bestStartIdx);
      setPeakFrameIndex(bestPeakIdx);
      
      // Initialize startFrames and peakFrames so it passes step 5 train validation
      setStartFrames([frames[bestStartIdx]]);
      setPeakFrames([frames[bestPeakIdx]]);
      
      setVideoProcessProgress(100);
      setVideoProcessLog(`Auto-extracted best start pose (frame ${bestStartIdx}) and peak pose (frame ${bestPeakIdx})!`);
      setIsProcessingVideo(false);

      setTimeout(() => {
        setStep(5);
      }, 1000);
    } catch (err) {
      console.error(err);
      setVideoProcessLog(`Error: ${err.message}`);
      setIsProcessingVideo(false);
      alert(err.message);
    }
  };

  // Callback when pose landmarks are returned (simply updates coordinates references)
  const onPoseResults = (results) => {
    if (results.poseLandmarks) {
      currentJointsRawRef.current = results.poseLandmarks;
      currentJointsRef.current = extractFeatures(results.poseLandmarks);
    } else {
      currentJointsRawRef.current = null;
      currentJointsRef.current = null;
    }
  };

  // Record loop
  useEffect(() => {
    let interval = null;
    if (recordingMode && recordedCount < 30) {
      interval = setInterval(() => {
        if (currentJointsRef.current) {
          const currentData = currentJointsRef.current;
          if (recordingMode === 'start') {
            setStartFrames(prev => {
              const next = [...prev, currentData];
              setRecordedCount(next.length);
              if (next.length >= 30) {
                setRecordingMode(null);
                clearInterval(interval);
                // Auto transition to peak position page (Step 4)
                setTimeout(() => {
                  setStep(4);
                  setRecordedCount(0);
                }, 800);
              }
              return next;
            });
          } else {
            setPeakFrames(prev => {
              const next = [...prev, currentData];
              setRecordedCount(next.length);
              if (next.length >= 30) {
                setRecordingMode(null);
                clearInterval(interval);
                // Auto transition to training page (Step 5)
                setTimeout(() => {
                  setStep(5);
                  setRecordedCount(0);
                }, 800);
              }
              return next;
            });
          }
        }
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [recordingMode, recordedCount]);

  const startRecording = (mode) => {
    setRecordingMode(mode);
    setRecordedCount(0);
    if (mode === 'start') setStartFrames([]);
    else setPeakFrames([]);
  };

  // Train TF.js model in the browser
  const trainModel = async () => {
    if (!window.tf || startFrames.length === 0 || peakFrames.length === 0) return;
    setIsTraining(true);
    setTrainingProgress(0);

    try {
      const timestamp = Date.now();
      const model = window.tf.sequential();
      model.add(window.tf.layers.dense({ name: `dense_input_${timestamp}`, units: 16, inputShape: [34], activation: 'relu' }));
      model.add(window.tf.layers.dense({ name: `dense_hidden_${timestamp}`, units: 8, activation: 'relu' }));
      model.add(window.tf.layers.dense({ name: `dense_output_${timestamp}`, units: 2, activation: 'softmax' }));
      model.compile({
        optimizer: window.tf.train.adam(0.01),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });

      const inputs = [...startFrames, ...peakFrames].map(frame => 
        frame.map((val, idx) => idx % 2 === 0 ? val / 640 : val / 480)
      );
      const labels = [
        ...startFrames.map(() => [1, 0]),
        ...peakFrames.map(() => [0, 1])
      ];

      const xs = window.tf.tensor2d(inputs, [inputs.length, 34]);
      const ys = window.tf.tensor2d(labels, [labels.length, 2]);

      const epochs = 50;
      await model.fit(xs, ys, {
        epochs: epochs,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            setTrainingProgress(Math.round(((epoch + 1) / epochs) * 100));
            setLossValue(logs.loss.toFixed(4));
          }
        }
      });

      xs.dispose();
      ys.dispose();
      model.dispose();

      setIsTraining(false);
      // Auto transition to final step
      setStep(6);
    } catch (e) {
      console.error(e);
      setIsTraining(false);
      alert('Training failed! Make sure your browser supports TF.js WebGL.');
    }
  };

  const handleSave = () => {
    const customEx = {
      id: `custom-${Date.now()}`,
      name: exerciseName || 'Custom Exercise',
      category: category,
      targetMuscle: selectedMuscles.join(', ') || 'General Muscles',
      description: `User-defined custom AI posture model trained on ${new Date().toLocaleDateString()}`,
      difficulty: 'Custom',
      defaultSets: 3,
      defaultReps: 12,
      defaultWeightKg: 10,
      isCustom: true,
      selectedJoints: selectedJoints,
      startFrames: creationMethod === 'video' ? [allScannedFrames[startFrameIndex]] : startFrames,
      peakFrames: creationMethod === 'video' ? [allScannedFrames[peakFrameIndex]] : peakFrames,
      instructions: [
        'Stand in the exact starting position you recorded to reset the pose state.',
        'Perform the motion to reach the recorded peak position and trigger the rep count.'
      ],
      tips: [
        'Move slowly and hold the peak position briefly for optimal detection.',
        'Keep standard distances to the camera relative to your training session.'
      ]
    };

    try {
      const stored = JSON.parse(localStorage.getItem('klm_custom_exercises') || '[]');
      stored.push(customEx);
      localStorage.setItem('klm_custom_exercises', JSON.stringify(stored));
      
      loadCustomExercises();
      if (onSaveComplete) onSaveComplete();
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(5, 5, 5, 0.95)',
      backdropFilter: 'blur(10px)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      color: 'var(--text-primary)'
    }}>
      <div className="glass-card" style={{
        width: '100%',
        maxWidth: '460px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-lg)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '900', fontFamily: 'Outfit, sans-serif', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)' }}>
              <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
            </svg>
            Create Exercise ({
              creationMethod === 'video' 
                ? (step === 7 ? '3/4' : step === 5 ? '3/4' : step === 6 ? '4/4' : `${step}/4`)
                : (step === 1 ? '1/5' : step === 2 ? '2/5' : step === 3 ? '3/5' : step === 4 ? '4/5' : step === 5 ? '4/5' : '5/5')
            })
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Wizard Step Body */}
        <div style={{ flexGrow: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          
          {/* STEP 1: Details */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flexGrow: 1 }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '800', fontFamily: 'Outfit, sans-serif', margin: '0 0 0.5rem' }}>Exercise Info</h3>
              
              <div className="input-group">
                <label className="input-label">Exercise Name</label>
                <input
                  type="text"
                  value={exerciseName}
                  onChange={(e) => setExerciseName(e.target.value)}
                  placeholder="e.g. Lateral Raise, Bicep Curl"
                  className="input-field"
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field">
                  <option value="Arms / Pull">Arms / Pull</option>
                  <option value="Shoulders / Push">Shoulders / Push</option>
                  <option value="Legs / Lower Body">Legs / Lower Body</option>
                  <option value="Chest / Push">Chest / Push</option>
                  <option value="Back / Pull">Back / Pull</option>
                  <option value="Core / Abs">Core / Abs</option>
                </select>
              </div>

              <div className="input-group">
                <label className="input-label" style={{ marginBottom: '0.4rem' }}>Target Muscles</label>
                
                {selectedMuscles.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.65rem' }}>
                    {selectedMuscles.map(muscle => (
                      <span key={muscle} style={{
                        fontSize: '0.65rem',
                        fontWeight: '700',
                        padding: '0.15rem 0.4rem 0.15rem 0.5rem',
                        borderRadius: 'var(--radius-full)',
                        background: 'hsla(var(--h-primary), 85%, 62%, 0.12)',
                        color: 'var(--primary)',
                        border: '1px solid hsla(var(--h-primary), 85%, 62%, 0.25)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {muscle}
                        <button
                          type="button"
                          onClick={() => setSelectedMuscles(prev => prev.filter(m => m !== muscle))}
                          style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
                        >✕</button>
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={muscleSearch}
                    onChange={(e) => setMuscleSearch(e.target.value)}
                    placeholder="Search muscle (e.g. Gluteus, Biceps)..."
                    className="input-field"
                    style={{ margin: 0 }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && muscleSearch.trim()) {
                        e.preventDefault();
                        const query = muscleSearch.trim();
                        if (!selectedMuscles.includes(query)) {
                          setSelectedMuscles(prev => [...prev, query]);
                        }
                        setMuscleSearch('');
                      }
                    }}
                  />
                  
                  {muscleSearch.trim().length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'hsl(240, 16%, 8%)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-md)',
                      maxHeight: '130px',
                      overflowY: 'auto',
                      zIndex: 50,
                      marginTop: '4px',
                      boxShadow: '0 8px 16px rgba(0,0,0,0.5)'
                    }}>
                      {(() => {
                        const matches = MUSCLE_OPTIONS.filter(m => 
                          m.toLowerCase().includes(muscleSearch.toLowerCase()) && 
                          !selectedMuscles.includes(m)
                        );
                        
                        return (
                          <>
                            {matches.map(m => (
                              <div
                                key={m}
                                style={{ padding: '0.5rem 0.75rem', fontSize: '0.7rem', cursor: 'pointer', color: 'var(--text-secondary)' }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--primary-glow)'; e.currentTarget.style.color = 'var(--primary)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                onClick={() => { setSelectedMuscles(prev => [...prev, m]); setMuscleSearch(''); }}
                              >
                                {m}
                              </div>
                            ))}
                            <div
                              style={{ padding: '0.5rem 0.75rem', fontSize: '0.7rem', cursor: 'pointer', color: 'var(--primary)', fontWeight: '700', borderTop: matches.length > 0 ? '1px solid var(--border-light)' : 'none' }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-glow)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              onClick={() => {
                                if (!selectedMuscles.includes(muscleSearch.trim())) {
                                  setSelectedMuscles(prev => [...prev, muscleSearch.trim()]);
                                }
                                setMuscleSearch('');
                              }}
                            >
                              + Add Custom: "{muscleSearch.trim()}"
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => {
                  if (!exerciseName.trim()) {
                    alert('Please enter an exercise name.');
                    return;
                  }
                  setStep(2);
                }}
                className="btn btn-primary"
                style={{ marginTop: 'auto', padding: '0.75rem' }}
              >
                Choose Method →
              </button>
            </div>
          )}

          {/* STEP 2: Method Selection */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flexGrow: 1 }}>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '850', fontFamily: 'Outfit, sans-serif', margin: '0 0 0.35rem' }}>Choose Training Method</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '140%', margin: 0 }}>
                  Select how you want to build this exercise's custom posture detection model.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {/* Method 1: Webcam */}
                <div
                  className="glass-card"
                  style={{
                    cursor: 'pointer',
                    padding: '1rem 1.25rem',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                  onClick={() => {
                    setCreationMethod('live');
                    setStep(3); // Go to Webcam Start Pose
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.background = 'var(--primary-glow)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = 'var(--border-light)';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '800', color: 'var(--primary)' }}>
                    📸 Live Webcam Recording
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Perform and hold the start and peak contraction positions manually in front of your camera.
                  </p>
                </div>

                {/* Method 2: Video File */}
                <div
                  className="glass-card"
                  style={{
                    cursor: 'pointer',
                    padding: '1rem 1.25rem',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                  onClick={() => {
                    setCreationMethod('video');
                    setStep(7); // Go to Video Processing screen
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.borderColor = 'var(--secondary)';
                    e.currentTarget.style.background = 'var(--secondary-glow)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = 'var(--border-light)';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '800', color: 'var(--secondary)' }}>
                    📂 Import Video File (TikTok/YouTube)
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Upload a video clip of the exercise. AI will auto-extract start and peak contraction poses.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setStep(1)}
                className="btn btn-secondary"
                style={{ marginTop: 'auto', padding: '0.5rem', fontSize: '0.75rem' }}
              >
                ← Back to Details
              </button>
            </div>
          )}

          {/* STEPS 3 & 4: Camera Capture Wizard Pages (Webcam capturing) */}
          {(step === 3 || step === 4) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flexGrow: 1 }}>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '800', fontFamily: 'Outfit, sans-serif', margin: '0 0 0.25rem' }}>
                  {step === 3 ? '1. Start Position' : '2. Peak Position'}
                </h3>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>
                  {step === 3 
                    ? 'Hold starting pose (e.g. arms fully down) and click Record.' 
                    : 'Hold peak pose (e.g. weights curled all the way up) and click Record.'}
                </p>
              </div>

              {/* Camera Preview */}
              <div style={{ background: '#000', height: '240px', borderRadius: 'var(--radius-md)', overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-light)' }}>
                <video ref={videoRef} style={{ display: 'none' }} width="640" height="480" playsInline muted></video>
                <canvas ref={canvasRef} width="640" height="480" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}></canvas>
                
                {recordingMode && (
                  <div className="recording-pulse" style={{ position: 'absolute', top: '0.5rem', left: '0.5rem', background: 'var(--danger)', color: '#fff', fontSize: '0.6rem', fontWeight: '800', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-full)', boxShadow: '0 0 8px var(--danger)' }}>
                    RECORDING ({recordedCount}/30)
                  </div>
                )}
                {mpStatus === 'loading' && (
                  <div style={{ position: 'absolute', color: '#fff', fontSize: '0.7rem', background: 'rgba(0,0,0,0.8)', padding: '0.5rem 0.85rem', borderRadius: '6px' }}>
                    Initializing Tracking AI...
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: 'auto' }}>
                <button
                  onClick={() => startRecording(step === 3 ? 'start' : 'peak')}
                  disabled={recordingMode || mpStatus !== 'loaded'}
                  className="btn btn-primary"
                  style={{ 
                    padding: '0.75rem', 
                    background: step === 3 ? 'var(--primary)' : 'var(--secondary)', 
                    borderColor: step === 3 ? 'var(--primary)' : 'var(--secondary)' 
                  }}
                >
                  {recordingMode 
                    ? 'Recording...' 
                    : (step === 3 ? 'Record Start Pose' : 'Record Peak Pose')}
                </button>
                <button 
                  onClick={() => setStep(step === 3 ? 2 : 3)} 
                  disabled={recordingMode} 
                  className="btn btn-secondary" 
                  style={{ padding: '0.5rem', fontSize: '0.75rem' }}
                >
                  {step === 3 ? '← Back to Method Selection' : '← Back to Start Pose'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Train AI Model */}
          {step === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center', textAlign: 'center', justifyContent: 'center', flexGrow: 1, padding: '1.5rem 0' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'var(--primary-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
                boxShadow: '0 0 16px var(--primary-glow)',
                border: '1px solid hsla(var(--h-primary), 85%, 62%, 0.3)'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor"/>
                </svg>
              </div>

              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: '800', fontFamily: 'Outfit, sans-serif', margin: '0 0 0.35rem' }}>Train AI Classifier</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '140%', margin: 0 }}>
                  Compile and train a custom neural network locally on your webcam data.
                </p>
              </div>

              {isTraining ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '3px solid var(--border-light)', borderTopColor: 'var(--primary)', animation: 'spin 1s linear infinite' }}></div>
                  <span style={{ fontSize: '0.85rem', fontWeight: '800' }}>Training: {trainingProgress}%</span>
                  {lossValue && <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Loss log: {lossValue}</span>}
                </div>
              ) : (
                <button
                  onClick={trainModel}
                  className="btn btn-primary"
                  style={{ padding: '0.75rem 2rem', width: '100%', marginTop: '1rem' }}
                >
                  ⚡ Start local TF.js Training
                </button>
              )}
            </div>
          )}

          {/* STEP 6: Success & Save */}
          {step === 6 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', textAlign: 'center', justifyContent: 'center', flexGrow: 1, padding: '0.5rem 0', width: '100%' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'var(--primary-glow)',
                border: '2px solid var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                color: 'var(--primary)',
                filter: 'drop-shadow(0 0 8px var(--primary-glow))'
              }}>
                ✓
              </div>

              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '900', fontFamily: 'Outfit, sans-serif', margin: '0 0 0.25rem' }}>AI Classifier Ready!</h3>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: '140%', margin: 0 }}>
                  Inspect and fine-tune your templates below. drag the sliders to scrub different video frames.
                </p>
              </div>

              {/* Skeletal Pose Preview & Slider Configuration */}
              <div style={{ display: 'flex', gap: '1rem', width: '100%', justifyContent: 'center', margin: '0.25rem 0' }}>
                {/* Start Pose Box */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: '1 1 0', minWidth: 0 }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--primary)' }}>Start Position</span>
                  <div style={{ position: 'relative', width: '100%', height: '140px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-light)' }}>
                    <canvas ref={startCanvasRef} width="160" height="160" style={{ width: '100%', height: '100%', objectFit: 'contain' }}></canvas>
                  </div>
                  {creationMethod === 'video' && allScannedFrames.length > 0 && (
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <input
                        type="range"
                        min="0"
                        max={allScannedFrames.length - 1}
                        value={startFrameIndex}
                        onChange={(e) => setStartFrameIndex(parseInt(e.target.value))}
                        style={{ width: '100%', height: '4px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                      />
                      <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Frame {startFrameIndex + 1} of {allScannedFrames.length}</span>
                    </div>
                  )}
                </div>

                {/* Peak Pose Box */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: '1 1 0', minWidth: 0 }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--secondary)' }}>Peak Position</span>
                  <div style={{ position: 'relative', width: '100%', height: '140px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-light)' }}>
                    <canvas ref={peakCanvasRef} width="160" height="160" style={{ width: '100%', height: '100%', objectFit: 'contain' }}></canvas>
                  </div>
                  {creationMethod === 'video' && allScannedFrames.length > 0 && (
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <input
                        type="range"
                        min="0"
                        max={allScannedFrames.length - 1}
                        value={peakFrameIndex}
                        onChange={(e) => setPeakFrameIndex(parseInt(e.target.value))}
                        style={{ width: '100%', height: '4px', cursor: 'pointer', accentColor: 'var(--secondary)' }}
                      />
                      <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Frame {peakFrameIndex + 1} of {allScannedFrames.length}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Joint Selection Badges */}
              <div style={{ width: '100%', textAlign: 'left', background: 'hsla(0,0%,100%,0.02)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.75rem' }}>
                <strong style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                  🎯 Select Active Joints to Track:
                </strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                  {JOINT_NAMES.map((name, idx) => (
                    <label key={name} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none', color: 'var(--text-muted)' }}>
                      <input
                        type="checkbox"
                        checked={selectedJoints[idx]}
                        onChange={(e) => {
                          const updated = [...selectedJoints];
                          updated[idx] = e.target.checked;
                          setSelectedJoints(updated);
                        }}
                        style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                      />
                      <span style={{ color: selectedJoints[idx] ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: selectedJoints[idx] ? '700' : 'normal' }}>
                        {name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ width: '100%', background: 'hsla(0,0%,100%,0.02)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-light)', textAlign: 'left', fontSize: '0.75rem' }}>
                <div style={{ marginBottom: '0.25rem' }}><strong style={{ color: 'var(--text-secondary)' }}>Name:</strong> {exerciseName}</div>
                <div style={{ marginBottom: '0.25rem' }}><strong style={{ color: 'var(--text-secondary)' }}>Category:</strong> {category}</div>
                <div style={{ marginBottom: '0.25rem' }}><strong style={{ color: 'var(--text-secondary)' }}>Target Muscles:</strong> {selectedMuscles.join(', ') || 'General Muscles'}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border-light)' }}>
                  <div>
                    {creationMethod === 'video' ? (
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Timeline Poses: {allScannedFrames.length} frames</div>
                    ) : (
                      <>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Start Poses: {startFrames.length} frames</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Peak Poses: {peakFrames.length} frames</div>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (creationMethod === 'video') {
                        const tempIdx = startFrameIndex;
                        setStartFrameIndex(peakFrameIndex);
                        setPeakFrameIndex(tempIdx);
                      } else {
                        const temp = startFrames;
                        setStartFrames(peakFrames);
                        setPeakFrames(temp);
                      }
                      alert('Start and Peak poses swapped successfully!');
                    }}
                    className="btn btn-secondary"
                    style={{ width: 'auto', padding: '0.3rem 0.6rem', fontSize: '0.65rem', margin: 0 }}
                  >
                    🔄 Swap Poses
                  </button>
                </div>
              </div>

              <button
                onClick={handleSave}
                className="btn btn-primary"
                style={{ padding: '0.85rem', width: '100%', marginTop: '0.5rem' }}
              >
                Save & Deploy Exercise
              </button>
            </div>
          )}

          {/* STEP 7: Video Upload & Processing */}
          {step === 7 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flexGrow: 1 }}>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '850', fontFamily: 'Outfit, sans-serif', margin: '0 0 0.35rem' }}>Import Workout Video</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '140%', margin: 0 }}>
                  Upload a video of the movement. We will automatically analyze your body positions.
                </p>
              </div>

              {!isProcessingVideo ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{
                    border: '2px dashed var(--border-light)',
                    borderRadius: '8px',
                    padding: '2rem 1rem',
                    textAlign: 'center',
                    background: 'hsla(0, 0%, 100%, 0.01)',
                    position: 'relative',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) processVideoFile(file);
                      }}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        opacity: 0,
                        cursor: 'pointer'
                      }}
                    />
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                    </svg>
                    <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Choose Video file</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>MP4, WebM or MOV (max 1 minute)</div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1rem 0' }}>
                  <div style={{ position: 'relative', width: '64px', height: '64px', borderRadius: '50%', border: '3px solid var(--border-light)', borderTopColor: 'var(--secondary)', animation: 'spin 1.2s linear infinite' }}></div>
                  <div style={{ width: '100%', background: 'hsla(0,0%,100%,0.05)', height: '6px', borderRadius: '3px', overflow: 'hidden', marginTop: '0.5rem' }}>
                    <div style={{ width: `${videoProcessProgress}%`, background: 'var(--secondary)', height: '100%', transition: 'width 0.2s' }}></div>
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                    Scanning: {videoProcessProgress}%
                  </span>
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: 0, textAlign: 'center', fontFamily: 'monospace' }}>
                    {videoProcessLog}
                  </p>
                </div>
              )}

              <button
                onClick={() => setStep(2)}
                disabled={isProcessingVideo}
                className="btn btn-secondary"
                style={{ marginTop: 'auto', padding: '0.5rem', fontSize: '0.75rem' }}
              >
                ← Back to Method Selection
              </button>
            </div>
          )}

        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
