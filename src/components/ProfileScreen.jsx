import { useState, useMemo } from 'react'

export default function ProfileScreen({ user, onSignOut, onComplete }) {
  const [profile, setProfile] = useState({
    name: user?.username || 'Fitness Enthusiast',
    birthYear: 1995,
    height: 175, // cm
    weight: 70,  // kg
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
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0' }}>
        <div style={{ textAlign: 'left' }}>
          <h2 style={{ fontSize: '1.25rem' }}>Welcome, {profile.name}</h2>
          <p style={{ fontSize: '0.75rem' }}>{user?.email}</p>
        </div>
        <button className="btn btn-secondary" style={{ width: 'auto', padding: '0.5rem 0.8rem', fontSize: '0.8rem' }} onClick={onSignOut}>
          Sign Out
        </button>
      </div>

      {/* Metrics Config Form */}
      <div className="glass-card">
        <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>🔬 Configure Physical Metrics</h3>
        
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
        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>⚖️ Real-Time BMI Score</h3>
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

      {/* AI Tailored Analysis Panel */}
      <div className="glass-card" style={{ borderLeft: '3px solid var(--secondary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem' }}>🤖 AI Personal Coach</h3>
          <span className="ai-pill">✨ Powered by Flexia AI</span>
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
              ⚠️ Injury Prevention Tip
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
        onClick={() => onComplete(profile)}
      >
        Save Profile & Start Training ⚡
      </button>
    </div>
  )
}
