import React, { useState, useEffect, useRef } from 'react';
import { loadCustomExercises } from '../data/exercises';

export default function ExerciseCreatorModal({ onClose, onSaveComplete }) {
  const [step, setStep] = useState(1);
  const [exerciseName, setExerciseName] = useState('');
  const [category, setCategory] = useState('Custom Exercise');
  const [selectedMuscles, setSelectedMuscles] = useState([]);
  const [muscleSearch, setMuscleSearch] = useState('');

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
  
  // Camera & Tracking states
  const [cameraActive, setCameraActive] = useState(false);
  const [mpStatus, setMpStatus] = useState('idle');
  const [tfStatus, setTfStatus] = useState('idle');
  
  // Collected datasets
  const [startFrames, setStartFrames] = useState([]);
  const [peakFrames, setPeakFrames] = useState([]);
  const [recordingMode, setRecordingMode] = useState(null); // 'start' | 'peak' | null
  const [recordedCount, setRecordedCount] = useState(0);

  // Training states
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [lossValue, setLossValue] = useState(null);
  const [isTrained, setIsTrained] = useState(false);

  // Video and Canvas refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const poseInstanceRef = useRef(null);
  const requestRef = useRef(null);
  const currentJointsRef = useRef(null);

  // Load scripts and start webcam
  useEffect(() => {
    if (step === 2 && !cameraActive) {
      setCameraActive(true);
    }
  }, [step]);

  // Load MediaPipe Pose
  useEffect(() => {
    if (cameraActive && mpStatus === 'idle') {
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
  }, [cameraActive, mpStatus]);

  // Load TensorFlow.js
  useEffect(() => {
    if (cameraActive && tfStatus === 'idle') {
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
  }, [cameraActive, tfStatus]);

  // Start video feed
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
            requestRef.current = requestAnimationFrame(processVideoFrame);
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
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [cameraActive]);

  // Process webcam frame through MediaPipe Pose
  const processVideoFrame = async () => {
    if (videoRef.current && videoRef.current.readyState === 4 && poseInstanceRef.current && mpStatus === 'loaded') {
      try {
        await poseInstanceRef.current.send({ image: videoRef.current });
      } catch (err) {
        console.error("Frame processing error:", err);
      }
    }
    if (cameraActive) {
      requestRef.current = requestAnimationFrame(processVideoFrame);
    }
  };

  const cocoMapping = [0, 2, 5, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
  
  const extractFeatures = (landmarks) => {
    const features = [];
    for (let i = 0; i < cocoMapping.length; i++) {
      const idx = cocoMapping[i];
      const j = landmarks[idx];
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

  // Callback when pose landmarks are returned
  const onPoseResults = (results) => {
    if (!canvasRef.current || !results.poseLandmarks) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw raw camera feed mirrored
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Draw skeletal connection overlay in Neon Green
    ctx.strokeStyle = 'hsl(142, 85%, 62%)';
    ctx.lineWidth = 3;
    
    // Render lines for standard connections
    const connections = [
      [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], // Upper body
      [11, 23], [12, 24], [23, 24], // Torso
      [23, 25], [24, 26], [25, 27], [26, 28] // Lower body
    ];

    connections.forEach(([i, j]) => {
      const p1 = results.poseLandmarks[i];
      const p2 = results.poseLandmarks[j];
      if (p1 && p2 && p1.visibility > 0.5 && p2.visibility > 0.5) {
        ctx.beginPath();
        // Mirror x coords
        ctx.moveTo(canvas.width - p1.x * canvas.width, p1.y * canvas.height);
        ctx.lineTo(canvas.width - p2.x * canvas.width, p2.y * canvas.height);
        ctx.stroke();
      }
    });

    // Draw joints
    results.poseLandmarks.forEach((lm) => {
      if (lm.visibility > 0.5) {
        ctx.fillStyle = 'var(--text-primary)';
        ctx.beginPath();
        ctx.arc(canvas.width - lm.x * canvas.width, lm.y * canvas.height, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

    // Capture frames if actively recording
    const currentFeatures = extractFeatures(results.poseLandmarks);
    currentJointsRef.current = currentFeatures;
  };

  // Record loop
  useEffect(() => {
    let interval = null;
    if (recordingMode && recordedCount < 30) {
      interval = setInterval(() => {
        if (currentJointsRef.current) {
          const currentData = currentJointsRef.current;
          if (recordingMode === 'start') {
            setStartFrames(prev => [...prev, currentData]);
          } else {
            setPeakFrames(prev => [...prev, currentData]);
          }
          setRecordedCount(prev => {
            const next = prev + 1;
            if (next >= 30) {
              setRecordingMode(null);
              clearInterval(interval);
            }
            return next;
          });
        }
      }, 100); // 10 frames per second over 3 seconds
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
      const model = window.tf.sequential();
      model.add(window.tf.layers.dense({ units: 16, inputShape: [34], activation: 'relu' }));
      model.add(window.tf.layers.dense({ units: 8, activation: 'relu' }));
      model.add(window.tf.layers.dense({ units: 2, activation: 'softmax' }));

      model.compile({
        optimizer: window.tf.train.adam(0.01),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });

      const inputs = [...startFrames, ...peakFrames];
      const labels = [
        ...startFrames.map(() => [1, 0]),
        ...peakFrames.map(() => [0, 1])
      ];

      const xs = window.tf.tensor2d(inputs, [inputs.length, 34]);
      const ys = window.tf.tensor2d(labels, [labels.length, 2]);

      const epochs = 30;
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
      model.dispose(); // clean up model since we train it on-the-fly during camera overlay

      setIsTraining(false);
      setIsTrained(true);
      setStep(4);
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
      startFrames: startFrames,
      peakFrames: peakFrames,
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
      
      // Reload combined list
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
      padding: '1.5rem',
      color: 'var(--text-primary)'
    }}>
      <div className="glass-card" style={{
        width: '100%',
        maxWidth: '900px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-lg)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '900', fontFamily: 'Outfit, sans-serif', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)' }}>
              <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
              <polyline points="2 8.5 12 15 22 8.5" />
              <polyline points="12 22 12 15" />
            </svg>
            Create Custom AI Exercise
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Modal Content body */}
        <div style={{ display: 'grid', gridTemplateColumns: step >= 2 ? '1.2fr 1fr' : '1fr', flexGrow: 1, overflow: 'hidden' }}>
          {/* Left panel (Webcam preview) */}
          {step >= 2 && (
            <div style={{ background: '#000', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <video ref={videoRef} style={{ display: 'none' }} width="640" height="480" playsInline muted></video>
              <canvas ref={canvasRef} width="640" height="480" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}></canvas>
              
              {recordingMode && (
                <div className="recording-pulse" style={{
                  position: 'absolute',
                  top: '1rem',
                  left: '1rem',
                  background: 'var(--danger)',
                  color: '#fff',
                  fontSize: '0.65rem',
                  fontWeight: '800',
                  padding: '0.35rem 0.65rem',
                  borderRadius: 'var(--radius-full)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 0 12px var(--danger)'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff', display: 'inline-block' }}></span>
                  RECORDING {recordingMode.toUpperCase()} ({recordedCount}/30)
                </div>
              )}

              {mpStatus === 'loading' && (
                <div style={{ position: 'absolute', color: '#fff', fontSize: '0.8rem', background: 'rgba(0,0,0,0.8)', padding: '0.75rem 1.25rem', borderRadius: '8px' }}>
                  Loading Body Tracking AI...
                </div>
              )}
            </div>
          )}

          {/* Right panel (Workflow details) */}
          <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', borderLeft: step >= 2 ? '1px solid var(--border-light)' : 'none' }}>
            
            {/* STEP 1: Metadata setup */}
            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '800', fontFamily: 'Outfit, sans-serif' }}>Step 1: Set Exercise Details</h3>
                
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
                  
                  {/* Tag list of selected muscles */}
                  {selectedMuscles.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.65rem' }}>
                      {selectedMuscles.map(muscle => (
                        <span key={muscle} style={{
                          fontSize: '0.7rem',
                          fontWeight: '700',
                          padding: '0.2rem 0.5rem 0.2rem 0.6rem',
                          borderRadius: 'var(--radius-full)',
                          background: 'hsla(var(--h-primary), 85%, 62%, 0.12)',
                          color: 'var(--primary)',
                          border: '1px solid hsla(var(--h-primary), 85%, 62%, 0.25)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          {muscle}
                          <button
                            type="button"
                            onClick={() => setSelectedMuscles(prev => prev.filter(m => m !== muscle))}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--primary)',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              lineHeight: 1
                            }}
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Autocomplete Input */}
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
                    
                    {/* Autocomplete dropdown list overlay */}
                    {muscleSearch.trim().length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: 'hsl(240, 16%, 8%)',
                        border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius-md)',
                        maxHeight: '150px',
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
                                  style={{
                                    padding: '0.6rem 0.85rem',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    color: 'var(--text-secondary)',
                                    transition: 'all 0.15s'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'var(--primary-glow)';
                                    e.currentTarget.style.color = 'var(--primary)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = 'var(--text-secondary)';
                                  }}
                                  onClick={() => {
                                    setSelectedMuscles(prev => [...prev, m]);
                                    setMuscleSearch('');
                                  }}
                                >
                                  {m}
                                </div>
                              ))}
                              
                              <div
                                style={{
                                  padding: '0.6rem 0.85rem',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                  color: 'var(--primary)',
                                  fontWeight: '700',
                                  borderTop: matches.length > 0 ? '1px solid var(--border-light)' : 'none',
                                  transition: 'all 0.15s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'var(--primary-glow)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent';
                                }}
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
                  style={{ marginTop: '1rem' }}
                >
                  Continue to Recording →
                </button>
              </div>
            )}

            {/* STEP 2: Record datasets */}
            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '800', fontFamily: 'Outfit, sans-serif' }}>Step 2: Capture Training Positions</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '140%' }}>
                  We need to record your body coordinates in the starting pose and the peak contraction pose.
                </p>

                {/* Start Pose Button */}
                <div className="glass-card" style={{ padding: '0.85rem', borderLeft: '3px solid var(--primary)' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: '800', marginBottom: '0.35rem' }}>1. Start Position</h4>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                    Hold your starting pose (e.g. arms down, deadlift stand).
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      onClick={() => startRecording('start')}
                      disabled={recordingMode || mpStatus !== 'loaded'}
                      className="btn btn-secondary"
                      style={{ padding: '0.45rem 0.85rem', fontSize: '0.75rem', width: 'auto' }}
                    >
                      Record Start Pose
                    </button>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: startFrames.length > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                      {startFrames.length > 0 ? `✓ Stored ${startFrames.length} frames` : 'Not recorded'}
                    </span>
                  </div>
                </div>

                {/* Peak Pose Button */}
                <div className="glass-card" style={{ padding: '0.85rem', borderLeft: '3px solid var(--secondary)' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: '800', marginBottom: '0.35rem' }}>2. Peak Position</h4>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                    Hold the peak pose (e.g. arms curled, deadlift bar at top).
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      onClick={() => startRecording('peak')}
                      disabled={recordingMode || mpStatus !== 'loaded'}
                      className="btn btn-secondary"
                      style={{ padding: '0.45rem 0.85rem', fontSize: '0.75rem', width: 'auto' }}
                    >
                      Record Peak Pose
                    </button>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: peakFrames.length > 0 ? 'var(--secondary)' : 'var(--text-muted)' }}>
                      {peakFrames.length > 0 ? `✓ Stored ${peakFrames.length} frames` : 'Not recorded'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setStep(3)}
                  disabled={startFrames.length === 0 || peakFrames.length === 0}
                  className="btn btn-primary"
                  style={{ marginTop: '1rem' }}
                >
                  Continue to Training →
                </button>
              </div>
            )}

            {/* STEP 3: Training model */}
            {step === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', textAlign: 'center', padding: '1rem 0' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '900', fontFamily: 'Outfit, sans-serif' }}>Step 3: Train AI Model</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '140%', maxWidth: '300px' }}>
                  We will compile a neural network directly in your browser and train it on your recorded movements.
                </p>

                {isTraining ? (
                  <div style={{ margin: '1.5rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    {/* Ring spinner */}
                    <div style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      border: '4px solid var(--border-light)',
                      borderTopColor: 'var(--primary)',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    <span style={{ fontSize: '0.95rem', fontWeight: '800' }}>Training: {trainingProgress}%</span>
                    {lossValue && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Loss: {lossValue}</span>}
                  </div>
                ) : (
                  <button
                    onClick={trainModel}
                    className="btn btn-primary"
                    style={{ padding: '0.85rem 2rem', marginTop: '1.5rem' }}
                  >
                    ⚡ Start local TF.js Training
                  </button>
                )}
              </div>
            )}

            {/* STEP 4: Success & Save */}
            {step === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', textAlign: 'center', padding: '1rem 0' }}>
                {/* Success Check */}
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'var(--primary-glow)',
                  border: '2px solid var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                  color: 'var(--primary)',
                  marginBottom: '0.5rem',
                  filter: 'drop-shadow(0 0 10px var(--primary-glow))'
                }}>
                  ✓
                </div>
                
                <h3 style={{ fontSize: '1.1rem', fontWeight: '900', fontFamily: 'Outfit, sans-serif' }}>Training Successful!</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '140%', maxWidth: '300px' }}>
                  The AI model is fully trained in WebGL memory and ready to deploy on your dashboard.
                </p>

                <button
                  onClick={handleSave}
                  className="btn btn-primary"
                  style={{ padding: '0.85rem 2rem', marginTop: '1.5rem', width: '100%' }}
                >
                  Save Exercise & Deploy
                </button>
              </div>
            )}

          </div>
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
