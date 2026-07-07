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
    { weight: 12, reps: 10 }
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
      setSetsInput([{ weight: selectedEx.defaultWeightKg || 12, reps: selectedEx.defaultReps || 10 }]);
      alert('Manual workout logged successfully!');
    } catch (err) {
      console.error(err);
    }
  };

  const addSetToForm = () => {
    const lastSet = setsInput[setsInput.length - 1] || { weight: 12, reps: 10 };
    setSetsInput(prev => [...prev, { ...lastSet }]);
  };

  const removeSetFromForm = (idx) => {
    if (setsInput.length <= 1) return;
    setSetsInput(prev => prev.filter((_, i) => i !== idx));
  };

  const updateSetInForm = (idx, field, val) => {
    setSetsInput(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s));
  };

  const formatDate = (isoStr) => {
    const date = new Date(isoStr);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredHistory = filterExercise === 'all'
    ? history
    : history.filter(h => h.exerciseId === filterExercise);

  return (
    <div className="w-full max-w-md mx-auto p-4 pb-24 text-left">
      {/* Header Panel */}
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white m-0">Workout History</h1>
          <p className="text-xs text-gray-400">View performance history and logs</p>
        </div>
        <button
          onClick={() => setShowManualLogModal(true)}
          className="py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs border border-purple-500 shadow-md shadow-purple-600/30 transition-all flex items-center gap-1"
        >
          ➕ Add Log
        </button>
      </header>

      {/* Filter and Clear Panel */}
      <div className="mb-4 flex gap-2 items-center justify-between">
        <select
          value={filterExercise}
          onChange={(e) => setFilterExercise(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 flex-grow"
        >
          <option value="all" className="bg-zinc-900">All Exercises</option>
          {exercises.map(ex => (
            <option key={ex.id} value={ex.id} className="bg-zinc-900">{ex.name}</option>
          ))}
        </select>

        {history.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="px-3 py-2 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 rounded-xl text-xs text-red-400 font-semibold"
          >
            Clear All
          </button>
        )}
      </div>

      {/* History List */}
      {filteredHistory.length === 0 ? (
        <div className="text-center p-8 rounded-2xl bg-white/5 border border-white/10 my-8">
          <p className="text-gray-400 text-sm">No workout sessions logged yet.</p>
          <p className="text-xs text-purple-400 mt-2 cursor-pointer hover:underline" onClick={() => setShowManualLogModal(true)}>
            Click here to manually add your first workout.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredHistory.map((log) => {
            const isExpanded = expandedLogId === log.id;
            const totalVolume = log.sets.reduce((sum, s) => sum + (s.weight * s.reps), 0);
            const totalReps = log.sets.reduce((sum, s) => sum + s.reps, 0);
            
            return (
              <div
                key={log.id}
                className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4 transition-all duration-300 hover:border-white/20 shadow-md"
              >
                <div
                  className="flex justify-between items-center cursor-pointer"
                  onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                >
                  <div className="flex-grow pr-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                        log.mode === 'AI Camera' 
                          ? 'bg-purple-500/25 border-purple-500/35 text-purple-300' 
                          : 'bg-zinc-500/20 border-zinc-500/30 text-gray-300'
                      }`}>
                        {log.mode}
                      </span>
                      <span className="text-[10px] text-gray-400">{formatDate(log.date)}</span>
                    </div>
                    <h3 className="text-sm font-bold text-white">{log.exerciseName}</h3>
                  </div>

                  <div className="text-right flex items-center gap-2">
                    <div>
                      <p className="text-xs text-purple-300 font-semibold">{log.sets.length} sets</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{totalReps} reps • {totalVolume} kg</p>
                    </div>
                    <span className="text-gray-400 text-xs">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Expanded Set Details */}
                {isExpanded && (
                  <div className="mt-4 pt-3 border-t border-white/15 animate-in fade-in duration-200">
                    <div className="grid grid-cols-3 text-[10px] font-bold text-gray-400 mb-2 uppercase text-center">
                      <span>Set</span>
                      <span>Weight</span>
                      <span>Reps</span>
                    </div>
                    <div className="space-y-1.5">
                      {log.sets.map((s) => (
                        <div key={s.setId} className="grid grid-cols-3 text-xs py-1 rounded bg-white/5 text-center text-gray-300">
                          <span className="font-semibold">Set {s.setId}</span>
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

      {/* Manual Log Modal */}
      {showManualLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <form
            onSubmit={handleAddManualLog}
            className="w-full max-w-sm bg-zinc-950 border border-white/15 rounded-3xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-bold text-white">Log Workout</h2>
              <button
                type="button"
                onClick={() => setShowManualLogModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Exercise Select */}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Exercise</label>
              <select
                value={selectedExId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedExId(val);
                  const selectedEx = exercises.find(ex => ex.id === val);
                  if (selectedEx) {
                    setSetsInput([{ weight: selectedEx.defaultWeightKg, reps: selectedEx.defaultReps }]);
                  }
                }}
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
              >
                {exercises.map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Date</label>
                <input
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Time</label>
                <input
                  type="time"
                  value={logTime}
                  onChange={(e) => setLogTime(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  required
                />
              </div>
            </div>

            {/* Sets Inputs */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-gray-400 uppercase block">Sets</label>
                <button
                  type="button"
                  onClick={addSetToForm}
                  className="text-xs text-purple-400 font-semibold hover:underline"
                >
                  + Add Set
                </button>
              </div>

              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                {setsInput.map((s, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <span className="text-xs text-gray-500 font-semibold w-10">Set {index + 1}</span>
                    <input
                      type="number"
                      placeholder="kg"
                      value={s.weight}
                      onChange={(e) => updateSetInForm(index, 'weight', e.target.value)}
                      className="bg-zinc-900 border border-white/10 rounded-lg p-1.5 text-center text-xs text-white focus:outline-none w-20"
                      required
                    />
                    <span className="text-xs text-gray-500">kg</span>
                    <input
                      type="number"
                      placeholder="reps"
                      value={s.reps}
                      onChange={(e) => updateSetInForm(index, 'reps', e.target.value)}
                      className="bg-zinc-900 border border-white/10 rounded-lg p-1.5 text-center text-xs text-white focus:outline-none w-20"
                      required
                    />
                    <span className="text-xs text-gray-500">reps</span>
                    
                    {setsInput.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSetFromForm(index)}
                        className="text-red-400 hover:text-red-300 text-xs ml-auto"
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
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-lg shadow-purple-600/30 transition-all text-center mt-4"
            >
              Log Workout Session
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
