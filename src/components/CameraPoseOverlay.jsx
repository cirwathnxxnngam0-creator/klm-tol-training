import React, { useState, useEffect, useRef } from 'react';
import { exercises } from '../data/exercises';

export default function CameraPoseOverlay({ selectedExerciseId: propExerciseId, setSelectedExerciseId: propSetExerciseId }) {
  const [localExerciseId, setLocalExerciseId] = useState('dumbbell-hammer-curl');
  const selectedExerciseId = propExerciseId || localExerciseId;
  const setSelectedExerciseId = propSetExerciseId || setLocalExerciseId;
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isSimulating, setIsSimulating] = useState(true);
  const [simulatePoorForm, setSimulatePoorForm] = useState(false);
  
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
  const [formFeedback, setFormFeedback] = useState({ status: 'good', message: 'Model initializing...' });
  const [currentPrimaryAngle, setCurrentPrimaryAngle] = useState(0);
  const [currentSecondaryAngle, setCurrentSecondaryAngle] = useState(0);
  
  // Rep tracker state machine
  const repStateRef = useRef('start'); // 'start' | 'halfway'

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const poseInstanceRef = useRef(null);
  const requestRef = useRef(null);

  const activeExercise = exercises.find(e => e.id === selectedExerciseId) || exercises[0];

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

  // Load Custom Posture Model when TF.js is loaded
  useEffect(() => {
    async function loadPostureModel() {
      if (tfStatus === 'loaded' && window.tf && modelStatus === 'idle') {
        setModelStatus('loading');
        try {
          // Model is served out of public folder at posture-data/num_js_model/model.json
          const loadedModel = await window.tf.loadLayersModel('/posture-data/num_js_model/model.json');
          setModel(loadedModel);
          setModelStatus('loaded');
          setFormFeedback({ status: 'good', message: 'AI Model successfully loaded!' });
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
  }, [tfStatus, modelStatus]);

  // Handle Video Camera Stream
  useEffect(() => {
    let stream = null;
    async function startCamera() {
      if (isCameraActive && !isSimulating) {
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
          alert("Could not access camera. Switched to Simulation Mode.");
          setIsSimulating(true);
        }
      }
    }

    if (isCameraActive && !isSimulating) {
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
  }, [isCameraActive, isSimulating]);

  // Video processing frame loop for MediaPipe
  useEffect(() => {
    let active = true;
    const processFrame = async () => {
      if (!active) return;
      if (isCameraActive && !isSimulating && mpStatus === 'loaded' && videoRef.current && poseInstanceRef.current) {
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

    if (isCameraActive && !isSimulating && mpStatus === 'loaded') {
      requestRef.current = requestAnimationFrame(processFrame);
    }

    return () => {
      active = false;
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isCameraActive, isSimulating, mpStatus]);

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

  // Run Real-Time inference using the TF.js model
  const runAiClassification = async (joints) => {
    if (!model || !window.tf) return;
    try {
      const features = extractCocoFeatures(joints);
      const tensorInput = window.tf.tensor2d([features], [1, 34]);
      const prediction = model.predict(tensorInput);
      const scores = await prediction.data(); // Float32Array length 2 (softmax scores)
      
      tensorInput.dispose();
      prediction.dispose();

      if (scores && scores.length === 2) {
        const startProb = scores[0];
        const endProb = scores[1];
        setPredictionOutput({ start: startProb, end: endProb });

        // Update active message feedback based on classification outputs
        if (startProb > 0.75) {
          setAiStateMessage('Posture check: Start Position (Ready)');
        } else if (endProb > 0.75) {
          setAiStateMessage('Posture check: Peak contraction (Good)');
        } else {
          setAiStateMessage('Posture check: In motion...');
        }

        // Run rep tracking logic based on neural net classification transitions
        if (repStateRef.current === 'start' && endProb > 0.75) {
          repStateRef.current = 'halfway';
        } else if (repStateRef.current === 'halfway' && startProb > 0.75) {
          repStateRef.current = 'start';
          setRepCount(prev => prev + 1);
        }
      }
    } catch (e) {
      console.error("TFJS prediction error:", e);
    }
  };

  // Process posture and fallback angle bounds checking
  const evaluatePosture = (joints, side) => {
    // 1. Run AI Classifier prediction
    runAiClassification(joints);

    // 2. Perform secondary rule validation for visual skeleton styling checks
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
    
    const getJointPos = (name) => {
      if (name === 'shoulder') return side === 'left' ? joints[11] : joints[12];
      if (name === 'elbow') return side === 'left' ? joints[13] : joints[14];
      if (name === 'wrist') return side === 'left' ? joints[15] : joints[16];
      if (name === 'hip') return side === 'left' ? joints[23] : joints[24];
      if (name === 'knee') return side === 'left' ? joints[25] : joints[26];
      if (name === 'ankle') return side === 'left' ? joints[27] : joints[28];
      return null;
    };

    const jA = getJointPos(exRules.primary.jointA);
    const jB = getJointPos(exRules.primary.jointB);
    const jC = getJointPos(exRules.primary.jointC);
    const primAngle = calculateAngle(jA, jB, jC);
    setCurrentPrimaryAngle(primAngle);

    const sA = getJointPos(exRules.secondary.jointA);
    const sB = getJointPos(exRules.secondary.jointB);
    const sC = getJointPos(exRules.secondary.jointC);
    const secAngle = calculateAngle(sA, sB, sC);
    setCurrentSecondaryAngle(secAngle);

    // Provide warning feedback for secondary indicators
    let warning = false;
    let feedback = "Form looking correct. Keep repeating!";

    if (selectedExerciseId === 'dumbbell-hammer-curl') {
      if (secAngle > 20) {
        warning = true;
        feedback = "Warning: Keep elbows locked by your sides!";
      }
    } else {
      // Deadlift spine check
      if (simulatePoorForm || secAngle < 140) {
        warning = true;
        feedback = "Warning: Neutral spine lost! Straighten your lower back.";
      }
    }

    setFormFeedback({
      status: warning ? 'warning' : 'good',
      message: feedback
    });
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

  // Manual Simulator Mode loop
  useEffect(() => {
    let active = true;
    const simulateLoop = () => {
      if (!active) return;
      if (isSimulating) {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          // Calculate progression of the rep
          const t = Date.now() / 1000;
          const cycle = 4; // 4 seconds rep
          const phase = (t % cycle) / cycle;
          const progress = 0.5 - 0.5 * Math.cos(phase * 2 * Math.PI); // Smooth curve 0 -> 1 -> 0

          // Generate simulated landmarks
          const landmarks = {};
          
          if (selectedExerciseId === 'dumbbell-hammer-curl') {
            // Right-side coordinates
            landmarks[12] = { x: 0.45, y: 0.35, visibility: 0.99 }; // Shoulder
            landmarks[24] = { x: 0.44, y: 0.70, visibility: 0.99 }; // Hip

            // If poor form, swing elbow
            const elbowSwingX = simulatePoorForm ? 0.08 * progress : 0;
            const elbowSwingY = simulatePoorForm ? -0.04 * progress : 0;
            landmarks[14] = { x: 0.45 + elbowSwingX, y: 0.50 + elbowSwingY, visibility: 0.99 }; // Elbow

            const targetA = 160 - 120 * progress;
            const angleRad = ((180 - targetA) * Math.PI) / 180;
            landmarks[16] = {
              x: landmarks[14].x + 0.16 * Math.sin(angleRad),
              y: landmarks[14].y + 0.16 * Math.cos(angleRad),
              visibility: 0.99
            };
          } else {
            // Deadlift
            landmarks[28] = { x: 0.45, y: 0.85, visibility: 0.99 }; // Ankle
            landmarks[26] = { 
              x: 0.43 + 0.03 * progress, 
              y: 0.65 + 0.05 * progress, 
              visibility: 0.99 
            };
            landmarks[24] = { 
              x: 0.47 - 0.05 * progress, 
              y: 0.52 + 0.18 * progress, 
              visibility: 0.99 
            };
            // Back rounding simulation
            const backRound = simulatePoorForm ? 0.15 * progress : 0.03 * progress;
            landmarks[12] = { 
              x: landmarks[24].x + 0.02 - backRound, 
              y: 0.24 + 0.20 * progress, 
              visibility: 0.99 
            };
            landmarks[14] = { x: landmarks[12].x + 0.01, y: landmarks[12].y + 0.15, visibility: 0.99 }; // Elbow
            landmarks[16] = { x: landmarks[14].x, y: landmarks[14].y + 0.15, visibility: 0.99 }; // Wrist
          }

          // Fill standard points so classifier doesn't crash on null points
          cocoMapping.forEach(idx => {
            if (!landmarks[idx]) {
              landmarks[idx] = { x: 0.4, y: 0.3, visibility: 0.8 };
            }
          });

          drawPose(ctx, landmarks, 'right', w, h);
          evaluatePosture(landmarks, 'right');
        }
      }
      requestRef.current = requestAnimationFrame(simulateLoop);
    };

    if (isSimulating) {
      requestRef.current = requestAnimationFrame(simulateLoop);
    }

    return () => {
      active = false;
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isSimulating, selectedExerciseId, simulatePoorForm]);

  // Determine which side of user body faces the camera
  const getBestSide = (joints) => {
    const leftShoulder = joints[11];
    const rightShoulder = joints[12];
    if (!leftShoulder || !rightShoulder) return 'right';
    return leftShoulder.visibility > rightShoulder.visibility ? 'left' : 'right';
  };

  // Custom skeleton drawing overlay
  const drawPose = (ctx, joints, side, w, h) => {
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    const getCoord = (idx) => {
      const j = joints[idx];
      if (!j || (j.visibility && j.visibility < 0.5)) return null;
      return { x: j.x * w, y: j.y * h };
    };

    // Draw main structural bones
    const shoulder = getCoord(side === 'left' ? 11 : 12);
    const elbow = getCoord(side === 'left' ? 13 : 14);
    const wrist = getCoord(side === 'left' ? 15 : 16);
    const hip = getCoord(side === 'left' ? 23 : 24);
    const knee = getCoord(side === 'left' ? 25 : 26);
    const ankle = getCoord(side === 'left' ? 27 : 28);

    // Select color based on warning states
    const glowColor = formFeedback.status === 'warning' ? 'rgba(239, 68, 68, 0.8)' : 'rgba(52, 211, 153, 0.8)';
    ctx.shadowBlur = 12;
    ctx.shadowColor = glowColor;

    // Drawing lines connecting joints
    if (shoulder && elbow) {
      ctx.strokeStyle = glowColor;
      ctx.beginPath(); ctx.moveTo(shoulder.x, shoulder.y); ctx.lineTo(elbow.x, elbow.y); ctx.stroke();
    }
    if (elbow && wrist) {
      ctx.strokeStyle = glowColor;
      ctx.beginPath(); ctx.moveTo(elbow.x, elbow.y); ctx.lineTo(wrist.x, wrist.y); ctx.stroke();
    }
    if (shoulder && hip) {
      ctx.strokeStyle = glowColor;
      ctx.beginPath(); ctx.moveTo(shoulder.x, shoulder.y); ctx.lineTo(hip.x, hip.y); ctx.stroke();
    }
    if (hip && knee) {
      ctx.strokeStyle = glowColor;
      ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(knee.x, knee.y); ctx.stroke();
    }
    if (knee && ankle) {
      ctx.strokeStyle = glowColor;
      ctx.beginPath(); ctx.moveTo(knee.x, knee.y); ctx.lineTo(ankle.x, ankle.y); ctx.stroke();
    }

    // Reset shadow
    ctx.shadowBlur = 0;

    // Draw glowing joint points
    [shoulder, elbow, wrist, hip, knee, ankle].forEach(point => {
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
        { setId: 1, weight: activeExercise.defaultWeightKg, reps: repCount, completed: true }
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
    <div className="container fade-in" style={{ paddingBottom: '3rem' }}>
      {/* Exercise Picker */}
      <div className="glass-card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
          Select Training Movement
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          {exercises.map(ex => (
            <button
              key={ex.id}
              className={`btn ${selectedExerciseId === ex.id ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.8rem', padding: '0.6rem 0.5rem' }}
              onClick={() => {
                setSelectedExerciseId(ex.id);
                setRepCount(0);
                repStateRef.current = 'start';
              }}
            >
              {ex.name}
            </button>
          ))}
        </div>
      </div>

      {/* Camera / Simulation Container */}
      <div className="glass-card" style={{ padding: '0.5rem', overflow: 'hidden', position: 'relative' }}>
        <div style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '4/3',
          backgroundColor: 'hsl(240, 16%, 4%)',
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          border: '1px solid var(--border-light)'
        }}>
          {isCameraActive && !isSimulating ? (
            <video
              ref={videoRef}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
              textAlign: 'center',
              color: 'var(--text-muted)'
            }}>
              <span style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
                {isSimulating ? '🤖' : '📷'}
              </span>
              <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                {isSimulating ? 'Skeletal Simulator Active' : 'Camera Feed Offline'}
              </div>
              <p style={{ fontSize: '0.75rem', maxWidth: '240px', marginTop: '0.25rem' }}>
                {isSimulating ? 'Generating simulated joint movements...' : 'Turn on camera below to align pose.'}
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
              pointerEvents: 'none'
            }}
          />

          {/* Floating Form Warning Indicator */}
          <div style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            right: '12px',
            padding: '0.65rem 0.85rem',
            borderRadius: 'var(--radius-sm)',
            background: 'hsla(240, 16%, 6%, 0.85)',
            backdropFilter: 'blur(8px)',
            borderLeft: formFeedback.status === 'warning' ? '3px solid var(--danger)' : '3px solid var(--success)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.75rem',
            color: 'var(--text-primary)'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: formFeedback.status === 'warning' ? 'var(--danger)' : 'var(--success)'
            }}></span>
            <span style={{ fontWeight: '600' }}>{formFeedback.message}</span>
          </div>
        </div>
      </div>

      {/* Control Actions Panel */}
      <div className="glass-card" style={{ marginTop: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
          <button
            className={`btn ${isCameraActive ? 'btn-secondary' : 'btn-primary'}`}
            onClick={() => {
              setIsCameraActive(prev => !prev);
              if (isCameraActive) setIsSimulating(true);
            }}
          >
            {isCameraActive ? '🚫 Stop Tracker' : '📷 Start Camera'}
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => setIsSimulating(prev => !prev)}
            disabled={!isCameraActive}
            style={{ opacity: isCameraActive ? 1 : 0.5 }}
          >
            {isSimulating ? '🔄 Mode: Webcam' : '🔄 Mode: Simulate'}
          </button>
        </div>

        {/* Poor Form Simulator Checkbox (for testing warnings) */}
        {isSimulating && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1rem',
            padding: '0.5rem 0.75rem',
            background: 'hsla(0, 0%, 100%, 0.03)',
            borderRadius: 'var(--radius-sm)',
            border: '1px dashed var(--border-light)'
          }}>
            <input
              type="checkbox"
              id="poorFormSim"
              checked={simulatePoorForm}
              onChange={(e) => setSimulatePoorForm(e.target.checked)}
              style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--primary)' }}
            />
            <label htmlFor="poorFormSim" style={{ fontSize: '0.75rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              ⚠️ Simulate Rounded Back / Elbow Sway (Test Warnings)
            </label>
          </div>
        )}

        {/* Real-time Statistics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{
            background: 'hsla(0, 0%, 100%, 0.02)',
            border: '1px solid var(--border-light)',
            padding: '0.75rem',
            borderRadius: 'var(--radius-sm)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Timer</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', fontFamily: 'monospace', color: 'var(--text-primary)', marginTop: '0.25rem' }}>
              {formatTime(timerTime)}
            </div>
          </div>

          <div style={{
            background: 'hsla(0, 0%, 100%, 0.02)',
            border: '1px solid var(--border-light)',
            padding: '0.75rem',
            borderRadius: 'var(--radius-sm)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Rep Counter</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)', marginTop: '0.25rem' }}>
              {repCount}
            </div>
          </div>
        </div>

        {/* Neural Network Model Output Gauges */}
        <div style={{
          background: 'hsla(var(--h-primary), 85%, 62%, 0.03)',
          border: '1px solid hsla(var(--h-primary), 85%, 62%, 0.15)',
          padding: '0.85rem',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '1.25rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-primary)' }}>🤖 AI Classifier Output</span>
            <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'var(--primary-glow)', color: 'var(--primary)', fontWeight: '700' }}>
              {modelStatus === 'loaded' ? 'TF.js Active' : 'Loading Model...'}
            </span>
          </div>

          {/* Custom gauge lines */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                <span>Start Pose Probability</span>
                <span style={{ fontWeight: '700' }}>{Math.round(predictionOutput.start * 100)}%</span>
              </div>
              <div style={{ height: '4px', background: 'var(--bg-surface-elevated)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'var(--primary)', width: `${predictionOutput.start * 100}%`, transition: 'width 0.15s ease-out' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                <span>Peak Contract Probability</span>
                <span style={{ fontWeight: '700' }}>{Math.round(predictionOutput.end * 100)}%</span>
              </div>
              <div style={{ height: '4px', background: 'var(--bg-surface-elevated)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'var(--secondary)', width: `${predictionOutput.end * 100}%`, transition: 'width 0.15s ease-out' }}></div>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem', fontStyle: 'italic', textAlign: 'center' }}>
            "{aiStateMessage}"
          </div>
        </div>

        {/* Workout Control Actions */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {!timerActive ? (
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleStartSession}>
              ⚡ Start Workout Set
            </button>
          ) : (
            <button className="btn btn-secondary" style={{ width: '100%', background: 'hsla(350, 80%, 55%, 0.15)', color: 'var(--danger)', borderColor: 'hsla(350, 80%, 55%, 0.3)' }} onClick={handleSaveSession}>
              💾 Stop & Save Set
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
