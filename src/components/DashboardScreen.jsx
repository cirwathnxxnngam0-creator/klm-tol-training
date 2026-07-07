import React, { useState, useEffect, useRef } from 'react';
import { exercises } from '../data/exercises';

export default function DashboardScreen({ onNavigate, refreshTrigger, onSelectExercise }) {
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [stats, setStats] = useState({});

  // Active manual workout session states
  const [sessionTimer, setSessionTimer] = useState(0);
  const [sets, setSets] = useState([]);
  const timerRef = useRef(null);

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
  }, [refreshTrigger, activeSession]);

  // Handle active manual workout timer
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

  const handleStartManualSession = (exercise) => {
    setSelectedExercise(null);
    const initialSets = Array.from({ length: exercise.defaultSets || 3 }, (_, i) => ({
      setId: i + 1,
      weight: exercise.defaultWeightKg || 10,
      reps: exercise.defaultReps || 10,
      completed: false
    }));
    setSets(initialSets);
    setActiveSession(exercise);
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
      sets: completedSets.map(s => ({ ...s, completed: true })),
      mode: 'Manual'
    };

    try {
      const stored = JSON.parse(localStorage.getItem('workout_history') || '[]');
      stored.unshift(newLog);
      localStorage.setItem('workout_history', JSON.stringify(stored));
      setActiveSession(null);
      alert('Manual workout logged successfully!');
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
    <div className="fade-in" style={{ width: '100%' }}>
      {/* Exercises List Hub */}
      {!activeSession && (
        <>
          <h2 style={{ fontSize: '1rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.75rem', fontWeight: '700' }}>
            Select Training Movement
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {exercises.map((ex) => {
              const exStat = stats[ex.id] || { totalWorkouts: 0, maxWeight: 0 };
              return (
                <div
                  key={ex.id}
                  className="glass-card"
                  style={{ cursor: 'pointer', transition: 'transform 0.2s', padding: '1.25rem' }}
                  onClick={() => setSelectedExercise(ex)}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: '700',
                      padding: '0.15rem 0.5rem',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--primary-glow)',
                      color: 'var(--primary)',
                      border: '1px solid hsla(var(--h-primary), 85%, 62%, 0.3)',
                      textTransform: 'uppercase'
                    }}>
                      {ex.category}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{ex.difficulty}</span>
                  </div>

                  <h3 style={{ fontSize: '1.2rem', fontWeight: '800', fontFamily: 'Outfit, sans-serif', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    {ex.name}
                  </h3>
                  
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '140%', marginBottom: '1rem' }}>
                    {ex.description}
                  </p>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
                    <div style={{ background: 'hsla(0, 0%, 100%, 0.02)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                      <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Workouts</span>
                      <div style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '0.1rem' }}>{exStat.totalWorkouts || 0}</div>
                    </div>

                    <div style={{ background: 'hsla(0, 0%, 100%, 0.02)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                      <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Personal Record</span>
                      <div style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--secondary)', marginTop: '0.1rem' }}>
                        {exStat.maxWeight ? `${exStat.maxWeight} kg` : '--'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="glass-card" style={{ marginTop: '1rem', background: 'var(--primary-glow)', borderColor: 'hsla(var(--h-primary), 85%, 62%, 0.25)', textAlign: 'center', padding: '1rem' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '140%' }}>
              💡 <strong>How it works:</strong> Click on a training card to view posture instructions, log sets manually, or launch the live camera to track your bone positions and angles!
            </p>
          </div>
        </>
      )}

      {/* Exercise Detail Modal Overlay */}
      {selectedExercise && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 200,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center'
        }} onClick={() => setSelectedExercise(null)}>
          
          <div 
            className="glass-card fade-in" 
            style={{
              width: '100%',
              maxWidth: '440px',
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              borderTopLeftRadius: 'var(--radius-lg)',
              borderTopRightRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--primary)', textTransform: 'uppercase' }}>
                  {selectedExercise.category}
                </span>
                <h2 style={{ fontSize: '1.4rem', fontWeight: '900', fontFamily: 'Outfit, sans-serif', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                  {selectedExercise.name}
                </h2>
              </div>
              <button 
                onClick={() => setSelectedExercise(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h4 style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Target Muscles</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{selectedExercise.targetMuscle}</p>
              </div>

              <div>
                <h4 style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Instructions</h4>
                <ol style={{ paddingLeft: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {selectedExercise.instructions.map((inst, idx) => (
                    <li key={idx} style={{ lineHeight: '140%' }}>{inst}</li>
                  ))}
                </ol>
              </div>

              <div>
                <h4 style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Pro Form Tips</h4>
                <ul style={{ paddingLeft: '1rem', fontSize: '0.8rem', color: 'hsl(var(--h-warning), 85%, 70%)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {selectedExercise.tips.map((tip, idx) => (
                    <li key={idx} style={{ lineHeight: '140%' }}>{tip}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Quick Action Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                onClick={() => handleStartManualSession(selectedExercise)}
                className="btn btn-secondary"
                style={{ padding: '0.75rem' }}
              >
                📝 Manual Log
              </button>
              <button
                onClick={() => {
                  setSelectedExercise(null);
                  if (onSelectExercise) onSelectExercise(selectedExercise.id);
                  onNavigate('camera'); // Switches to AI camera tab
                }}
                className="btn btn-primary"
                style={{ padding: '0.75rem' }}
              >
                📷 Start Live AI
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Manual Workout Session */}
      {activeSession && (
        <div className="glass-card fade-in" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
            <div>
              <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: '700', textTransform: 'uppercase' }}>Log Session</span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800', fontFamily: 'Outfit, sans-serif', color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                {activeSession.name}
              </h2>
            </div>
            <div style={{
              background: 'hsla(350, 80%, 55%, 0.12)',
              border: '1px solid hsla(350, 80%, 55%, 0.3)',
              color: 'var(--danger)',
              padding: '0.4rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '1rem',
              fontWeight: '700',
              fontFamily: 'monospace'
            }}>
              ⏱️ {formatTime(sessionTimer)}
            </div>
          </div>

          {/* Sets Config Box */}
          <div className="glass-card" style={{ padding: '0.75rem', marginBottom: '1.25rem', background: 'hsla(0, 0%, 100%, 0.01)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 2fr 1fr', fontSize: '0.65rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '0.5rem', textAlign: 'center' }}>
              <span>SET</span>
              <span>WEIGHT (KG)</span>
              <span>REPS</span>
              <span>DONE</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {sets.map((set, idx) => (
                <div
                  key={set.setId}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 2fr 2fr 1fr',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    background: set.completed ? 'var(--primary-glow)' : 'transparent',
                    border: set.completed ? '1px solid hsla(var(--h-primary), 85%, 62%, 0.3)' : '1px solid var(--border-light)'
                  }}
                >
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)' }}>#{set.setId}</span>
                  
                  <input
                    type="number"
                    value={set.weight}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setSets(prev => prev.map(s => s.setId === set.setId ? { ...s, weight: val } : s));
                    }}
                    className="input-field"
                    style={{ padding: '0.35rem', textAlign: 'center', fontSize: '0.8rem', margin: 0 }}
                  />
                  
                  <input
                    type="number"
                    value={set.reps}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setSets(prev => prev.map(s => s.setId === set.setId ? { ...s, reps: val } : s));
                    }}
                    className="input-field"
                    style={{ padding: '0.35rem', textAlign: 'center', fontSize: '0.8rem', margin: 0 }}
                  />

                  <button
                    onClick={() => {
                      setSets(prev => prev.map(s => s.setId === set.setId ? { ...s, completed: !s.completed } : s));
                    }}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      border: 'none',
                      cursor: 'pointer',
                      background: set.completed ? 'var(--primary)' : 'var(--bg-surface-elevated)',
                      color: set.completed ? '#fff' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      transition: 'all 0.15s'
                    }}
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
              className="btn btn-secondary"
              style={{ marginTop: '0.75rem', width: '100%', padding: '0.5rem', fontSize: '0.75rem' }}
            >
              + Add Next Set
            </button>
          </div>

          {/* Action Log Save / Discard */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              onClick={handleSaveManualSession}
              className="btn btn-primary"
              style={{ padding: '0.85rem' }}
            >
              💾 Save Session & Log
            </button>
            <button
              onClick={() => {
                if (confirm('Discard current workout session?')) {
                  setActiveSession(null);
                }
              }}
              className="btn btn-secondary"
              style={{ padding: '0.75rem', color: 'var(--danger)', borderColor: 'hsla(350, 80%, 55%, 0.15)' }}
            >
              Discard Session
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
