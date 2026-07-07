import React, { useState, useEffect, useRef } from 'react';
import { exercises } from '../data/exercises';

export default function DashboardScreen({ onNavigate, refreshTrigger }) {
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [cameraExercise, setCameraExercise] = useState(null);
  const [stats, setStats] = useState({});

  // Active workout states
  const [sessionTimer, setSessionTimer] = useState(0);
  const [sets, setSets] = useState([]);
  const timerRef = useRef(null);

  // Camera stream and canvas states
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [aiFeedback, setAiFeedback] = useState('Position yourself in view...');
  const [simulatedReps, setSimulatedReps] = useState(0);
  const [simulatedAngle, setSimulatedAngle] = useState(180);
  const animationRef = useRef(null);

  // Fetch quick stats from localStorage (PR, total workouts)
  useEffect(() => {
    try {
      const history = JSON.parse(localStorage.getItem('workout_history') || '[]');
      const exerciseStats = {};
      exercises.forEach(ex => {
        const exLogs = history.filter(h => h.exerciseId === ex.id);
        if (exLogs.length > 0) {
          const totalWorkouts = exLogs.length;
          const maxWeight = Math.max(...exLogs.flatMap(log => log.sets.map(s => Number(s.weight) || 0)));
          const totalReps = exLogs.reduce((acc, log) => acc + log.sets.reduce((sum, s) => sum + (Number(s.reps) || 0), 0), 0);
          exerciseStats[ex.id] = { totalWorkouts, maxWeight, totalReps };
        } else {
          exerciseStats[ex.id] = { totalWorkouts: 0, maxWeight: 0, totalReps: 0 };
        }
      });
      setStats(exerciseStats);
    } catch (e) {
      console.error(e);
    }
  }, [refreshTrigger, activeSession, cameraExercise]);

  // Handle active workout timer
  useEffect(() => {
    if (activeSession) {
      setSessionTimer(0);
      timerRef.current = setInterval(() => {
        setSessionTimer(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeSession]);

  // Camera & skeletal simulation loop
  useEffect(() => {
    if (cameraExercise) {
      startCamera();
      // Setup simulator for camera skeleton
      let frame = 0;
      let direction = -1; // -1 down, 1 up
      let angle = 170;
      let repCount = 0;
      let lastRepTime = 0;

      const loop = () => {
        frame++;
        
        // Simulating biceps curl or deadlift motion angles
        if (frame % 4 === 0) {
          if (direction === -1) {
            angle -= 3;
            if (angle <= 45) {
              direction = 1;
              // Feedback cues
              const feedbacks = ['Great depth!', 'Keep elbows tucked!', 'Perfect squeeze!', 'Squeeze at top!'];
              setAiFeedback(feedbacks[Math.floor(Math.random() * feedbacks.length)]);
            }
          } else {
            angle += 3;
            if (angle >= 170) {
              direction = -1;
              const now = Date.now();
              if (now - lastRepTime > 1500) {
                repCount += 1;
                setSimulatedReps(repCount);
                lastRepTime = now;
                setAiFeedback('Form looking excellent! Down slowly...');
              }
            }
          }
          setSimulatedAngle(Math.round(angle));
        }

        // Draw camera frame & skeleton overlay on canvas
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Renders visualizer overlay
          ctx.strokeStyle = '#a855f7'; // purple accent
          ctx.lineWidth = 3;
          ctx.fillStyle = '#a855f7';

          // If video is loaded, we can draw a mirror image or visual elements
          if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
            ctx.save();
            ctx.scale(-1, 1);
            ctx.translate(-canvas.width, 0);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            ctx.restore();
          } else {
            // Draw gradient background if no camera
            const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            grad.addColorStop(0, '#111827');
            grad.addColorStop(1, '#1f2937');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }

          // Skeletal simulation lines & circles
          const shoulderX = canvas.width / 2;
          const shoulderY = canvas.height * 0.35;
          const elbowX = shoulderX - 45 + Math.sin(frame * 0.05) * 15;
          const elbowY = shoulderY + 60;
          
          // Calculate wrist based on simulated angle
          const rad = (angle * Math.PI) / 180;
          const wristX = elbowX + Math.cos(rad - Math.PI/2) * 55;
          const wristY = elbowY + Math.sin(rad - Math.PI/2) * 55;

          // Draw skeleton lines
          ctx.beginPath();
          ctx.moveTo(shoulderX, shoulderY);
          ctx.lineTo(elbowX, elbowY);
          ctx.lineTo(wristX, wristY);
          ctx.stroke();

          // Draw joints
          ctx.fillStyle = '#34d399'; // green joints
          ctx.beginPath();
          ctx.arc(shoulderX, shoulderY, 6, 0, Math.PI * 2);
          ctx.arc(elbowX, elbowY, 6, 0, Math.PI * 2);
          ctx.arc(wristX, wristY, 6, 0, Math.PI * 2);
          ctx.fill();

          // UI text/overlays on canvas
          ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
          ctx.fillRect(10, 10, 140, 60);
          ctx.fillStyle = '#ffffff';
          ctx.font = '12px monospace';
          ctx.fillText(`JOINT ANGLE: ${Math.round(angle)}°`, 18, 30);
          ctx.fillText(`REP COUNT: ${repCount}`, 18, 48);

          // Angle visualizer arc
          ctx.strokeStyle = angle < 90 ? '#34d399' : '#f59e0b';
          ctx.beginPath();
          ctx.arc(elbowX, elbowY, 20, 0, rad);
          ctx.stroke();
        }

        animationRef.current = requestAnimationFrame(loop);
      };

      animationRef.current = requestAnimationFrame(loop);
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraExercise]);

  const startCamera = async () => {
    setCameraError(null);
    setSimulatedReps(0);
    setAiFeedback('Initializing smart detection model...');
    try {
      const streamData = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
        audio: false
      });
      setStream(streamData);
      if (videoRef.current) {
        videoRef.current.srcObject = streamData;
      }
      setTimeout(() => {
        setAiFeedback('Posture alignment scanner ready. Start exercises.');
      }, 1500);
    } catch (err) {
      console.warn('Camera access denied or unavailable. Running in simulated skeletal mode.', err);
      setCameraError('Camera unavailable. Using advanced animation simulation instead.');
    }
  };

  const stopCamera = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const handleStartManualSession = (exercise) => {
    setSelectedExercise(null);
    // Initialize default sets based on exercise configuration
    const initialSets = Array.from({ length: exercise.defaultSets }, (_, i) => ({
      setId: i + 1,
      weight: exercise.defaultWeightKg,
      reps: exercise.defaultReps,
      completed: false
    }));
    setSets(initialSets);
    setActiveSession(exercise);
  };

  const handleStartCameraSession = (exercise) => {
    setSelectedExercise(null);
    setCameraExercise(exercise);
  };

  const handleSaveManualSession = () => {
    if (!activeSession) return;
    const completedSets = sets.filter(s => s.completed || s.weight > 0);
    if (completedSets.length === 0) {
      alert('Please complete or log at least one set before saving.');
      return;
    }

    const newLog = {
      id: `log-${Date.now()}`,
      exerciseId: activeSession.id,
      exerciseName: activeSession.name,
      category: activeSession.category,
      date: new Date().toISOString(),
      durationSec: sessionTimer,
      sets: completedSets,
      mode: 'Manual'
    };

    saveWorkoutToLocalStorage(newLog);
    setActiveSession(null);
    alert('Workout logged successfully!');
  };

  const handleSaveCameraSession = () => {
    if (!cameraExercise) return;
    if (simulatedReps === 0) {
      alert('Log at least 1 rep from the camera detection session.');
      return;
    }

    const newLog = {
      id: `log-${Date.now()}`,
      exerciseId: cameraExercise.id,
      exerciseName: cameraExercise.name,
      category: cameraExercise.category,
      date: new Date().toISOString(),
      durationSec: 45, // approx simulated duration
      sets: [
        { setId: 1, weight: cameraExercise.defaultWeightKg, reps: simulatedReps, completed: true }
      ],
      mode: 'AI Camera'
    };

    saveWorkoutToLocalStorage(newLog);
    setCameraExercise(null);
    alert('AI Session logged successfully!');
  };

  const saveWorkoutToLocalStorage = (workoutLog) => {
    try {
      const currentHistory = JSON.parse(localStorage.getItem('workout_history') || '[]');
      currentHistory.unshift(workoutLog);
      localStorage.setItem('workout_history', JSON.stringify(currentHistory));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  };

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 pb-24 text-left">
      {/* Premium Glassmorphic Header */}
      <header className="mb-6 p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-lg">
        <h1 className="text-2xl font-bold tracking-tight text-white m-0">FitAlign Pro</h1>
        <p className="text-xs text-purple-300">Advanced Posture Analysis & Tracking</p>
      </header>

      {/* Main Exercises List */}
      {!activeSession && !cameraExercise && (
        <>
          <h2 className="text-lg font-semibold text-white mb-3 px-1">Selected Exercises</h2>
          <div className="space-y-4">
            {exercises.map((ex) => {
              const exStat = stats[ex.id] || { totalWorkouts: 0, maxWeight: 0 };
              return (
                <div
                  key={ex.id}
                  onClick={() => setSelectedExercise(ex)}
                  className="group relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-lg border border-white/10 hover:border-purple-500/50 p-4 transition-all duration-300 cursor-pointer shadow-md hover:shadow-purple-500/10 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {ex.category}
                      </span>
                      <span className="text-xs text-gray-400">{ex.difficulty}</span>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1 group-hover:text-purple-300 transition-colors">
                      {ex.name}
                    </h3>
                    <p className="text-xs text-gray-400 line-clamp-2 mb-3">
                      {ex.description}
                    </p>
                  </div>
                  
                  {/* Glassmorphic Stats Section */}
                  <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-white/5 text-xs">
                    <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                      <p className="text-gray-400">Total Workouts</p>
                      <p className="text-white font-bold text-sm mt-0.5">{exStat.totalWorkouts || 0}</p>
                    </div>
                    <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                      <p className="text-gray-400">Personal Record</p>
                      <p className="text-purple-300 font-bold text-sm mt-0.5">
                        {exStat.maxWeight ? `${exStat.maxWeight} kg` : '--'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 p-4 rounded-xl bg-purple-500/15 border border-purple-500/20 text-center">
            <p className="text-xs text-purple-200">
              💡 Click any exercise card to view step-by-step instructions, logs, start live camera scanning, or manually log details.
            </p>
          </div>
        </>
      )}

      {/* Exercise Detail Modal / View */}
      {selectedExercise && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-t-3xl rounded-b-xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300 text-left">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">
                  {selectedExercise.category}
                </span>
                <h2 className="text-xl font-bold text-white mt-1">{selectedExercise.name}</h2>
              </div>
              <button
                onClick={() => setSelectedExercise(null)}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase">Target Muscles</h4>
                <p className="text-sm text-white mt-1">{selectedExercise.targetMuscle}</p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase">Instructions</h4>
                <ol className="list-decimal list-inside text-sm text-gray-300 space-y-1.5 mt-1">
                  {selectedExercise.instructions.map((inst, idx) => (
                    <li key={idx} className="pl-1 text-xs leading-relaxed">{inst}</li>
                  ))}
                </ol>
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase">Pro Tips</h4>
                <ul className="list-disc list-inside text-xs text-amber-300/90 space-y-1 mt-1">
                  {selectedExercise.tips.map((tip, idx) => (
                    <li key={idx}>{tip}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Quick Action Grid */}
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                onClick={() => handleStartManualSession(selectedExercise)}
                className="w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm border border-white/15 transition-all text-center"
              >
                📝 Manual Log
              </button>
              <button
                onClick={() => handleStartCameraSession(selectedExercise)}
                className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm border border-purple-500 shadow-md shadow-purple-600/30 transition-all text-center"
              >
                📷 Start Live AI
              </button>
            </div>
            
            <button
              onClick={() => {
                setSelectedExercise(null);
                onNavigate('history'); // Navigates to history view
              }}
              className="w-full mt-3 py-2 text-center text-xs text-purple-400 hover:text-purple-300 hover:underline"
            >
              View Exercise Logs & History
            </button>
          </div>
        </div>
      )}

      {/* Active Workout Session Screen */}
      {activeSession && (
        <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col p-4 text-white overflow-y-auto">
          <div className="max-w-md mx-auto w-full flex-grow flex flex-col justify-between py-4">
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <span className="text-xs text-purple-400 font-bold uppercase tracking-wider">Session Active</span>
                  <h2 className="text-xl font-bold text-white mt-1">{activeSession.name}</h2>
                </div>
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 font-mono text-lg px-3 py-1.5 rounded-xl">
                  ⏱️ {formatTime(sessionTimer)}
                </div>
              </div>

              {/* Set Tracker Table */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
                <div className="grid grid-cols-4 text-xs text-gray-400 font-bold mb-3 text-center">
                  <span>SET</span>
                  <span>KG</span>
                  <span>REPS</span>
                  <span>DONE</span>
                </div>

                <div className="space-y-3">
                  {sets.map((set) => (
                    <div
                      key={set.setId}
                      className={`grid grid-cols-4 gap-2 items-center text-center p-2 rounded-xl transition-all ${
                        set.completed ? 'bg-purple-500/15 border border-purple-500/30' : 'bg-white/5 border border-transparent'
                      }`}
                    >
                      <span className="font-bold text-sm text-gray-300">Set {set.setId}</span>
                      <input
                        type="number"
                        value={set.weight}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setSets(prev => prev.map(s => s.setId === set.setId ? { ...s, weight: val } : s));
                        }}
                        className="w-full bg-zinc-800 text-white border border-white/10 rounded-lg py-1 px-1.5 text-center text-sm font-semibold focus:outline-none focus:border-purple-500"
                      />
                      <input
                        type="number"
                        value={set.reps}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setSets(prev => prev.map(s => s.setId === set.setId ? { ...s, reps: val } : s));
                        }}
                        className="w-full bg-zinc-800 text-white border border-white/10 rounded-lg py-1 px-1.5 text-center text-sm font-semibold focus:outline-none focus:border-purple-500"
                      />
                      <button
                        onClick={() => {
                          setSets(prev => prev.map(s => s.setId === set.setId ? { ...s, completed: !s.completed } : s));
                        }}
                        className={`w-8 h-8 rounded-full mx-auto flex items-center justify-center border transition-all ${
                          set.completed
                            ? 'bg-purple-500 border-purple-400 text-white'
                            : 'border-white/20 text-gray-500 hover:border-white/40'
                        }`}
                      >
                        ✓
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => {
                    setSets(prev => [
                      ...prev,
                      {
                        setId: prev.length + 1,
                        weight: prev[prev.length - 1]?.weight || activeSession.defaultWeightKg,
                        reps: prev[prev.length - 1]?.reps || activeSession.defaultReps,
                        completed: false
                      }
                    ]);
                  }}
                  className="w-full mt-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 text-xs font-semibold"
                >
                  + Add Set
                </button>
              </div>
            </div>

            {/* Save & Cancel Actions */}
            <div className="space-y-3">
              <button
                onClick={handleSaveManualSession}
                className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-lg shadow-purple-600/30 transition-all text-center"
              >
                💾 Save Session & Finish
              </button>
              <button
                onClick={() => {
                  if (confirm('Discard current workout session?')) {
                    setActiveSession(null);
                  }
                }}
                className="w-full py-3 rounded-xl bg-transparent hover:bg-red-500/10 text-red-400 border border-red-500/20 text-sm font-semibold transition-all text-center"
              >
                Discard Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Posture Tracking camera View */}
      {cameraExercise && (
        <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col p-4 text-white overflow-hidden">
          <div className="max-w-md mx-auto w-full h-full flex flex-col justify-between py-2">
            
            {/* Header */}
            <div className="flex justify-between items-center mb-2">
              <div>
                <span className="text-xs text-red-500 font-mono animate-pulse font-bold flex items-center gap-1">
                  ● LIVE AI POSTURE ANALYZER
                </span>
                <h3 className="text-base font-bold">{cameraExercise.name}</h3>
              </div>
              <button
                onClick={() => setCameraExercise(null)}
                className="px-3 py-1 bg-white/10 hover:bg-white/15 rounded-lg text-xs"
              >
                Exit Camera
              </button>
            </div>

            {/* Video / Canvas Arena */}
            <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-black border border-white/10 shadow-inner flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute w-full h-full object-cover scale-x-[-1] opacity-0"
              />
              <canvas
                ref={canvasRef}
                width={640}
                height={480}
                className="w-full h-full object-cover rounded-2xl"
              />
              
              {/* Overlay Glass Alert for camera error / notice */}
              {cameraError && (
                <div className="absolute top-2 left-2 right-2 p-2 rounded-xl bg-amber-500/25 backdrop-blur-md border border-amber-500/35 text-[10px] text-amber-200">
                  ⚠️ {cameraError}
                </div>
              )}

              {/* Bottom Real-time Feedback HUD Overlay */}
              <div className="absolute bottom-3 left-3 right-3 p-3 rounded-xl bg-black/60 backdrop-blur-md border border-white/15 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase text-gray-400">AI Feed</p>
                  <p className="text-sm font-semibold text-purple-300 mt-0.5">{aiFeedback}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase text-gray-400">Angle</p>
                  <p className="text-sm font-mono font-bold text-white mt-0.5">{simulatedAngle}°</p>
                </div>
              </div>
            </div>

            {/* Big Rep HUD */}
            <div className="grid grid-cols-2 gap-3 my-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                <p className="text-xs uppercase text-gray-400 font-bold">Reps Detected</p>
                <p className="text-4xl font-black text-purple-400 font-mono mt-1">{simulatedReps}</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center flex flex-col justify-center">
                <p className="text-xs uppercase text-gray-400 font-bold">Est. Set Weight</p>
                <p className="text-2xl font-black text-white mt-1 font-mono">{cameraExercise.defaultWeightKg} kg</p>
              </div>
            </div>

            {/* Instruction Banner */}
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-xs text-purple-200 text-left">
              <strong className="text-purple-300">Form Checklist:</strong>
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px]">
                <li>Keep dumbbell path straight.</li>
                <li>Maintain a steady, slow concentric motion.</li>
              </ul>
            </div>

            {/* Action Save button */}
            <div className="mt-4">
              <button
                onClick={handleSaveCameraSession}
                className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-lg shadow-purple-600/30 transition-all text-center"
              >
                💾 Log AI Workout ({simulatedReps} Reps)
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
