import React, { useState, useEffect } from 'react';
import { exercises } from '../data/exercises';

const PlusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', marginRight: '4px', verticalAlign: 'middle' }}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const DumbbellCurlIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)', flexShrink: 0 }}>
    <rect x="3" y="6" width="4" height="12" rx="1.5" fill="currentColor" opacity="0.8" />
    <rect x="7" y="9" width="2" height="6" rx="0.5" fill="currentColor" />
    <line x1="9" y1="12" x2="15" y2="12" stroke="currentColor" strokeWidth="3" />
    <rect x="15" y="9" width="2" height="6" rx="0.5" fill="currentColor" />
    <rect x="17" y="6" width="4" height="12" rx="1.5" fill="currentColor" opacity="0.8" />
  </svg>
);

const DeadliftBarbellIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--secondary)', flexShrink: 0 }}>
    <line x1="2" y1="19" x2="22" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="4" y1="13" x2="20" y2="13" stroke="currentColor" strokeWidth="2.5" />
    <rect x="5" y="7" width="2" height="12" rx="1" fill="currentColor" />
    <rect x="7" y="5" width="2" height="16" rx="1" fill="currentColor" opacity="0.9" />
    <rect x="15" y="5" width="2" height="16" rx="1" fill="currentColor" opacity="0.9" />
    <rect x="17" y="7" width="2" height="12" rx="1" fill="currentColor" />
  </svg>
);

const ExerciseHistoryGraph = ({ logs }) => {
  if (!logs || logs.length < 2) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center', padding: '1.25rem 1rem', background: 'hsla(0,0%,100%,0.02)', borderRadius: '8px', border: '1px dashed var(--border-light)', marginBottom: '1rem' }}>
        Log at least 2 sessions to display trend graph.
      </div>
    );
  }

  const chronLogs = [...logs].reverse();
  
  const weights = chronLogs.map(log => Math.max(...log.sets.map(s => s.weight || 0)));
  const reps = chronLogs.map(log => log.sets.reduce((sum, s) => sum + (s.reps || 0), 0));
  const intensities = chronLogs.map(log => log.sets.reduce((sum, s) => sum + ((s.weight || 0) * (s.reps || 0)), 0));

  const maxW = Math.max(...weights) || 1;
  const maxR = Math.max(...reps) || 1;
  const maxI = Math.max(...intensities) || 1;

  const width = 340;
  const height = 130;
  const paddingX = 25;
  const paddingY = 20;

  const points = chronLogs.map((log, idx) => {
    const x = paddingX + (idx * (width - 2 * paddingX)) / (chronLogs.length - 1);
    
    const wVal = Math.max(...log.sets.map(s => s.weight || 0));
    const yW = height - paddingY - (wVal / maxW) * (height - 2 * paddingY);

    const rVal = log.sets.reduce((sum, s) => sum + (s.reps || 0), 0);
    const rawYR = height - paddingY - (rVal / maxR) * (height - 2 * paddingY);

    const iVal = log.sets.reduce((sum, s) => sum + ((s.weight || 0) * (s.reps || 0)), 0);
    const rawYI = height - paddingY - (iVal / maxI) * (height - 2 * paddingY);

    // Apply minor offset if they overlap exactly to keep both lines visible
    const overlap = Math.abs(rawYR - rawYI) < 1.5;
    const yR = overlap ? rawYR - 2.5 : rawYR;
    const yI = overlap ? rawYI + 2.5 : rawYI;

    return { x, yW, yR, yI };
  });

  const pathW = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yW}`).join(' ');
  const pathR = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yR}`).join(' ');
  const pathI = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yI}`).join(' ');

  return (
    <div style={{ background: 'hsla(0,0%,0%,0.3)', padding: '12px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '0.6rem', color: 'var(--text-secondary)', marginBottom: '12px', padding: '0 4px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ width: '8px', height: '2px', background: 'var(--primary)', display: 'inline-block' }}></span>
            Weight ({maxW}kg)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ width: '8px', height: '2px', background: 'var(--secondary)', display: 'inline-block' }}></span>
            Reps ({maxR})
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ width: '8px', height: '2px', background: 'var(--warning)', display: 'inline-block' }}></span>
            Intensity ({maxI}kg)
          </span>
        </div>
        <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{chronLogs.length} logs</span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ overflow: 'visible' }}>
        <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="rgba(255,255,255,0.02)" strokeWidth="1" strokeDasharray="3 3" />
        <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

        <path d={pathW} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 3px var(--primary-glow))' }} />
        <path d={pathR} fill="none" stroke="var(--secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 3px var(--secondary-glow))' }} />
        <path d={pathI} fill="none" stroke="var(--warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 3px rgba(245,158,11,0.25))' }} />

        {points.map((p, idx) => (
          <g key={idx}>
            <circle cx={p.x} cy={p.yW} r="3" fill="#ffffff" stroke="var(--primary)" strokeWidth="1.5" />
            <circle cx={p.x} cy={p.yR} r="3" fill="#ffffff" stroke="var(--secondary)" strokeWidth="1.5" />
            <circle cx={p.x} cy={p.yI} r="3" fill="#ffffff" stroke="var(--warning)" strokeWidth="1.5" />
          </g>
        ))}
      </svg>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', padding: '0 8px' }}>
        {points.map((p, idx) => (
          <span key={idx} style={{ fontSize: '0.55rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {new Date(chronLogs[idx].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        ))}
      </div>
    </div>
  );
};

export default function HistoryView({ refreshTrigger, onRefresh }) {
  const [history, setHistory] = useState([]);
  const [filterExercise, setFilterExercise] = useState('all');
  const [showManualLogModal, setShowManualLogModal] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState(null);

  // Manual logging form states
  const [selectedExId, setSelectedExId] = useState(exercises[0]?.id || '');
  const [logDate, setLogDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [logTime, setLogTime] = useState(() => {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  });
  const [setsInput, setSetsInput] = useState([
    { weight: 10, reps: 10 }
  ]);

  // Load history from localStorage
  const loadHistory = () => {
    try {
      const stored = localStorage.getItem('workout_history');
      if (stored) {
        setHistory(JSON.parse(stored));
      } else {
        setHistory([]);
      }
    } catch (e) {
      console.error('Failed to parse workout history', e);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [refreshTrigger]);

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear your workout history? This action is permanent.')) {
      localStorage.removeItem('workout_history');
      loadHistory();
      if (onRefresh) onRefresh();
    }
  };

  const handleAddManualLog = (e) => {
    e.preventDefault();
    const selectedEx = exercises.find(ex => ex.id === selectedExId);
    if (!selectedEx) return;

    if (setsInput.length === 0) {
      alert('Please add at least one set.');
      return;
    }

    const logDateTime = new Date(`${logDate}T${logTime || '12:00'}`);

    const newLog = {
      id: `log-${Date.now()}`,
      exerciseId: selectedEx.id,
      exerciseName: selectedEx.name,
      category: selectedEx.category,
      date: logDateTime.toISOString(),
      durationSec: setsInput.length * 90, // mock duration (90s per set)
      sets: setsInput.map((s, idx) => ({
        setId: idx + 1,
        weight: Number(s.weight) || 0,
        reps: Number(s.reps) || 0,
        completed: true
      })),
      mode: 'Manual'
    };

    try {
      const stored = JSON.parse(localStorage.getItem('workout_history') || '[]');
      stored.unshift(newLog);
      localStorage.setItem('workout_history', JSON.stringify(stored));
      loadHistory();
      if (onRefresh) onRefresh();
      setShowManualLogModal(false);
      // Reset form
      setSetsInput([{ weight: selectedEx.defaultWeightKg || 10, reps: selectedEx.defaultReps || 10 }]);
      alert('Manual workout logged successfully!');
    } catch (err) {
      console.error(err);
    }
  };

  const addSetToForm = () => {
    const lastSet = setsInput[setsInput.length - 1] || { weight: 10, reps: 10 };
    setSetsInput(prev => [...prev, { ...lastSet }]);
  };

  const removeSetFromForm = (idx) => {
    if (setsInput.length <= 1) return;
    setSetsInput(prev => prev.filter((_, i) => i !== idx));
  };

  const updateSetInForm = (idx, field, val) => {
    setSetsInput(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s));
  };

  // Filter history based on select dropdown
  const filteredHistory = filterExercise === 'all'
    ? history
    : history.filter(log => log.exerciseId === filterExercise);

  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fade-in" style={{ width: '100%' }}>
      {/* Header Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>View your past workout sets & stats</p>
        </div>
        
        <button
          onClick={() => setShowManualLogModal(true)}
          className="btn btn-primary"
          style={{ width: 'auto', padding: '0.5rem 0.85rem', fontSize: '0.75rem', fontWeight: '700', display: 'flex', alignItems: 'center' }}
        >
          <PlusIcon /> Add Log
        </button>
      </div>

      {/* Filter and Reset Row */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
        <select
          value={filterExercise}
          onChange={(e) => setFilterExercise(e.target.value)}
          className="input-field"
          style={{ flexGrow: 1, padding: '0.5rem', fontSize: '0.75rem', margin: 0 }}
        >
          <option value="all">All Exercises</option>
          {exercises.map(ex => (
            <option key={ex.id} value={ex.id}>{ex.name}</option>
          ))}
        </select>

        {history.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="btn btn-secondary"
            style={{ width: 'auto', padding: '0.5rem 0.85rem', fontSize: '0.75rem', color: 'var(--danger)', borderColor: 'hsla(350, 80%, 55%, 0.15)' }}
          >
            Clear All
          </button>
        )}
      </div>

      {/* History Items List */}
      {filteredHistory.length === 0 ? (
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '0.85rem' }}>No workout sessions logged yet.</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '0.5rem', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setShowManualLogModal(true)}>
            Add your first manual log to get started.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {(filterExercise === 'all' ? exercises : exercises.filter(ex => ex.id === filterExercise)).map((ex) => {
            const exLogs = history.filter(h => h.exerciseId === ex.id);
            return (
              <div key={ex.id} className="glass-card" style={{ padding: '1.25rem' }}>
                {/* Category tag */}
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
                </div>

                {/* Title & Icon */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  {ex.id === 'dumbbell-hammer-curl' ? <DumbbellCurlIcon /> : <DeadliftBarbellIcon />}
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '800', fontFamily: 'Outfit, sans-serif', color: 'var(--text-primary)', margin: 0 }}>
                    {ex.name}
                  </h3>
                </div>

                {/* Graph Trend */}
                <ExerciseHistoryGraph logs={exLogs} />

                {/* Session breakdown list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
                  {exLogs.length === 0 ? (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem' }}>No sessions logged yet</div>
                  ) : (
                    exLogs.map((log) => {
                      const totalReps = log.sets.reduce((sum, s) => sum + s.reps, 0);
                      const maxWeight = Math.max(...log.sets.map(s => s.weight || 0));
                      return (
                        <div key={log.id} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.5rem 0.75rem',
                          background: 'hsla(0, 0%, 100%, 0.02)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-light)',
                          fontSize: '0.75rem'
                        }}>
                          <div>
                            <span style={{ fontSize: '0.6rem', padding: '0.1rem 0.35rem', borderRadius: '4px', background: log.mode === 'AI Camera' ? 'var(--primary-glow)' : 'var(--bg-surface-elevated)', color: log.mode === 'AI Camera' ? 'var(--primary)' : 'var(--text-secondary)', marginRight: '6px', fontWeight: '700' }}>
                              {log.mode}
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{formatDate(log.date)}</span>
                          </div>
                          <div style={{ fontWeight: '700', color: 'var(--text-primary)', textAlign: 'right' }}>
                            {maxWeight}kg • {totalReps}r • {log.durationSec}s{log.rir !== undefined ? ` • RIR ${log.rir}` : ''}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manual Entry Dialog Overlay */}
      {showManualLogModal && (
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
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }} onClick={() => setShowManualLogModal(false)}>
          
          <form
            onSubmit={handleAddManualLog}
            className="glass-card fade-in"
            style={{ width: '100%', maxWidth: '380px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '950', fontFamily: 'Outfit, sans-serif' }}>Log Workout</h2>
              <button
                type="button"
                onClick={() => setShowManualLogModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Selector */}
            <div className="input-group">
              <label className="input-label">Exercise</label>
              <select
                value={selectedExId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedExId(val);
                  const selectedEx = exercises.find(ex => ex.id === val);
                  if (selectedEx) {
                    setSetsInput([{ weight: selectedEx.defaultWeightKg || 10, reps: selectedEx.defaultReps || 10 }]);
                  }
                }}
                className="input-field"
                style={{ margin: 0, padding: '0.6rem' }}
              >
                {exercises.map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>
            </div>

            {/* Date Time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="input-group">
                <label className="input-label">Date</label>
                <input
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="input-field"
                  style={{ margin: 0, padding: '0.5rem' }}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Time</label>
                <input
                  type="time"
                  value={logTime}
                  onChange={(e) => setLogTime(e.target.value)}
                  className="input-field"
                  style={{ margin: 0, padding: '0.5rem' }}
                  required
                />
              </div>
            </div>

            {/* Dynamic Sets Inputs */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label className="input-label" style={{ margin: 0 }}>Reps & Weights</label>
                <button
                  type="button"
                  onClick={addSetToForm}
                  style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                >
                  + Add Set
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '160px', overflowY: 'auto', paddingRight: '4px' }}>
                {setsInput.map((s, index) => (
                  <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700', width: '36px' }}>Set {index + 1}</span>
                    
                    <input
                      type="number"
                      placeholder="kg"
                      value={s.weight}
                      onChange={(e) => updateSetInForm(index, 'weight', e.target.value)}
                      className="input-field"
                      style={{ padding: '0.4rem', fontSize: '0.75rem', textAlign: 'center', width: '60px', margin: 0 }}
                      required
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>kg</span>
                    
                    <input
                      type="number"
                      placeholder="reps"
                      value={s.reps}
                      onChange={(e) => updateSetInForm(index, 'reps', e.target.value)}
                      className="input-field"
                      style={{ padding: '0.4rem', fontSize: '0.75rem', textAlign: 'center', width: '60px', margin: 0 }}
                      required
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>reps</span>

                    {setsInput.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSetFromForm(index)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.85rem', marginLeft: 'auto' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ marginTop: '0.5rem', padding: '0.85rem' }}
            >
              Save Workout Log
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
