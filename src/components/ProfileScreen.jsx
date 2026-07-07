import { useState, useMemo } from 'react'

const GearIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', marginRight: '6px', verticalAlign: 'middle' }}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const ScaleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', marginRight: '6px', verticalAlign: 'middle' }}>
    <line x1="12" y1="2" x2="12" y2="22" />
    <line x1="5" y1="7" x2="19" y2="7" />
    <path d="M5 7a7 7 0 0 0 14 0" />
  </svg>
);

const BrainIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', marginRight: '6px', verticalAlign: 'middle', color: 'var(--primary)' }}>
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1 0-3.12 3 3 0 0 1 0-3.88 2.5 2.5 0 0 1 0-3.12A2.5 2.5 0 0 1 9.5 2z"/>
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 0-3.12 3 3 0 0 0 0-3.88 2.5 2.5 0 0 0 0-3.12A2.5 2.5 0 0 0 14.5 2z"/>
  </svg>
);

const SparkIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'inline-block', marginRight: '3px' }}>
    <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
  </svg>
);

const AlertIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', marginRight: '6px', verticalAlign: 'middle', color: 'hsl(var(--h-warning), 80%, 55%)' }}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const BoltIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', marginLeft: '6px', verticalAlign: 'middle' }}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor"/>
  </svg>
);

const WeightBmiChart = ({ history }) => {
  if (!history || history.length < 2) {
    return <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center', padding: '1rem', background: 'hsla(0,0%,100%,0.02)', borderRadius: '6px', border: '1px dashed var(--border-light)' }}>Log at least 2 entries to display graph.</div>;
  }
  
  const chronHistory = [...history].reverse();
  const weights = chronHistory.map(h => h.weight);
  const minW = Math.max(0, Math.min(...weights) - 2);
  const maxW = Math.max(...weights) + 2;
  const rangeW = maxW - minW || 1;

  const width = 320;
  const height = 110;
  const paddingX = 25;
  const paddingY = 20;

  const points = chronHistory.map((item, idx) => {
    const x = paddingX + (idx * (width - 2 * paddingX)) / (chronHistory.length - 1);
    const y = height - paddingY - ((item.weight - minW) * (height - 2 * paddingY)) / rangeW;
    return { x, y, weight: item.weight, bmi: item.bmi, date: item.date };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const fillPath = `${linePath} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;

  return (
    <div style={{ background: 'hsla(0,0%,0%,0.3)', padding: '12px 8px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', marginBottom: '1rem', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '12px', padding: '0 4px' }}>
        <span style={{ fontWeight: '700' }}>WEIGHT TREND (kg)</span>
        <span style={{ fontFamily: 'monospace' }}>{chronHistory.length} checkpoints</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="chartAreaGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        
        {/* Helper grid lines */}
        <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="3 3" />
        <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        
        {/* Fill under line */}
        <path d={fillPath} fill="url(#chartAreaGlow)" />
        
        {/* Trend line */}
        <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 6px var(--primary-glow))' }} />
        
        {/* Nodes */}
        {points.map((p, idx) => (
          <g key={idx}>
            <circle cx={p.x} cy={p.y} r="4" fill="#ffffff" stroke="var(--primary)" strokeWidth="2" style={{ filter: 'drop-shadow(0 0 4px var(--primary-glow))' }} />
            <text x={p.x} y={p.y - 8} textAnchor="middle" fill="var(--text-primary)" fontSize="8.5" fontWeight="900" fontFamily="Outfit, sans-serif">
              {p.weight}
            </text>
            <text x={p.x} y={p.y + 13} textAnchor="middle" fill="var(--text-muted)" fontSize="7" fontWeight="600" fontFamily="monospace">
              {p.bmi}
            </text>
          </g>
        ))}
      </svg>
      {/* Date ticks */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', padding: '0 12px' }}>
        {points.map((p, idx) => (
          <span key={idx} style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        ))}
      </div>
    </div>
  );
};

export default function ProfileScreen({ user, onSignOut, onComplete }) {
  const [profile, setProfile] = useState(() => {
    try {
      const stored = localStorage.getItem('klm_profile_data');
      return stored ? JSON.parse(stored) : {
        name: user?.username || 'Fitness Enthusiast',
        birthYear: 1995,
        height: 175, // cm
        weight: 70,  // kg
      };
    } catch {
      return {
        name: user?.username || 'Fitness Enthusiast',
        birthYear: 1995,
        height: 175,
        weight: 70,
      };
    }
  })

  // Calculate age using current year (2026 based on metadata)
  const currentYear = 2026
  const age = useMemo(() => {
    const calculated = currentYear - parseInt(profile.birthYear || 1995)
    return isNaN(calculated) ? 31 : calculated
  }, [profile.birthYear])

  // Calculate BMI in real-time
  const bmiData = useMemo(() => {
    const hMeters = profile.height / 100
    if (!hMeters || !profile.weight) return { score: 0, category: 'N/A', class: '' }
    const score = profile.weight / (hMeters * hMeters)
    
    let category = 'Normal'
    let statusClass = 'normal'
    
    if (score < 18.5) {
      category = 'Underweight'
      statusClass = 'underweight'
    } else if (score >= 18.5 && score < 25) {
      category = 'Normal Weight'
      statusClass = 'normal'
    } else if (score >= 25 && score < 30) {
      category = 'Overweight'
      statusClass = 'overweight'
    } else {
      category = 'Obese'
      statusClass = 'obese'
    }
    
    return {
      score: parseFloat(score.toFixed(1)),
      category,
      class: statusClass
    }
  }, [profile.height, profile.weight])

  const [metricHistory, setMetricHistory] = useState(() => {
    try {
      const stored = localStorage.getItem('profile_metric_history');
      if (stored) return JSON.parse(stored);
      // Prepopulate with some default history to show off the UI beautifully
      const defaultHistory = [
        { date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), weight: profile.weight + 4, bmi: parseFloat(( (profile.weight + 4) / ((profile.height/100)*(profile.height/100)) ).toFixed(1)) },
        { date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), weight: profile.weight + 2, bmi: parseFloat(( (profile.weight + 2) / ((profile.height/100)*(profile.height/100)) ).toFixed(1)) },
        { date: new Date().toISOString(), weight: profile.weight, bmi: parseFloat(( profile.weight / ((profile.height/100)*(profile.height/100)) ).toFixed(1)) }
      ];
      localStorage.setItem('profile_metric_history', JSON.stringify(defaultHistory));
      return defaultHistory;
    } catch {
      return [];
    }
  });

  const handleSave = () => {
    try {
      const newEntry = {
        date: new Date().toISOString(),
        weight: profile.weight,
        bmi: bmiData.score
      };
      // Update history: filter out any entry from today to avoid duplicates, then prepend new entry
      const cleanHistory = metricHistory.filter(item => {
        const itemDate = new Date(item.date).toDateString();
        const todayDate = new Date().toDateString();
        return itemDate !== todayDate;
      });
      const updatedHistory = [newEntry, ...cleanHistory];
      setMetricHistory(updatedHistory);
      localStorage.setItem('profile_metric_history', JSON.stringify(updatedHistory));
      localStorage.setItem('klm_profile_data', JSON.stringify(profile));
      localStorage.setItem('klm_profile_completed', 'true');
    } catch (e) {
      console.error(e);
    }
    onComplete(profile);
  };


  // Calculate dynamic workout and training time details
  const aiWorkoutAnalysis = useMemo(() => {
    const { category } = bmiData
    
    // Determine age classification
    let ageGroup = 'Adult'
    let maxHeartRate = 220 - age
    let targetZone = ''
    let injuryTips = ''
    let trainingTimeStr = ''
    let exerciseChoices = []

    if (age < 20) {
      ageGroup = 'Youth / Young Adult'
      targetZone = `${Math.round(maxHeartRate * 0.6)} - ${Math.round(maxHeartRate * 0.85)} BPM (Active & high-intensity)`
      injuryTips = 'Ensure proper warm-ups and avoid overtraining to protect growing growth plates.'
    } else if (age >= 20 && age < 45) {
      ageGroup = 'Adult (Prime Peak)'
      targetZone = `${Math.round(maxHeartRate * 0.65)} - ${Math.round(maxHeartRate * 0.85)} BPM (Optimal cardiovascular push)`
      injuryTips = 'Prioritize mobility and cross-training to prevent repetitive strain injuries.'
    } else if (age >= 45 && age < 60) {
      ageGroup = 'Mid-Aged Athlete'
      targetZone = `${Math.round(maxHeartRate * 0.55)} - ${Math.round(maxHeartRate * 0.75)} BPM (Sub-maximal endurance)`
      injuryTips = 'Focus on joint recovery times, strength, and core stability.'
    } else {
      ageGroup = 'Senior / Master Athlete'
      targetZone = `${Math.round(maxHeartRate * 0.5)} - ${Math.round(maxHeartRate * 0.75)} BPM (Aerobic fitness & health)`
      injuryTips = 'Emphasize balance control, joint-friendly strength training, and full range of motion.'
    }

    // Adjust training recommendations based on BMI
    if (category === 'Underweight') {
      trainingTimeStr = '3-4 sessions per week (30-45 mins max)'
      exerciseChoices = [
        { name: 'Progressive Strength Training', type: 'Hypertrophy-focused (3 sets of 8-12 reps)' },
        { name: 'Low Intensity Cardio', type: 'Short active recovery (e.g. 15-min walk)' },
        { name: 'Bodyweight Calisthenics', type: 'Core and functional movement control' }
      ]
    } else if (category === 'Normal Weight') {
      trainingTimeStr = '4-5 sessions per week (45-60 mins)'
      exerciseChoices = [
        { name: 'Resistance Training', type: 'Compound lifts (Squat, Deadlift, Press)' },
        { name: 'HIIT / Tabata', type: '1-2 sessions weekly for cardiovascular capacity' },
        { name: 'Active Recovery Yoga', type: 'Flexibility and mind-body balance' }
      ]
    } else if (category === 'Overweight') {
      trainingTimeStr = '3-5 sessions per week (40-50 mins)'
      exerciseChoices = [
        { name: 'Low-Impact Cardio', type: 'Incline treadmill, Elliptical, Cycling' },
        { name: 'Resistance Training', type: 'Circuit style with 30s rest to maximize burn' },
        { name: 'Swimming', type: 'Highly cardiovascular, zero-impact joint protection' }
      ]
    } else { // Obese
      trainingTimeStr = '3-4 sessions per week (30-40 mins, slow build)'
      exerciseChoices = [
        { name: 'Joint-Safe Steady Cardio', type: 'Stationary bike, Rowing machine, Water aerobics' },
        { name: 'Seated & Machine Strength', type: 'Controlled resistance to support joints' },
        { name: 'Mobility & Stretching', type: 'Focus on ankle, hip, and lumbar spine range' }
      ]
    }

    return {
      ageGroup,
      maxHeartRate,
      targetZone,
      injuryTips,
      trainingTimeStr,
      exerciseChoices
    }
  }, [age, bmiData])

  const handleMetricChange = (e) => {
    const { name, value } = e.target
    setProfile((prev) => ({
      ...prev,
      [name]: name === 'name' ? value : Number(value)
    }))
  }

  // Calculate slider positions or marker percentage for display
  const bmiPercentage = Math.min(Math.max(((bmiData.score - 15) / 25) * 100, 0), 100)

  return (
    <div className="container fade-in">
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0.25rem 0 0.75rem' }}>
        <button className="btn btn-secondary" style={{ width: 'auto', padding: '0.5rem 0.8rem', fontSize: '0.8rem' }} onClick={onSignOut}>
          Sign Out
        </button>
      </div>

      {/* Metrics Config Form */}
      <div className="glass-card">
        <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}><GearIcon /> Configure Physical Metrics</h3>
        
        <div className="input-group">
          <label className="input-label">Name</label>
          <input
            type="text"
            name="name"
            className="input-field"
            value={profile.name}
            onChange={handleMetricChange}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div className="input-group">
            <label className="input-label">Birth Year</label>
            <input
              type="number"
              name="birthYear"
              className="input-field"
              min="1920"
              max="2026"
              value={profile.birthYear}
              onChange={handleMetricChange}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Age (Estimated)</label>
            <input
              type="text"
              className="input-field"
              value={`${age} yrs`}
              disabled
              style={{ opacity: 0.7, background: 'var(--bg-surface)' }}
            />
          </div>
        </div>

        {/* Height Slider */}
        <div className="input-group" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <label className="input-label" style={{ margin: 0 }}>Height (cm)</label>
            <span style={{ fontWeight: '700', color: 'var(--primary)' }}>{profile.height} cm</span>
          </div>
          <input
            type="range"
            name="height"
            min="100"
            max="220"
            value={profile.height}
            onChange={handleMetricChange}
            style={{ width: '100%', accentColor: 'var(--primary)' }}
          />
        </div>

        {/* Weight Slider */}
        <div className="input-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <label className="input-label" style={{ margin: 0 }}>Weight (kg)</label>
            <span style={{ fontWeight: '700', color: 'var(--secondary)' }}>{profile.weight} kg</span>
          </div>
          <input
            type="range"
            name="weight"
            min="30"
            max="180"
            value={profile.weight}
            onChange={handleMetricChange}
            style={{ width: '100%', accentColor: 'var(--secondary)' }}
          />
        </div>
      </div>

      {/* Realtime BMI Gauge Card */}
      <div className="glass-card bmi-card">
        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}><ScaleIcon /> Real-Time BMI Score</h3>
        <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--text-primary)', margin: '0.5rem 0' }}>
          {bmiData.score}
        </div>
        <span className={`bmi-badge ${bmiData.class}`}>
          {bmiData.category}
        </span>

        <div className="bmi-meter">
          <div className="bmi-marker" style={{ left: `${bmiPercentage}%` }}></div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <span>15.0 (Low)</span>
          <span>25.0 (Overweight)</span>
          <span>40.0 (High)</span>
        </div>
      </div>

      {/* Weight & BMI Tracker Card */}
      <div className="glass-card" style={{ marginTop: '1rem' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)' }}>
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Weight & BMI Tracker
        </h3>
        
        {/* Render line chart dynamically */}
        <WeightBmiChart history={metricHistory} />
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '160px', overflowY: 'auto' }}>
          {metricHistory.map((item, idx) => (
            <div key={idx} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.6rem 0.8rem',
              background: 'hsla(0, 0%, 100%, 0.02)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-light)'
            }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', fontWeight: '700' }}>
                <span style={{ color: 'var(--text-primary)' }}>{item.weight} kg</span>
                <span style={{ color: 'var(--secondary)' }}>BMI {item.bmi}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Tailored Analysis Panel */}
      <div className="glass-card" style={{ borderLeft: '3px solid var(--secondary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem' }}><BrainIcon /> AI Personal Coach</h3>
          <span className="ai-pill"><SparkIcon /> Powered by Flexia AI</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Demographics & Time Targets</h4>
            <p style={{ marginTop: '0.25rem', fontSize: '0.95rem' }}>
              <strong>Group:</strong> {aiWorkoutAnalysis.ageGroup} <br />
              <strong>Recommended training time:</strong> {aiWorkoutAnalysis.trainingTimeStr}
            </p>
          </div>

          <div>
            <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Age-Specific Intensity</h4>
            <p style={{ marginTop: '0.25rem', fontSize: '0.95rem' }}>
              <strong>Target Heart Rate Zone:</strong> {aiWorkoutAnalysis.targetZone}
            </p>
          </div>

          <div>
            <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <AlertIcon /> Injury Prevention Tip
            </h4>
            <p style={{ marginTop: '0.25rem', fontSize: '0.9rem', fontStyle: 'italic', color: 'hsl(var(--h-warning), 80%, 75%)' }}>
              "{aiWorkoutAnalysis.injuryTips}"
            </p>
          </div>

          <div>
            <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Recommended Exercise Choices ({bmiData.category})
            </h4>
            {aiWorkoutAnalysis.exerciseChoices.map((item, index) => (
              <div key={index} className="workout-item" style={{ borderLeftColor: index === 0 ? 'var(--primary)' : index === 1 ? 'var(--secondary)' : 'var(--success)' }}>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{item.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.type}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button
        className="btn btn-primary"
        style={{ marginTop: '1.5rem', marginBottom: '2rem', width: '100%', padding: '0.9rem', fontSize: '1rem', fontWeight: '700', borderRadius: 'var(--radius-md)' }}
        onClick={handleSave}
      >
        Save Profile & Start Training <BoltIcon />
      </button>
    </div>
  )
}
