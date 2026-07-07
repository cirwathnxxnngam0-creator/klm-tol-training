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
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
          <span className="logo-spark">⚡</span>
          <h1 className="app-brand">KLM TOL TRAINING</h1>
        </div>
        <p className="app-tagline">Optimizing Exercise Routines with Artificial Intelligence</p>
      </header>

      <main className="app-main">
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
          <span className="nav-icon">⚡</span>
          <span className="nav-label">Workouts</span>
        </button>
        <button 
          className={`nav-item ${activeTab === 'camera' ? 'active' : ''}`}
          onClick={() => setActiveTab('camera')}
        >
          <span className="nav-icon">📷</span>
          <span className="nav-label">AI Camera</span>
        </button>
        <button 
          className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <span className="nav-icon">📊</span>
          <span className="nav-label">History</span>
        </button>
        <button 
          className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <span className="nav-icon">👤</span>
          <span className="nav-label">Profile</span>
        </button>
      </nav>
    </>
  )
}

export default App
