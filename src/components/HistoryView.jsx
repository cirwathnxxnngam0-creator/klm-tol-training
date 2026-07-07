import React, { useState, useEffect } from 'react';
import { exercises } from '../data/exercises';

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
          <h2 style={{ fontSize: '1.25rem', fontWeight: '800', fontFamily: 'Outfit, sans-serif' }}>Workout History</h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>View your past workout sets & stats</p>
        </div>
        
        <button
          onClick={() => setShowManualLogModal(true)}
          className="btn btn-primary"
          style={{ width: 'auto', padding: '0.5rem 0.85rem', fontSize: '0.75rem', fontWeight: '700' }}
        >
          ➕ Add Log
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredHistory.map((log) => {
            const isExpanded = expandedLogId === log.id;
            const totalVolume = log.sets.reduce((sum, s) => sum + (s.weight * s.reps), 0);
            const totalReps = log.sets.reduce((sum, s) => sum + s.reps, 0);

            return (
              <div
                key={log.id}
                className="glass-card"
                style={{ padding: '1rem', cursor: 'pointer' }}
                onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.25rem' }}>
                      <span style={{
                        fontSize: '0.6rem',
                        fontWeight: '700',
                        padding: '0.1rem 0.4rem',
                        borderRadius: 'var(--radius-full)',
                        background: log.mode === 'AI Camera' ? 'var(--primary-glow)' : 'var(--bg-surface-elevated)',
                        color: log.mode === 'AI Camera' ? 'var(--primary)' : 'var(--text-secondary)',
                        border: '1px solid var(--border-light)',
                        textTransform: 'uppercase'
                      }}>
                        {log.mode}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{formatDate(log.date)}</span>
                    </div>

                    <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                      {log.exerciseName}
                    </h3>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'right' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--secondary)' }}>{log.sets.length} sets</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                        {totalReps} reps • {totalVolume} kg
                      </div>
                    </div>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Expanded set breakdown */}
                {isExpanded && (
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', fontSize: '0.65rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '0.35rem', textAlign: 'center' }}>
                      <span>SET</span>
                      <span>WEIGHT</span>
                      <span>REPS</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {log.sets.map((s) => (
                        <div key={s.setId} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', fontSize: '0.75rem', padding: '0.35rem', borderRadius: '4px', background: 'hsla(0, 0%, 100%, 0.02)', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          <span style={{ fontWeight: '700' }}>#{s.setId}</span>
                          <span>{s.weight} kg</span>
                          <span>{s.reps} reps</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
