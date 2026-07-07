import { useState } from 'react'
import AuthScreen from './components/AuthScreen'
import ProfileScreen from './components/ProfileScreen'
import DashboardScreen from './components/DashboardScreen'
import HistoryView from './components/HistoryView'
import CameraPoseOverlay from './components/CameraPoseOverlay'
import './index.css'

function App() {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('klm_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [profileCompleted, setProfileCompleted] = useState(() => {
    return localStorage.getItem('klm_profile_completed') === 'true';
  });

  const [activeTab, setActiveTab] = useState('workouts');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Shared exercise ID selection state (used to sync picker between Dashboard and Camera)
  const [selectedExerciseId, setSelectedExerciseId] = useState('dumbbell-hammer-curl');

  // Sync authentication success
  const handleAuthSuccess = (userData) => {
    localStorage.setItem('klm_user', JSON.stringify(userData));
    setUser(userData);
  };

  // Sync profile completion
  const handleProfileComplete = (profileData) => {
    localStorage.setItem('klm_profile_data', JSON.stringify(profileData));
    localStorage.setItem('klm_profile_completed', 'true');
    setProfileCompleted(true);
    setActiveTab('workouts');
  };

  // Handle logout
  const handleSignOut = () => {
    localStorage.removeItem('klm_user');
    localStorage.removeItem('klm_profile_completed');
    localStorage.removeItem('klm_profile_data');
    setUser(null);
    setProfileCompleted(false);
  };

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Navigate directly to tabs from secondary actions (e.g. details page click)
  const handleNavigate = (tabName) => {
    setActiveTab(tabName);
    triggerRefresh();
  };

  if (!user) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  if (!profileCompleted) {
    return (
      <ProfileScreen 
        user={user} 
        onSignOut={handleSignOut} 
        onComplete={handleProfileComplete} 
      />
    );
  }

  return (
    <>
      {activeTab !== 'camera' && (
        <header className="app-header" style={{ borderBottom: 'none', background: 'transparent', padding: '1.25rem 1.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem', justifyContent: 'flex-start' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)', filter: 'drop-shadow(0 0 8px var(--primary))', flexShrink: 0 }}>
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor"/>
          </svg>
          <span style={{ fontSize: '1rem', fontWeight: '850', fontFamily: 'Outfit, sans-serif', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-primary)' }}>
            {activeTab === 'workouts' && 'Select Training Movement'}
            {activeTab === 'history' && 'Workout History'}
            {activeTab === 'profile' && 'Profile Metrics'}
          </span>
        </header>
      )}

      <main className="app-main" style={activeTab === 'camera' ? { padding: 0, margin: 0, gap: 0, minHeight: 'calc(100vh - 64px)', overflow: 'hidden' } : {}}>
        {activeTab === 'workouts' && (
          <DashboardScreen 
            onNavigate={handleNavigate} 
            refreshTrigger={refreshTrigger} 
            onSelectExercise={(id) => setSelectedExerciseId(id)}
          />
        )}
        {activeTab === 'camera' && (
          <CameraPoseOverlay 
            selectedExerciseId={selectedExerciseId} 
            setSelectedExerciseId={setSelectedExerciseId} 
          />
        )}
        {activeTab === 'history' && (
          <HistoryView 
            refreshTrigger={refreshTrigger} 
            onRefresh={triggerRefresh} 
          />
        )}
        {activeTab === 'profile' && (
          <ProfileScreen 
            user={user} 
            onSignOut={handleSignOut} 
            onComplete={() => alert('Profile metrics updated successfully!')} 
          />
        )}
      </main>

      <nav className="bottom-nav">
        <button 
          className={`nav-item ${activeTab === 'workouts' ? 'active' : ''}`}
          onClick={() => setActiveTab('workouts')}
        >
          <span className="nav-icon" style={{ display: 'flex', alignItems: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
              <path d="M2 8h16v8H2z" />
              <path d="M6 8v8" />
              <path d="M10 8v8" />
              <path d="M14 8v8" />
            </svg>
          </span>
          <span className="nav-label">Workouts</span>
        </button>
        <button 
          className={`nav-item ${activeTab === 'camera' ? 'active' : ''}`}
          onClick={() => setActiveTab('camera')}
        >
          <span className="nav-icon" style={{ display: 'flex', alignItems: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </span>
          <span className="nav-label">AI Camera</span>
        </button>
        <button 
          className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <span className="nav-icon" style={{ display: 'flex', alignItems: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </span>
          <span className="nav-label">History</span>
        </button>
        <button 
          className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <span className="nav-icon" style={{ display: 'flex', alignItems: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </span>
          <span className="nav-label">Profile</span>
        </button>
      </nav>
    </>
  )
}

export default App
