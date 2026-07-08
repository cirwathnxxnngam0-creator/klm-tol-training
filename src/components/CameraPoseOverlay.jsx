import React, { useState, useEffect, useRef } from 'react';
import { exercises } from '../data/exercises';

const LightningIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)', display: 'inline-block' }}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor"/>
  </svg>
);

const ClockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block' }}>
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const DumbbellIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)', display: 'inline-block' }}>
    <path d="M6.5 6.5h11M6.5 17.5h11M3 12h18M3 8v8M21 8v8M6.5 6.5v11M17.5 6.5v11"/>
  </svg>
);

const BrainIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)', display: 'inline-block' }}>
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1 0-3.12 3 3 0 0 1 0-3.88 2.5 2.5 0 0 1 0-3.12A2.5 2.5 0 0 1 9.5 2z"/>
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 0-3.12 3 3 0 0 0 0-3.88 2.5 2.5 0 0 0 0-3.12A2.5 2.5 0 0 0 14.5 2z"/>
  </svg>
);

const PlayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: '2.5px', display: 'inline-block' }}>
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);

const StopIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'inline-block' }}>
    <rect x="4" y="4" width="16" height="16" rx="2"/>
  </svg>
);

export default function CameraPoseOverlay({ selectedExerciseId: propExerciseId, setSelectedExerciseId: propSetExerciseId }) {
  const [localExerciseId, setLocalExerciseId] = useState('dumbbell-hammer-curl');
  const selectedExerciseId = propExerciseId || localExerciseId;
  const setSelectedExerciseId = propSetExerciseId || setLocalExerciseId;
  const [isCameraActive, setIsCameraActive] = useState(true); // Default to true to auto-start camera
  
  // CDN Load Status
  const [mpStatus, setMpStatus] = useState('idle'); // 'idle' | 'loading' | 'loaded' | 'error'
  const [tfStatus, setTfStatus] = useState('idle'); // 'idle' | 'loading' | 'loaded' | 'error'
  const [modelStatus, setModelStatus] = useState('idle'); // 'idle' | 'loading' | 'loaded' | 'error'

  // Model instance
  const [model, setModel] = useState(null);
  const [predictionOutput, setPredictionOutput] = useState({ start: 0.5, end: 0.5 });
  const [aiStateMessage, setAiStateMessage] = useState('Position yourself to begin...');

  // Timer State
  const [timerTime, setTimerTime] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef(null);

  // Exercise rep & state tracking
  const [repCount, setRepCount] = useState(0);
  const [sessionWeight, setSessionWeight] = useState(10);
  const [formFeedback, setFormFeedback] = useState({ status: 'good', message: 'Model initializing...' });
  const [currentPrimaryAngle, setCurrentPrimaryAngle] = useState(0);
  const [currentSecondaryAngle, setCurrentSecondaryAngle] = useState(0);
  
  // Rep tracker state machine (Supports unilateral bilateral dual-side tracking with temporal debounce/throttle)
  const leftRepStateRef = useRef('start'); 
  const rightRepStateRef = useRef('start'); 
  const lastRepTimeRef = useRef(0);
  const customTemplatesRef = useRef(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const poseInstanceRef = useRef(null);
  const requestRef = useRef(null);

  const activeExercise = exercises.find(e => e.id === selectedExerciseId) || exercises[0];

  // Sync weight input and reset model state when exercise changes
  useEffect(() => {
    if (activeExercise) {
      setModel(null);
      setModelStatus('idle');
      try {
        const history = JSON.parse(localStorage.getItem('workout_history') || '[]');
        const exLogs = history.filter(h => h.exerciseId === activeExercise.id);
        if (exLogs.length > 0) {
          const prWeight = Math.max(...exLogs.flatMap(log => log.sets.map(s => Number(s.weight) || 0)));
          if (prWeight > 0) {
            setSessionWeight(prWeight);
            return;
          }
        }
      } catch (e) {
        console.error('Error fetching personal record for camera weight default', e);
      }
      setSessionWeight(activeExercise.defaultWeightKg);
    }
  }, [selectedExerciseId, activeExercise]);

  // Dynamic CDN Loader for MediaPipe Pose
  useEffect(() => {
    if (isCameraActive && mpStatus === 'idle') {
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
            console.error('Error initializing MediaPipe Pose:', e);
            setMpStatus('error');
          }
        } else {
          setMpStatus('error');
        }
      };
      script.onerror = () => setMpStatus('error');
      document.body.appendChild(script);
    }
  }, [isCameraActive, mpStatus]);

  // Dynamic CDN Loader for TensorFlow.js
  useEffect(() => {
    if (isCameraActive && tfStatus === 'idle') {
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
  }, [isCameraActive, tfStatus]);

  // Load or train Custom Posture Model when TF.js is loaded
  useEffect(() => {
    async function loadPostureModel() {
      if (tfStatus === 'loaded' && window.tf && modelStatus === 'idle') {
        setModelStatus('loading');
        try {
          if (activeExercise.isCustom) {
            const startFrames = activeExercise.startFrames || [];
            const peakFrames = activeExercise.peakFrames || [];

            if (startFrames.length > 0 && peakFrames.length > 0) {
              // Helper to calculate joint angles
              const calculateAngle = (p1, p2, p3) => {
                if (!p1 || !p2 || !p3) return 180; // default straight angle
                const radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
                let angle = Math.abs((radians * 180.0) / Math.PI);
                if (angle > 180.0) {
                  angle = 360.0 - angle;
                }
                return angle;
              };

              // Extract 8 normalized angles [0, 1] from joints map
              const extractAngles = (joints) => {
                const getPoint = (idx) => joints[idx] || null;
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

                return [
                  calculateAngle(leftHip, leftShoulder, leftElbow) / 180.0,   // Left Shoulder Abduction (Humerus to Torso)
                  calculateAngle(rightHip, rightShoulder, rightElbow) / 180.0, // Right Shoulder Abduction (Humerus to Torso)
                  calculateAngle(leftShoulder, leftElbow, leftWrist) / 180.0,  // Left Elbow Flexion (Forearm/Radius to Humerus)
                  calculateAngle(rightShoulder, rightElbow, rightWrist) / 180.0, // Right Elbow Flexion (Forearm/Radius to Humerus)
                  calculateAngle(leftShoulder, leftHip, leftKnee) / 180.0,     // Left Hip Flexion (Femur to Torso)
                  calculateAngle(rightShoulder, rightHip, rightKnee) / 180.0,   // Right Hip Flexion (Femur to Torso)
                  calculateAngle(leftHip, leftKnee, leftAnkle) / 180.0,       // Left Knee Flexion (Femur to Tibia)
                  calculateAngle(rightHip, rightKnee, rightAnkle) / 180.0       // Right Knee Flexion (Femur to Tibia)
                ];
              };

              // Reconstruct joints map from 34 flat features
              const reconstructJoints = (features) => {
                const joints = {};
                const cocoMapping = [0, 2, 5, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
                for (let i = 0; i < cocoMapping.length; i++) {
                  const idx = cocoMapping[i];
                  joints[idx] = {
                    x: features[i * 2] / 640.0,
                    y: features[i * 2 + 1] / 480.0
                  };
                }
                return joints;
              };

              // Convert training frames into angle vectors
              const startAnglesList = startFrames.map(f => extractAngles(reconstructJoints(f)));
              const peakAnglesList = peakFrames.map(f => extractAngles(reconstructJoints(f)));

              // Calculate average start pose angles
              const avgStartAngles = new Array(8).fill(0);
              startAnglesList.forEach(angles => {
                angles.forEach((val, idx) => {
                  avgStartAngles[idx] += val;
                });
              });
              avgStartAngles.forEach((_, idx) => {
                avgStartAngles[idx] /= startAnglesList.length;
              });

              // Calculate average peak pose angles
              const avgPeakAngles = new Array(8).fill(0);
              peakAnglesList.forEach(angles => {
                angles.forEach((val, idx) => {
                  avgPeakAngles[idx] += val;
                });
              });
              avgPeakAngles.forEach((_, idx) => {
                avgPeakAngles[idx] /= peakAnglesList.length;
              });

              // Calculate template variance weights to focus on the active moving joints!
              const rawWeights = new Array(8).fill(0);
              let sumWeights = 0;
              for (let i = 0; i < 8; i++) {
                rawWeights[i] = Math.abs(avgStartAngles[i] - avgPeakAngles[i]);
                sumWeights += rawWeights[i];
              }

              // Normalize weights (fallback to uniform weight if no motion detected at all)
              const weights = rawWeights.map(w => sumWeights > 0.05 ? w / sumWeights : 1.0 / 8.0);

              // Calculate temperature based on weighted distance between templates
              let sumWeightedSquaredDiff = 0;
              for (let i = 0; i < 8; i++) {
                sumWeightedSquaredDiff += weights[i] * Math.pow(avgStartAngles[i] - avgPeakAngles[i], 2);
              }
              const templateDistance = Math.sqrt(sumWeightedSquaredDiff);
              const temperature = Math.max(templateDistance / 2, 0.05);

              customTemplatesRef.current = { avgStartAngles, avgPeakAngles, weights, temperature, extractAngles };
              setModel(null); // No TFJS model required for custom exercises
              setModelStatus('loaded');
              setFormFeedback({ status: 'good', message: `AI Model for "${activeExercise.name}" initialized using joint angles!` });
            } else {
              throw new Error('No custom training frames found');
            }
          } else {
            // Load standard static pre-trained model for built-in exercises
            const loadedModel = await window.tf.loadLayersModel('/posture-data/num_js_model/model.json');
            setModel(loadedModel);
            setModelStatus('loaded');
            setFormFeedback({ status: 'good', message: 'AI Model successfully loaded!' });
          }
        } catch (err) {
          console.error("Failed to load layers model:", err);
          setModelStatus('error');
          setFormFeedback({ status: 'warning', message: 'Fallback to manual posture angles (TF.js failed).' });
        }
      }
    }
    if (tfStatus === 'loaded') {
      loadPostureModel();
    }
  }, [tfStatus, modelStatus, selectedExerciseId]);

  // Handle Video Camera Stream
  useEffect(() => {
    let stream = null;
    async function startCamera() {
      if (isCameraActive) {
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
          console.error("Failed to access webcam:", err);
          alert("Could not access camera. Please check your camera permissions.");
        }
      }
    }

    if (isCameraActive) {
      startCamera();
    } else {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCameraActive]);

  // Video processing frame loop for MediaPipe
  useEffect(() => {
    let active = true;
    const processFrame = async () => {
      if (!active) return;
      if (isCameraActive && mpStatus === 'loaded' && videoRef.current && poseInstanceRef.current) {
        if (videoRef.current.readyState >= 2) {
          try {
            await poseInstanceRef.current.send({ image: videoRef.current });
          } catch (err) {
            console.error("Frame processing error:", err);
          }
        }
      }
      requestRef.current = requestAnimationFrame(processFrame);
    };

    if (isCameraActive && mpStatus === 'loaded') {
      requestRef.current = requestAnimationFrame(processFrame);
    }

    return () => {
      active = false;
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isCameraActive, mpStatus]);

  // Workout Timer Effect
  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => {
        setTimerTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [timerActive]);

  // Calculate 2D angle
  const calculateAngle = (p1, p2, p3) => {
    if (!p1 || !p2 || !p3) return 0;
    const radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) {
      angle = 360.0 - angle;
    }
    return Math.round(angle);
  };

  // Map 33 MediaPipe Landmarks to 17 COCO Keypoints scaled to 640x480 pixels
  const cocoMapping = [0, 2, 5, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
  
  const extractCocoFeatures = (joints) => {
    const features = [];
    for (let i = 0; i < cocoMapping.length; i++) {
      const idx = cocoMapping[i];
      const j = joints[idx];
      if (j) {
        features.push(Math.round(j.x * 640));
        features.push(Math.round(j.y * 480));
      } else {
        features.push(0);
        features.push(0);
      }
    }
    return features;
  };

  // Unified state machine for rep tracking (combines physical angles & AI predictions on both sides)
  const updateRepState = (leftAngle, rightAngle, startProb = 0, endProb = 0) => {
    let leftStart = false;
    let leftPeak = false;
    let rightStart = false;
    let rightPeak = false;

    // Check if AI model is loaded and actively predicting
    const isAiActive = modelStatus === 'loaded';

    if (activeExercise.isCustom) {
      if (isAiActive) {
        // Rely entirely on custom AI classification scores for both sides
        leftStart = startProb > 0.70;
        leftPeak = endProb > 0.70;
        rightStart = startProb > 0.70;
        rightPeak = endProb > 0.70;
      }
    } else if (selectedExerciseId === 'dumbbell-hammer-curl') {
      if (isAiActive) {
        // Stricter check: Require joint angle AND at least 30% AI classification confidence
        leftStart = leftAngle > 135 && startProb > 0.30;
        leftPeak = leftAngle < 75 && leftAngle > 15 && endProb > 0.30;
        rightStart = rightAngle > 135 && startProb > 0.30;
        rightPeak = rightAngle < 75 && rightAngle > 15 && endProb > 0.30;
      } else {
        // Fallback: angles must be in valid ranges (ignoring noise/occlusion 0 deg)
        leftStart = leftAngle > 135;
        leftPeak = leftAngle < 75 && leftAngle > 15;
        rightStart = rightAngle > 135;
        rightPeak = rightAngle < 75 && rightAngle > 15;
      }
    } else if (selectedExerciseId === 'dumbbell-deadlift') {
      if (isAiActive) {
        // Stricter check: Require joint angle AND at least 30% AI classification confidence
        leftStart = leftAngle > 150 && startProb > 0.30;
        leftPeak = leftAngle < 120 && leftAngle > 40 && endProb > 0.30;
        rightStart = rightAngle > 150 && startProb > 0.30;
        rightPeak = rightAngle < 120 && rightAngle > 40 && endProb > 0.30;
      } else {
        // Fallback: angles must be in valid ranges (ignoring noise/occlusion 0 deg)
        leftStart = leftAngle > 150;
        leftPeak = leftAngle < 120 && leftAngle > 40;
        rightStart = rightAngle > 150;
        rightPeak = rightAngle < 120 && rightAngle > 40;
      }
    }

    let repTriggered = false;

    // Check LEFT side rep count
    if (leftRepStateRef.current === 'start' && leftPeak) {
      leftRepStateRef.current = 'halfway';
    } else if (leftRepStateRef.current === 'halfway' && leftStart) {
      leftRepStateRef.current = 'start';
      repTriggered = true;
    }

    // Check RIGHT side rep count
    if (rightRepStateRef.current === 'start' && rightPeak) {
      rightRepStateRef.current = 'halfway';
    } else if (rightRepStateRef.current === 'halfway' && rightStart) {
      rightRepStateRef.current = 'start';
      repTriggered = true;
    }

    // Increment repCount with a 1-second debounce window to prevent double-counting simultaneous reps
    if (repTriggered) {
      const now = Date.now();
      if (now - lastRepTimeRef.current > 1000) {
        setRepCount(prev => prev + 1);
        lastRepTimeRef.current = now;
      }
    }
  };

  // Run Real-Time inference using the TF.js model (or Custom Euclidean Template Classifier)
  const runAiClassification = async (joints, leftPrimAngle, rightPrimAngle) => {
    if (activeExercise.isCustom) {
      if (!customTemplatesRef.current) return;
      try {
        const rawFeatures = extractCocoFeatures(joints);
        const { avgStart, avgPeak, temperature } = customTemplatesRef.current;

        let distStart = 0;
        let distPeak = 0;

        for (let i = 0; i < 34; i++) {
          distStart += Math.pow(rawFeatures[i] - avgStart[i], 2);
          distPeak += Math.pow(rawFeatures[i] - avgPeak[i], 2);
        }
        distStart = Math.sqrt(distStart);
        distPeak = Math.sqrt(distPeak);

        const expStart = Math.exp(-distStart / temperature);
        const expPeak = Math.exp(-distPeak / temperature);
        const sum = expStart + expPeak;

        const startProb = sum > 0 ? expStart / sum : 0.5;
        const endProb = sum > 0 ? expPeak / sum : 0.5;

        // Trace to the terminal to ensure it works on localhost!
        console.warn("[AI Inference Custom] distStart:", Math.round(distStart), "distPeak:", Math.round(distPeak), "startProb:", startProb.toFixed(2), "endProb:", endProb.toFixed(2));

        setPredictionOutput({ start: startProb, end: endProb });

        // Update active message feedback based on classification outputs
        if (startProb > 0.75) {
          setFormFeedback({ status: 'good', message: "Perfect starting posture! Curl to begin." });
          updateRepState(leftPrimAngle, rightPrimAngle, startProb, endProb);
        } else if (endProb > 0.75) {
          setFormFeedback({ status: 'good', message: "Peak contraction reached! Lower down slowly." });
          updateRepState(leftPrimAngle, rightPrimAngle, startProb, endProb);
        } else {
          setFormFeedback({ status: 'info', message: "Maintain control throughout the range." });
          updateRepState(leftPrimAngle, rightPrimAngle, startProb, endProb);
        }
      } catch (e) {
        console.error("[AI Inference Custom] error:", e);
      }
      return;
    }

    // Standard static TF.js model path
    if (!model || !window.tf) return;
    try {
      const rawFeatures = extractCocoFeatures(joints);
      const tensorInput = window.tf.tensor2d([rawFeatures], [1, 34]);
      const prediction = model.predict(tensorInput);
      const scores = await prediction.data(); // Float32Array length 2 (softmax scores)
      
      tensorInput.dispose();
      prediction.dispose();

      console.warn("[AI Inference Standard] Softmax Scores:", scores);

      if (scores && scores.length === 2) {
        const startProb = scores[0];
        const endProb = scores[1];
        setPredictionOutput({ start: startProb, end: endProb });

        if (startProb > 0.75) {
          setFormFeedback({ status: 'good', message: "Perfect starting posture! Curl to begin." });
          updateRepState(leftPrimAngle, rightPrimAngle, startProb, endProb);
        } else if (endProb > 0.75) {
          setFormFeedback({ status: 'good', message: "Peak contraction reached! Lower down slowly." });
          updateRepState(leftPrimAngle, rightPrimAngle, startProb, endProb);
        } else {
          setFormFeedback({ status: 'info', message: "Maintain control throughout the range." });
          updateRepState(leftPrimAngle, rightPrimAngle, startProb, endProb);
        }
      }
    } catch (e) {
      console.error("[AI Inference] TFJS prediction error:", e);
    }
  };

  // Process posture and fallback angle bounds checking (Tracks both sides independently!)
  const evaluatePosture = (joints, side) => {
    const rules = {
      'dumbbell-deadlift': {
        primary: { jointA: 'shoulder', jointB: 'hip', jointC: 'knee', name: 'Hip Hinge' },
        secondary: { jointA: 'shoulder', jointB: 'hip', jointC: 'ankle', type: 'spine_straightness', name: 'Back Rounding' }
      },
      'dumbbell-hammer-curl': {
        primary: { jointA: 'shoulder', jointB: 'elbow', jointC: 'wrist', name: 'Elbow Flexion' },
        secondary: { jointA: 'hip', jointB: 'shoulder', jointC: 'elbow', type: 'stability', name: 'Elbow Sway' }
      }
    };

    const exRules = rules[selectedExerciseId] || rules['dumbbell-hammer-curl'];
    
    const getJointPos = (name, s) => {
      const joint = (() => {
        if (name === 'shoulder') return s === 'left' ? joints[11] : joints[12];
        if (name === 'elbow') return s === 'left' ? joints[13] : joints[14];
        if (name === 'wrist') return s === 'left' ? joints[15] : joints[16];
        if (name === 'hip') return s === 'left' ? joints[23] : joints[24];
        if (name === 'knee') return s === 'left' ? joints[25] : joints[26];
        if (name === 'ankle') return s === 'left' ? joints[27] : joints[28];
        return null;
      })();
      
      // Filter out points that are not visible or detected with low confidence
      if (!joint || (joint.visibility !== undefined && joint.visibility < 0.5)) {
        return null;
      }
      return joint;
    };

    // Calculate left side
    const leftJA = getJointPos(exRules.primary.jointA, 'left');
    const leftJB = getJointPos(exRules.primary.jointB, 'left');
    const leftJC = getJointPos(exRules.primary.jointC, 'left');
    const leftPrimAngle = calculateAngle(leftJA, leftJB, leftJC);

    // Calculate right side
    const rightJA = getJointPos(exRules.primary.jointA, 'right');
    const rightJB = getJointPos(exRules.primary.jointB, 'right');
    const rightJC = getJointPos(exRules.primary.jointC, 'right');
    const rightPrimAngle = calculateAngle(rightJA, rightJB, rightJC);

    // Default display side
    const displaySide = getBestSide(joints);
    const displayAngle = displaySide === 'left' ? leftPrimAngle : rightPrimAngle;
    setCurrentPrimaryAngle(displayAngle);

    // Secondary angles
    const leftSA = getJointPos(exRules.secondary.jointA, 'left');
    const leftSB = getJointPos(exRules.secondary.jointB, 'left');
    const leftSC = getJointPos(exRules.secondary.jointC, 'left');
    const leftSecAngle = calculateAngle(leftSA, leftSB, leftSC);

    const rightSA = getJointPos(exRules.secondary.jointA, 'right');
    const rightSB = getJointPos(exRules.secondary.jointB, 'right');
    const rightSC = getJointPos(exRules.secondary.jointC, 'right');
    const rightSecAngle = calculateAngle(rightSA, rightSB, rightSC);

    const displaySecAngle = displaySide === 'left' ? leftSecAngle : rightSecAngle;
    setCurrentSecondaryAngle(displaySecAngle);

    // 1. Run AI Classifier prediction if model loaded, otherwise run fallback state tracker directly
    const isAiActive = activeExercise.isCustom ? !!customTemplatesRef.current : (!!model && !!window.tf);
    if (isAiActive) {
      runAiClassification(joints, leftPrimAngle, rightPrimAngle);
    } else {
      updateRepState(leftPrimAngle, rightPrimAngle, 0, 0);
    }

    // 2. Perform secondary rule validation for visual skeleton styling checks
    let warning = false;
    let feedback = "Form looking correct. Keep repeating!";

    if (selectedExerciseId === 'dumbbell-hammer-curl') {
      if (displaySecAngle > 20) {
        warning = true;
        feedback = "Elbow sway detected! Pin your elbows to your side.";
      }
    } else if (selectedExerciseId === 'dumbbell-deadlift') {
      if (displaySecAngle < 155 && displaySecAngle > 30) {
        warning = true;
        feedback = "Keep your spine neutral! Avoid rounding your lower back.";
      }
    }

    if (!isAiActive) {
      setFormFeedback({
        status: warning ? 'warning' : 'good',
        message: warning ? feedback : "Joint angles correct. Maintain speed!"
      });
    }
  };

  // MediaPipe callback handler
  const onPoseResults = (results) => {
    if (!canvasRef.current) return;
    const canvasCtx = canvasRef.current.getContext('2d');
    const width = canvasRef.current.width;
    const height = canvasRef.current.height;

    canvasCtx.clearRect(0, 0, width, height);

    if (results.poseLandmarks) {
      const side = getBestSide(results.poseLandmarks);
      drawPose(canvasCtx, results.poseLandmarks, side, width, height);
      evaluatePosture(results.poseLandmarks, side);
    }
  };

  // Determine which side of user body faces the camera
  const getBestSide = (joints) => {
    const leftShoulder = joints[11];
    const rightShoulder = joints[12];
    if (!leftShoulder || !rightShoulder) return 'right';
    return leftShoulder.visibility > rightShoulder.visibility ? 'left' : 'right';
  };

  // Custom skeleton drawing overlay (Draws BOTH sides of the body for complete unilateral/bilateral feedback)
  const drawPose = (ctx, joints, side, w, h) => {
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    const getCoord = (idx) => {
      const j = joints[idx];
      if (!j || (j.visibility && j.visibility < 0.5)) return null;
      return { x: j.x * w, y: j.y * h };
    };

    // Calculate joints for BOTH sides
    const jointsToDraw = [
      // Left side
      { shoulder: getCoord(11), elbow: getCoord(13), wrist: getCoord(15), hip: getCoord(23), knee: getCoord(25), ankle: getCoord(27) },
      // Right side
      { shoulder: getCoord(12), elbow: getCoord(14), wrist: getCoord(16), hip: getCoord(24), knee: getCoord(26), ankle: getCoord(28) }
    ];

    // Select color based on warning states
    const glowColor = formFeedback.status === 'warning' ? 'rgba(239, 68, 68, 0.8)' : 'rgba(52, 211, 153, 0.8)';
    ctx.shadowBlur = 12;
    ctx.shadowColor = glowColor;
    ctx.strokeStyle = glowColor;

    // Draw connection lines for both sides
    jointsToDraw.forEach(s => {
      if (s.shoulder && s.elbow) {
        ctx.beginPath(); ctx.moveTo(s.shoulder.x, s.shoulder.y); ctx.lineTo(s.elbow.x, s.elbow.y); ctx.stroke();
      }
      if (s.elbow && s.wrist) {
        ctx.beginPath(); ctx.moveTo(s.elbow.x, s.elbow.y); ctx.lineTo(s.wrist.x, s.wrist.y); ctx.stroke();
      }
      if (s.shoulder && s.hip) {
        ctx.beginPath(); ctx.moveTo(s.shoulder.x, s.shoulder.y); ctx.lineTo(s.hip.x, s.hip.y); ctx.stroke();
      }
      if (s.hip && s.knee) {
        ctx.beginPath(); ctx.moveTo(s.hip.x, s.hip.y); ctx.lineTo(s.knee.x, s.knee.y); ctx.stroke();
      }
      if (s.knee && s.ankle) {
        ctx.beginPath(); ctx.moveTo(s.knee.x, s.knee.y); ctx.lineTo(s.ankle.x, s.ankle.y); ctx.stroke();
      }
    });

    // Draw torso connections (connecting left and right)
    const leftShoulder = getCoord(11);
    const rightShoulder = getCoord(12);
    const leftHip = getCoord(23);
    const rightHip = getCoord(24);

    if (leftShoulder && rightShoulder) {
      ctx.beginPath(); ctx.moveTo(leftShoulder.x, leftShoulder.y); ctx.lineTo(rightShoulder.x, rightShoulder.y); ctx.stroke();
    }
    if (leftHip && rightHip) {
      ctx.beginPath(); ctx.moveTo(leftHip.x, leftHip.y); ctx.lineTo(rightHip.x, rightHip.y); ctx.stroke();
    }

    // Reset shadow
    ctx.shadowBlur = 0;

    // Draw glowing joint points for both sides
    jointsToDraw.forEach(s => {
      [s.shoulder, s.elbow, s.wrist, s.hip, s.knee, s.ankle].forEach(point => {
        if (point) {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = glowColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(point.x, point.y, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      });
    });
  };

  const handleStartSession = () => {
    setTimerTime(0);
    setRepCount(0);
    setTimerActive(true);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSaveSession = () => {
    setTimerActive(false);
    
    // Save to local workout_history
    const newLog = {
      id: `log-${Date.now()}`,
      exerciseId: activeExercise.id,
      exerciseName: activeExercise.name,
      category: activeExercise.category,
      date: new Date().toISOString(),
      durationSec: timerTime,
      sets: [
        { setId: 1, weight: Number(sessionWeight) || 0, reps: repCount, completed: true }
      ],
      mode: 'AI Camera'
    };

    try {
      const stored = JSON.parse(localStorage.getItem('workout_history') || '[]');
      stored.unshift(newLog);
      localStorage.setItem('workout_history', JSON.stringify(stored));
      alert(`Workout session logged successfully! (${repCount} reps in ${formatTime(timerTime)})`);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fade-in" style={{ width: '100%', height: 'calc(100vh - 64px)', position: 'relative', overflow: 'hidden', background: '#09090b', display: 'flex', flexDirection: 'column' }}>
      {/* Full screen Webcam / AI Tracking Container */}
      <div 
        style={{ 
          flex: 1,
          width: '100%', 
          height: '100%',
          position: 'relative', 
          overflow: 'hidden',
          background: '#09090b'
        }}
      >
        {/* Real Webcam Element */}
        {isCameraActive ? (
          <video
            ref={videoRef}
            style={{ 
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%', 
              height: '100%', 
              objectFit: 'contain',
              zIndex: 1
            }}
            playsInline
            muted
          />
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-muted)',
            zIndex: 1
          }}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </span>
            <div style={{ fontWeight: '700', color: 'var(--text-primary)', marginTop: '0.75rem' }}>Camera Feed Offline</div>
            <p style={{ fontSize: '0.75rem', maxWidth: '240px', marginTop: '0.25rem', textAlign: 'center' }}>
              Preparing pose detection engine...
            </p>
          </div>
        )}

        {/* Glowing Canvas Overlay */}
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            pointerEvents: 'none',
            zIndex: 2
          }}
        />

        {/* ==================== CAMERA ASPECT GRADIENTS ==================== */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '100px',
          background: 'linear-gradient(to bottom, rgba(9, 9, 11, 0.95) 0%, rgba(9, 9, 11, 0.4) 60%, transparent 100%)',
          pointerEvents: 'none',
          zIndex: 3
        }} />

        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '160px',
          background: 'linear-gradient(to top, rgba(9, 9, 11, 0.95) 0%, rgba(9, 9, 11, 0.4) 60%, transparent 100%)',
          pointerEvents: 'none',
          zIndex: 3
        }} />

        {/* ==================== FLOATING OVERLAYS ==================== */}

        {/* 1. TOP BAR OVERLAY: Exercise Selector & Weight Input */}
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          right: '12px',
          zIndex: 10,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(13, 13, 13, 0.75)',
          backdropFilter: 'blur(12px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 'var(--radius-md)',
          padding: '8px 12px',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)'
        }}>
          {/* Exercise Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <LightningIcon />
            <select
              value={selectedExerciseId}
              onChange={(e) => {
                setSelectedExerciseId(e.target.value);
                setRepCount(0);
                leftRepStateRef.current = 'start';
                rightRepStateRef.current = 'start';
              }}
              disabled={timerActive}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                fontWeight: '800',
                fontFamily: 'Outfit, sans-serif',
                outline: 'none',
                cursor: 'pointer',
                opacity: timerActive ? 0.7 : 1
              }}
            >
              {exercises.map(ex => (
                <option key={ex.id} value={ex.id} style={{ background: '#121212', color: '#ffffff' }}>
                  {ex.name}
                </option>
              ))}
            </select>
          </div>

          {/* Weight Selection (The Wait) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.05em' }}>Weight:</span>
            <input
              type="number"
              value={sessionWeight}
              onChange={(e) => setSessionWeight(Math.max(0, parseFloat(e.target.value) || 0))}
              disabled={timerActive}
              style={{
                width: '38px',
                background: 'transparent',
                border: 'none',
                borderBottom: timerActive ? 'none' : '1px solid rgba(255, 255, 255, 0.3)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                fontWeight: '800',
                textAlign: 'center',
                outline: 'none',
                padding: '1px 0',
                opacity: timerActive ? 0.7 : 1
              }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '700' }}>kg</span>
          </div>
        </div>

        {/* 2. FLOATING STATS PILL (Top-Left, below top bar): Timer & Rep Counter */}
        <div style={{
          position: 'absolute',
          top: '64px',
          left: '12px',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(13, 13, 13, 0.75)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '6px 12px',
          borderRadius: 'var(--radius-full)',
          fontSize: '0.75rem',
          fontWeight: '700',
          color: 'var(--text-primary)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ClockIcon />
            <span style={{ fontFamily: 'monospace' }}>{formatTime(timerTime)}</span>
          </span>
          <div style={{ width: '1px', height: '10px', background: 'rgba(255, 255, 255, 0.15)' }}></div>
          <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <DumbbellIcon />
            <span>{repCount} reps</span>
          </span>
        </div>

        {/* 3. AI MODEL HUD (Top-Right, below top bar): Classification Probability Gauges */}
        <div style={{
          position: 'absolute',
          top: '64px',
          right: '12px',
          zIndex: 10,
          background: 'rgba(13, 13, 13, 0.75)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '8px 10px',
          borderRadius: 'var(--radius-md)',
          width: '120px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          fontSize: '0.6rem',
          color: 'var(--text-secondary)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
        }}>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '2px' }}>
            <BrainIcon />
            <span style={{ fontWeight: '700', fontSize: '0.6rem', color: 'var(--text-primary)' }}>AI MODEL</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>START POSE:</span>
            <span style={{ fontWeight: '800', color: 'var(--primary)' }}>{Math.round(predictionOutput.start * 100)}%</span>
          </div>
          <div style={{ height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '1.5px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--primary)', width: `${predictionOutput.start * 100}%`, transition: 'width 0.15s ease-out' }}></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
            <span>PEAK POSE:</span>
            <span style={{ fontWeight: '800', color: 'var(--secondary)' }}>{Math.round(predictionOutput.end * 100)}%</span>
          </div>
          <div style={{ height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '1.5px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--secondary)', width: `${predictionOutput.end * 100}%`, transition: 'width 0.15s ease-out' }}></div>
          </div>
        </div>

        {/* 4. ONLY TEXT ON THE BOTTOM: Posture Warnings & AI State Message */}
        <div style={{
          position: 'absolute',
          bottom: '92px',
          left: '12px',
          right: '12px',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          textAlign: 'center',
          pointerEvents: 'none'
        }}>
          {/* Posture Warning Text */}
          <div style={{
            color: formFeedback.status === 'warning' ? '#EF4444' : '#10B981',
            fontSize: '1rem',
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            textShadow: '0 2px 8px rgba(0,0,0,0.95)',
            padding: '4px 8px',
            borderRadius: '4px',
            background: formFeedback.status === 'warning' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.05)',
            backdropFilter: 'blur(4px)'
          }}>
            {formFeedback.message}
          </div>
          
          {/* Active AI Status Text */}
          <div style={{
            color: 'rgba(255, 255, 255, 0.75)',
            fontSize: '0.75rem',
            fontWeight: '600',
            textShadow: '0 1px 4px rgba(0,0,0,0.9)'
          }}>
            {aiStateMessage}
          </div>
        </div>

        {/* 5. BIG START BUTTON IN LOWER CENTER */}
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10
        }}>
          {!timerActive ? (
            <button 
              onClick={handleStartSession}
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                border: 'none',
                background: '#ffffff',
                color: '#09090b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 20px rgba(255, 255, 255, 0.35), 0 4px 15px rgba(0,0,0,0.5)',
                transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s',
                outline: 'none',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <PlayIcon />
            </button>
          ) : (
            <button 
              onClick={handleSaveSession}
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                border: 'none',
                background: '#EF4444',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 25px rgba(239, 68, 68, 0.6), 0 4px 15px rgba(0,0,0,0.5)',
                transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s',
                outline: 'none',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <StopIcon />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
