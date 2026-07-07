import React, { useState, useEffect, useRef } from 'react';
import { exercises } from '../data/exercises';

export default function CameraPoseOverlay() {
  const [selectedExerciseId, setSelectedExerciseId] = useState('hammer_curl');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isSimulating, setIsSimulating] = useState(true);
  const [simulatePoorForm, setSimulatePoorForm] = useState(false);
  const [cdnStatus, setCdnStatus] = useState('idle'); // 'idle' | 'loading' | 'loaded' | 'error'
  
  // Timer State
  const [timerTime, setTimerTime] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef(null);

  // Exercise rep & state tracking
  const [repCount, setRepCount] = useState(0);
  const [formFeedback, setFormFeedback] = useState({ status: 'good', message: 'Ready to start!' });
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
    if (isCameraActive && cdnStatus === 'idle') {
      setCdnStatus('loading');
      
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
            setCdnStatus('loaded');
          } catch (e) {
            console.error('Error initializing MediaPipe Pose:', e);
            setCdnStatus('error');
          }
        } else {
          setCdnStatus('error');
        }
      };
      script.onerror = () => {
        setCdnStatus('error');
      };
      document.body.appendChild(script);
    }
  }, [isCameraActive, cdnStatus]);

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
      if (isCameraActive && !isSimulating && cdnStatus === 'loaded' && videoRef.current && poseInstanceRef.current) {
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

    if (isCameraActive && !isSimulating && cdnStatus === 'loaded') {
      requestRef.current = requestAnimationFrame(processFrame);
    }

    return () => {
      active = false;
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isCameraActive, isSimulating, cdnStatus]);

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

  // Process posture and count reps
  const evaluatePosture = (joints, side) => {
    const { primaryAngle, secondaryAngle, repTracker } = activeExercise.rules;
    
    // Extract coordinates mapping left/right sides
    const getJointPos = (name) => {
      if (name === 'shoulder') return side === 'left' ? joints[11] : joints[12];
      if (name === 'elbow') return side === 'left' ? joints[13] : joints[14];
      if (name === 'wrist') return side === 'left' ? joints[15] : joints[16];
      if (name === 'hip') return side === 'left' ? joints[23] : joints[24];
      if (name === 'knee') return side === 'left' ? joints[25] : joints[26];
      if (name === 'ankle') return side === 'left' ? joints[27] : joints[28];
      return null;
    };

    const jA_p = getJointPos(primaryAngle.jointA);
    const jB_p = getJointPos(primaryAngle.jointB);
    const jC_p = getJointPos(primaryAngle.jointC);

    const primAngle = calculateAngle(jA_p, jB_p, jC_p);
    setCurrentPrimaryAngle(primAngle);

    // Evaluate Secondary Angle
    let secAngle = 0;
    let warningTriggered = false;
    let feedbackMsg = "Good posture! Keep it up.";

    if (secondaryAngle.type === 'stability') {
      const sA = getJointPos(secondaryAngle.jointA);
      const sB = getJointPos(secondaryAngle.jointB);
      const sC = getJointPos(secondaryAngle.jointC);
      secAngle = calculateAngle(sA, sB, sC);
      setCurrentSecondaryAngle(secAngle);

      if (secAngle > secondaryAngle.maxSwing) {
        warningTriggered = true;
        feedbackMsg = `Warning: ${secondaryAngle.name}! Avoid swinging.`;
      }
    } else if (secondaryAngle.type === 'limit') {
      // e.g. Torso angle relative to vertical/ground, or Hip angle
      const sA = getJointPos(secondaryAngle.jointA);
      const sB = getJointPos(secondaryAngle.jointB);
      const sC = getJointPos(secondaryAngle.jointC);
      secAngle = calculateAngle(sA, sB, sC);
      setCurrentSecondaryAngle(secAngle);

      if (secAngle < secondaryAngle.minTorsoAngle) {
        warningTriggered = true;
        feedbackMsg = "Warning: Keeping torso too low. Keep chest up!";
      }
    } else if (secondaryAngle.type === 'spine_straightness') {
      // In deadlift, check if back rounds (poor alignment between shoulder, hip, and ankle/knee)
      const sA = getJointPos(secondaryAngle.jointA);
      const sB = getJointPos(secondaryAngle.jointB);
      const sC = getJointPos(secondaryAngle.jointC);
      secAngle = calculateAngle(sA, sB, sC);
      setCurrentSecondaryAngle(secAngle);

      // In perfect straight back, shoulder-hip-knee/ankle angle changes predictably. 
      // If simulatePoorForm is checked, we trigger a rounding error warning.
      if (simulatePoorForm || (secAngle < 75 && getJointPos('knee')?.y < 0.75)) {
        warningTriggered = true;
        feedbackMsg = "Warning: Neutral spine lost! Don't round your back.";
      }
    }

    setFormFeedback({
      status: warningTriggered ? 'warning' : 'good',
      message: feedbackMsg
    });

    // Rep Tracker Logic
    if (repTracker.type === 'flexion') {
      // Hammer curl: Up threshold is flexed (< 55), down threshold is extended (> 140)
      if (repStateRef.current === 'start' && primAngle <= repTracker.upThreshold) {
        repStateRef.current = 'halfway';
      } else if (repStateRef.current === 'halfway' && primAngle >= repTracker.downThreshold) {
        repStateRef.current = 'start';
        setRepCount(prev => prev + 1);
      }
    } else if (repTracker.type === 'depth') {
      // Squat: Up threshold is standing (> 165), down threshold is parallel squat (< 100)
      if (repStateRef.current === 'start' && primAngle <= repTracker.downThreshold) {
        repStateRef.current = 'halfway';
      } else if (repStateRef.current === 'halfway' && primAngle >= repTracker.upThreshold) {
        repStateRef.current = 'start';
        setRepCount(prev => prev + 1);
      }
    } else if (repTracker.type === 'hinge') {
      // Deadlift: hinge bottom (< 100), lockout standing (> 165)
      if (repStateRef.current === 'start' && primAngle <= repTracker.downThreshold) {
        repStateRef.current = 'halfway';
      } else if (repStateRef.current === 'halfway' && primAngle >= repTracker.upThreshold) {
        repStateRef.current = 'start';
        setRepCount(prev => prev + 1);
      }
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
          
          if (selectedExerciseId === 'hammer_curl') {
            // Right-side coordinates
            landmarks[12] = { x: 0.45, y: 0.35, visibility: 0.99 }; // Shoulder
            landmarks[24] = { x: 0.44, y: 0.70, visibility: 0.99 }; // Hip

            // If poor form, swing elbow
            const elbowSwingX = simulatePoorForm ? 0.08 * progress : 0;
            const elbowSwingY = simulatePoorForm ? -0.04 * progress : 0;
            landmarks[14] = { x: 0.45 + elbowSwingX, y: 0.50 + elbowSwingY, visibility: 0.99 }; // Elbow

            // Forearm calculation based on flexion angle (Shoulder-Elbow-Wrist)
            const minA = 40;
            const maxA = 160;
            const targetA = maxA - (maxA - minA) * progress;
            // Map angle to 2D rotation
            const angleRad = ((180 - targetA) * Math.PI) / 180;
            landmarks[16] = {
              x: landmarks[14].x + 0.16 * Math.sin(angleRad),
              y: landmarks[14].y + 0.16 * Math.cos(angleRad),
              visibility: 0.99
            };
          } else if (selectedExerciseId === 'squat') {
            landmarks[28] = { x: 0.45, y: 0.85, visibility: 0.99 }; // Ankle (fixed)
            
            // Knee moves down and slightly forward
            landmarks[26] = { 
              x: 0.43 + 0.04 * progress, 
              y: 0.65 + 0.08 * progress, 
              visibility: 0.99 
            };
            
            // Hip goes down significantly
            landmarks[24] = { 
              x: 0.48 - 0.05 * progress, 
              y: 0.50 + 0.22 * progress, 
              visibility: 0.99 
            };

            // Shoulder moves down (lean forward slightly)
            const shoulderLean = simulatePoorForm ? 0.18 * progress : 0.04 * progress;
            landmarks[12] = { 
              x: landmarks[24].x + 0.02 - shoulderLean, 
              y: 0.22 + 0.22 * progress, 
              visibility: 0.99 
            };
          } else if (selectedExerciseId === 'deadlift') {
            landmarks[28] = { x: 0.44, y: 0.85, visibility: 0.99 }; // Ankle (fixed)
            
            // Knee bends slightly
            landmarks[26] = {
              x: 0.44 + 0.03 * progress,
              y: 0.70 + 0.06 * progress,
              visibility: 0.99
            };

            // Hip hinges backward
            landmarks[24] = {
              x: 0.38 - 0.08 * progress,
              y: 0.52 + 0.14 * progress,
              visibility: 0.99
            };

            // Shoulder pulls down
            // If poor form, we simulate spine rounding by moving shoulder forward/down out of alignment
            const spineRoundOffset = simulatePoorForm ? -0.09 * progress : 0.04 * progress;
            landmarks[12] = {
              x: landmarks[24].x + 0.12 + spineRoundOffset,
              y: 0.30 + 0.24 * progress,
              visibility: 0.99
            };
          }

          // Evaluate simulated pose
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
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isSimulating, selectedExerciseId, simulatePoorForm]);

  // Draw Pose Skeletal Bones & Guidelines on Canvas
  const drawPose = (ctx, landmarks, side, width, height) => {
    // Draw joints keypoints
    const drawJoint = (lm, label, color = '#aa3bff') => {
      if (!lm || lm.visibility < 0.5) return;
      const x = lm.x * width;
      const y = lm.y * height;

      ctx.beginPath();
      ctx.arc(x, y, 7, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (label) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px sans-serif';
        ctx.fillText(label, x + 10, y + 4);
      }
    };

    // Draw skeletal lines
    const drawBone = (lmA, lmB, color = 'rgba(255, 255, 255, 0.7)', widthLine = 3) => {
      if (!lmA || !lmB || lmA.visibility < 0.5 || lmB.visibility < 0.5) return;
      ctx.beginPath();
      ctx.moveTo(lmA.x * width, lmA.y * height);
      ctx.lineTo(lmB.x * width, lmB.y * height);
      ctx.strokeStyle = color;
      ctx.lineWidth = widthLine;
      ctx.stroke();
    };

    // Draw arc showing evaluation angles
    const drawAngleArc = (p1, p2, p3, angleVal, label, color = '#10b981') => {
      if (!p1 || !p2 || !p3) return;
      const x1 = p1.x * width;
      const y1 = p1.y * height;
      const x2 = p2.x * width;
      const y2 = p2.y * height;
      const x3 = p3.x * width;
      const y3 = p3.y * height;

      const angle1 = Math.atan2(y1 - y2, x1 - x2);
      const angle2 = Math.atan2(y3 - y2, x3 - x2);

      ctx.beginPath();
      ctx.arc(x2, y2, 28, angle1, angle2, angle1 > angle2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.stroke();

      // Display angle text label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`${angleVal}°`, x2 - 12, y2 - 34);
    };

    // Extract side matching indexes
    const shoulderIdx = side === 'left' ? 11 : 12;
    const elbowIdx = side === 'left' ? 13 : 14;
    const wristIdx = side === 'left' ? 15 : 16;
    const hipIdx = side === 'left' ? 23 : 24;
    const kneeIdx = side === 'left' ? 25 : 26;
    const ankleIdx = side === 'left' ? 27 : 28;

    const shoulder = landmarks[shoulderIdx];
    const elbow = landmarks[elbowIdx];
    const wrist = landmarks[wristIdx];
    const hip = landmarks[hipIdx];
    const knee = landmarks[kneeIdx];
    const ankle = landmarks[ankleIdx];

    // Status Colors based on Form Quality
    const activeColor = formFeedback.status === 'warning' ? '#ef4444' : '#10b981';
    const boneColor = formFeedback.status === 'warning' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)';

    // Draw active exercise skeleton connections
    if (selectedExerciseId === 'hammer_curl') {
      drawBone(shoulder, elbow, boneColor, 4);
      drawBone(elbow, wrist, boneColor, 4);
      drawBone(shoulder, hip, 'rgba(255, 255, 255, 0.3)', 2);

      drawJoint(shoulder, 'Shoulder');
      drawJoint(elbow, 'Elbow');
      drawJoint(wrist, 'Wrist');
      drawJoint(hip, 'Hip', 'rgba(255, 255, 255, 0.4)');

      // Visual angle guides
      drawAngleArc(shoulder, elbow, wrist, currentPrimaryAngle, 'Elbow', activeColor);
      
      // Draw a target guideline indicating stable tuck zone
      if (shoulder && hip) {
        ctx.beginPath();
        ctx.setLineDash([5, 5]);
        ctx.moveTo(shoulder.x * width, shoulder.y * height);
        ctx.lineTo(shoulder.x * width, hip.y * height);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else if (selectedExerciseId === 'squat' || selectedExerciseId === 'deadlift') {
      drawBone(shoulder, hip, boneColor, 4);
      drawBone(hip, knee, boneColor, 4);
      drawBone(knee, ankle, boneColor, 4);

      drawJoint(shoulder, 'Shoulder');
      drawJoint(hip, 'Hip');
      drawJoint(knee, 'Knee');
      drawJoint(ankle, 'Ankle');

      // Visual angle guides
      if (selectedExerciseId === 'squat') {
        drawAngleArc(hip, knee, ankle, currentPrimaryAngle, 'Knee', activeColor);
      } else {
        drawAngleArc(shoulder, hip, knee, currentPrimaryAngle, 'Hip', activeColor);
      }

      // Draw horizontal reference guide for squat parallel depth or deadlift spine straightness
      if (hip && knee) {
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.moveTo(0, knee.y * height);
        ctx.lineTo(width, knee.y * height);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  };

  const handleStartTimer = () => setTimerActive(true);
  const handleStopTimer = () => setTimerActive(false);
  const handleResetTimer = () => {
    setTimerActive(false);
    setTimerTime(0);
  };
  const handleResetReps = () => {
    setRepCount(0);
    repStateRef.current = 'start';
  };

  // Format timer text
  const formatTime = (time) => {
    const mins = Math.floor(time / 60);
    const secs = time % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={styles.container}>
      {/* Exercise Selection Bar */}
      <div style={styles.tabContainer}>
        {exercises.map(ex => (
          <button
            key={ex.id}
            onClick={() => {
              setSelectedExerciseId(ex.id);
              handleResetReps();
            }}
            style={{
              ...styles.tabButton,
              backgroundColor: selectedExerciseId === ex.id ? 'var(--accent)' : 'transparent',
              color: selectedExerciseId === ex.id ? '#ffffff' : 'var(--text-h)',
              border: selectedExerciseId === ex.id ? '1px solid var(--accent)' : '1px solid var(--border)'
            }}
          >
            {ex.name}
          </button>
        ))}
      </div>

      <div style={styles.mainLayout}>
        {/* Interactive Camera & Visual Guide Window */}
        <div style={styles.cameraFrame}>
          {isCameraActive && !isSimulating ? (
            <video
              ref={videoRef}
              style={styles.video}
              playsInline
              muted
            />
          ) : (
            <div style={styles.placeholderContainer}>
              <div style={styles.placeholderIcon}>🤖</div>
              <div style={styles.placeholderText}>
                {isSimulating ? "Running Workout Simulator Mode" : "Camera Feed Stopped"}
              </div>
              <p style={styles.placeholderSubtext}>
                {isSimulating 
                  ? "Evaluating visual guidelines with synthetic posture landmarks." 
                  : "Turn on the camera to begin real-time body tracking."}
              </p>
            </div>
          )}

          {/* Overlapping Canvas Layer */}
          <canvas
            ref={canvasRef}
            width={640}
            height={480}
            style={styles.canvas}
          />

          {/* Premium Form-Feedback Glassmorphic Banner */}
          <div style={{
            ...styles.feedbackBanner,
            borderColor: formFeedback.status === 'warning' ? '#ef4444' : '#10b981',
            backgroundColor: formFeedback.status === 'warning' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)'
          }}>
            <div style={{
              ...styles.feedbackDot,
              backgroundColor: formFeedback.status === 'warning' ? '#ef4444' : '#10b981'
            }} />
            <span style={{
              ...styles.feedbackMessage,
              color: formFeedback.status === 'warning' ? '#fca5a5' : '#a7f3d0'
            }}>
              {formFeedback.message}
            </span>
          </div>
        </div>

        {/* Floating Premium Dashboard Panels */}
        <div style={styles.dashboard}>
          
          {/* Workout Stats Card */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Exercise Stats</h3>
            <div style={styles.statRow}>
              <span style={styles.statLabel}>Reps Completed</span>
              <span style={styles.statValue}>{repCount}</span>
            </div>
            <div style={styles.statRow}>
              <span style={styles.statLabel}>Primary Angle ({activeExercise.rules.primaryAngle.name})</span>
              <span style={styles.statValue}>{currentPrimaryAngle}°</span>
            </div>
            <div style={styles.statRow}>
              <span style={styles.statLabel}>{activeExercise.rules.secondaryAngle.name}</span>
              <span style={styles.statValue}>{currentSecondaryAngle}°</span>
            </div>
            <button onClick={handleResetReps} style={styles.buttonSecondary}>Reset Rep Count</button>
          </div>

          {/* Session Timer Card */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Session Timer</h3>
            <div style={styles.timerDisplay}>{formatTime(timerTime)}</div>
            <div style={styles.timerControls}>
              {!timerActive ? (
                <button onClick={handleStartTimer} style={styles.buttonStart}>Start</button>
              ) : (
                <button onClick={handleStopTimer} style={styles.buttonStop}>Stop</button>
              )}
              <button onClick={handleResetTimer} style={styles.buttonSecondary}>Reset</button>
            </div>
          </div>

          {/* Input & Simulation Controls */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Control Center</h3>
            
            <div style={styles.toggleRow}>
              <label style={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={isSimulating}
                  onChange={(e) => {
                    setIsSimulating(e.target.checked);
                    if (e.target.checked) {
                      setIsCameraActive(false);
                    }
                  }}
                  style={styles.checkbox}
                />
                Run Manual Simulator
              </label>
            </div>

            <div style={styles.toggleRow}>
              <label style={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={isCameraActive}
                  disabled={isSimulating}
                  onChange={(e) => setIsCameraActive(e.target.checked)}
                  style={styles.checkbox}
                />
                Use Real Camera (Webcam)
              </label>
            </div>

            {isCameraActive && !isSimulating && (
              <div style={styles.statusLabel}>
                MediaPipe: <span style={styles.statusSpan}>{cdnStatus.toUpperCase()}</span>
              </div>
            )}

            <div style={{ ...styles.toggleRow, marginTop: 12 }}>
              <label style={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={simulatePoorForm}
                  onChange={(e) => setSimulatePoorForm(e.target.checked)}
                  style={styles.checkbox}
                />
                Force Poor Form (Test Warnings)
              </label>
            </div>
          </div>

          {/* Instructions Box */}
          <div style={{ ...styles.card, flex: 1 }}>
            <h4 style={{ margin: '0 0 6px 0', color: 'var(--text-h)' }}>Form Instructions</h4>
            <p style={styles.instructionText}>{activeExercise.instructions}</p>
            <p style={styles.exerciseDesc}>{activeExercise.description}</p>
          </div>

        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    maxWidth: '1126px',
    margin: '0 auto',
    padding: '16px',
    boxSizing: 'border-box',
  },
  tabContainer: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap'
  },
  tabButton: {
    padding: '8px 16px',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s ease',
  },
  mainLayout: {
    display: 'flex',
    flexDirection: 'row',
    gap: '20px',
    flexWrap: 'wrap',
    justifyContent: 'center'
  },
  cameraFrame: {
    position: 'relative',
    width: '100%',
    maxWidth: '640px',
    aspectRatio: '4/3',
    backgroundColor: '#111827',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow)',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  },
  placeholderContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    padding: '24px',
    boxSizing: 'border-box',
    textAlign: 'center',
    color: '#9ca3af'
  },
  placeholderIcon: {
    fontSize: '48px',
    marginBottom: '12px'
  },
  placeholderText: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#f3f4f6'
  },
  placeholderSubtext: {
    fontSize: '14px',
    color: '#9ca3af',
    marginTop: '6px',
    maxWidth: '320px'
  },
  feedbackBanner: {
    position: 'absolute',
    bottom: '16px',
    left: '16px',
    right: '16px',
    padding: '12px 16px',
    borderRadius: '8px',
    backdropFilter: 'blur(10px)',
    borderWidth: '1px',
    borderStyle: 'solid',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    transition: 'all 0.3s ease',
  },
  feedbackDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  feedbackMessage: {
    fontWeight: '600',
    fontSize: '14px',
    letterSpacing: '0.2px',
  },
  dashboard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    width: '100%',
    maxWidth: '440px',
    textAlign: 'left'
  },
  card: {
    backgroundColor: 'var(--code-bg)',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow)',
    display: 'flex',
    flexDirection: 'column',
  },
  cardTitle: {
    margin: '0 0 12px 0',
    fontSize: '16px',
    color: 'var(--text-h)',
    borderBottom: '1px solid var(--border)',
    paddingBottom: '6px'
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
    fontSize: '14px',
  },
  statLabel: {
    color: 'var(--text)',
  },
  statValue: {
    fontWeight: 'bold',
    color: 'var(--text-h)',
  },
  buttonSecondary: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    backgroundColor: 'transparent',
    color: 'var(--text-h)',
    cursor: 'pointer',
    fontSize: '13px',
    marginTop: '8px',
    transition: 'background-color 0.2s',
  },
  timerDisplay: {
    fontSize: '32px',
    fontWeight: 'bold',
    fontFamily: 'var(--mono)',
    color: 'var(--text-h)',
    textAlign: 'center',
    margin: '8px 0'
  },
  timerControls: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
  },
  buttonStart: {
    flex: 1,
    padding: '8px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#10b981',
    color: '#ffffff',
    fontWeight: '600',
    cursor: 'pointer',
  },
  buttonStop: {
    flex: 1,
    padding: '8px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#ef4444',
    color: '#ffffff',
    fontWeight: '600',
    cursor: 'pointer',
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '8px',
  },
  toggleLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: 'var(--text-h)',
    cursor: 'pointer',
  },
  checkbox: {
    cursor: 'pointer',
    width: '16px',
    height: '16px',
  },
  statusLabel: {
    fontSize: '12px',
    color: 'var(--text)',
    marginTop: '4px',
  },
  statusSpan: {
    fontWeight: 'bold',
    color: 'var(--accent)',
  },
  instructionText: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: 'var(--text-h)',
    marginBottom: '6px',
  },
  exerciseDesc: {
    fontSize: '12px',
    color: 'var(--text)',
    lineHeight: '140%',
  }
};
