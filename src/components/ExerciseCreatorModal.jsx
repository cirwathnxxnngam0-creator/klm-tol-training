import React, { useState, useEffect, useRef } from 'react';
import { loadCustomExercises } from '../data/exercises';

export default function ExerciseCreatorModal({ onClose, onSaveComplete }) {
  const [step, setStep] = useState(1);
  const [exerciseName, setExerciseName] = useState('');
  const [category, setCategory] = useState('Custom Exercise');
  const [selectedMuscles, setSelectedMuscles] = useState([]);
  const [muscleSearch, setMuscleSearch] = useState('');
  
  // Camera & Tracking states
  const cameraActive = step === 2 || step === 3;
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

  // Video and Canvas refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
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

  // Load MediaPipe Pose
  // Load MediaPipe Pose (check window first to prevent double-loader issues)
  useEffect(() => {
    if (cameraActive) {
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
  }, [cameraActive, mpStatus]);

  // Load TensorFlow.js (check window first to prevent double-loader issues)
  useEffect(() => {
    if (cameraActive) {
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
  }, [cameraActive, tfStatus]);

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
                // Auto transition to next page
                setTimeout(() => {
                  setStep(3);
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
                // Auto transition to next page
                setTimeout(() => {
                  setStep(4);
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
      model.dispose();

      setIsTraining(false);
      // Auto transition to final step
      setStep(5);
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
            Create Exercise ({step}/5)
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
                Start Recording →
              </button>
            </div>
          )}

          {/* STEPS 2 & 3: Camera Capture Wizard Pages (Permanently mounted camera DOM to prevent unmounting/webcam drop) */}
          {(step === 2 || step === 3) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flexGrow: 1 }}>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '800', fontFamily: 'Outfit, sans-serif', margin: '0 0 0.25rem' }}>
                  {step === 2 ? '1. Start Position' : '2. Peak Position'}
                </h3>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>
                  {step === 2 
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
                  onClick={() => startRecording(step === 2 ? 'start' : 'peak')}
                  disabled={recordingMode || mpStatus !== 'loaded'}
                  className="btn btn-primary"
                  style={{ 
                    padding: '0.75rem', 
                    background: step === 2 ? 'var(--primary)' : 'var(--secondary)', 
                    borderColor: step === 2 ? 'var(--primary)' : 'var(--secondary)' 
                  }}
                >
                  {recordingMode 
                    ? 'Recording...' 
                    : (step === 2 ? 'Record Start Pose' : 'Record Peak Pose')}
                </button>
                <button 
                  onClick={() => setStep(step === 2 ? 1 : 2)} 
                  disabled={recordingMode} 
                  className="btn btn-secondary" 
                  style={{ padding: '0.5rem', fontSize: '0.75rem' }}
                >
                  {step === 2 ? '← Back to Details' : '← Back to Start Pose'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Train AI Model */}
          {step === 4 && (
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

          {/* STEP 5: Success & Save */}
          {step === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center', textAlign: 'center', justifyContent: 'center', flexGrow: 1, padding: '1rem 0' }}>
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
                filter: 'drop-shadow(0 0 10px var(--primary-glow))'
              }}>
                ✓
              </div>

              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '900', fontFamily: 'Outfit, sans-serif', margin: '0 0 0.35rem' }}>AI Classifier Ready!</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '140%', margin: 0 }}>
                  Successfully trained custom model in WebGL memory. Click save to publish this exercise to your dashboard.
                </p>
              </div>

              <div style={{ width: '100%', background: 'hsla(0,0%,100%,0.02)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-light)', textAlign: 'left', fontSize: '0.75rem' }}>
                <div style={{ marginBottom: '0.25rem' }}><strong style={{ color: 'var(--text-secondary)' }}>Name:</strong> {exerciseName}</div>
                <div style={{ marginBottom: '0.25rem' }}><strong style={{ color: 'var(--text-secondary)' }}>Category:</strong> {category}</div>
                <div><strong style={{ color: 'var(--text-secondary)' }}>Target Muscles:</strong> {selectedMuscles.join(', ') || 'General Muscles'}</div>
              </div>

              <button
                onClick={handleSave}
                className="btn btn-primary"
                style={{ padding: '0.85rem', width: '100%', marginTop: '1rem' }}
              >
                Save & Deploy Exercise
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
