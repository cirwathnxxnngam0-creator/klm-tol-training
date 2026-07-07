import { useState } from 'react'

export default function AuthScreen({ onAuthSuccess }) {
  const [activeTab, setActiveTab] = useState('signin')
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    setError('')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    // Basic validations
    if (activeTab === 'signup') {
      if (!formData.username.trim()) return setError('Username is required')
      if (!formData.email.trim()) return setError('Email is required')
      if (!formData.password) return setError('Password is required')
      if (formData.password !== formData.confirmPassword) {
        return setError('Passwords do not match')
      }
    } else {
      if (!formData.username.trim()) return setError('Username or Email is required')
      if (!formData.password) return setError('Password is required')
    }

    setIsLoading(true)
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false)
      onAuthSuccess({
        username: formData.username,
        email: formData.email || `${formData.username}@example.com`
      })
    }, 1200)
  }

  const handleSocialLogin = (platform) => {
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      onAuthSuccess({
        username: `${platform}User`,
        email: `${platform.toLowerCase()}@social.auth`
      })
    }, 1000)
  }

  return (
    <div className="container fade-in">
      <div className="header">
        <div style={{
          width: '48px',
          height: '48px',
          background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1rem',
          boxShadow: '0 8px 20px var(--primary-glow)',
          color: '#ffffff',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor"/>
          </svg>
        </div>
        <h1>FLEXIA</h1>
        <p>Your premium personal wellness companion</p>
      </div>

      <div className="form-tabs">
        <button
          className={`tab-btn ${activeTab === 'signin' ? 'active' : ''}`}
          onClick={() => { setActiveTab('signin'); setError(''); }}
        >
          Sign In
        </button>
        <button
          className={`tab-btn ${activeTab === 'signup' ? 'active' : ''}`}
          onClick={() => { setActiveTab('signup'); setError(''); }}
        >
          Sign Up
        </button>
      </div>

      <div className="glass-card">
        <div style={{ marginBottom: '1.25rem', textAlign: 'center' }}>
          <h3>{activeTab === 'signin' ? 'Welcome Back' : 'Create Account'}</h3>
          <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
            {activeTab === 'signin' ? 'Sign in to access your workouts' : 'Join today and get tailored metrics'}
          </p>
        </div>

        {error && (
          <div style={{
            background: 'hsla(350, 80%, 55%, 0.15)',
            border: '1px solid hsla(350, 80%, 55%, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem',
            color: 'var(--danger)',
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">Username</label>
            <div className="input-wrapper">
              <input
                type="text"
                name="username"
                className="input-field"
                placeholder={activeTab === 'signin' ? 'Username or Email' : 'Pick a username'}
                value={formData.username}
                onChange={handleInputChange}
                disabled={isLoading}
              />
            </div>
          </div>

          {activeTab === 'signup' && (
            <div className="input-group">
              <label className="input-label">Email Address</label>
              <div className="input-wrapper">
                <input
                  type="email"
                  name="email"
                  className="input-field"
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
              </div>
            </div>
          )}

          <div className="input-group">
            <label className="input-label">Password</label>
            <div className="input-wrapper">
              <input
                type="password"
                name="password"
                className="input-field"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleInputChange}
                disabled={isLoading}
              />
            </div>
          </div>

          {activeTab === 'signup' && (
            <div className="input-group">
              <label className="input-label">Confirm Password</label>
              <div className="input-wrapper">
                <input
                  type="password"
                  name="confirmPassword"
                  className="input-field"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
              </div>
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }} disabled={isLoading}>
            {isLoading ? (
              <span className="fade-in">Processing...</span>
            ) : (
              <span>{activeTab === 'signin' ? 'Sign In' : 'Get Started'}</span>
            )}
          </button>
        </form>

        <div className="divider">or continue with</div>

        <div className="social-grid">
          <button className="btn-social google" onClick={() => handleSocialLogin('Google')} disabled={isLoading}>
            <svg viewBox="0 0 24 24">
              <path d="M12.24 10.285V13.4h6.887c-.648 2.41-2.519 4.13-5.136 4.13A5.783 5.783 0 018.2 11.75a5.783 5.783 0 015.79-5.784c1.612 0 3.024.649 4.05 1.701l2.45-2.45A9.155 9.155 0 0013.99 2C8.924 2 4.8 6.12 4.8 11.185c0 5.064 4.124 9.184 9.19 9.184 5.302 0 9.108-3.731 9.108-9.25 0-.613-.054-1.159-.172-1.579H12.24z"/>
            </svg>
            Google
          </button>
          <button className="btn-social facebook" onClick={() => handleSocialLogin('Facebook')} disabled={isLoading}>
            <svg viewBox="0 0 24 24">
              <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z"/>
            </svg>
            Facebook
          </button>
          <button className="btn-social line" onClick={() => handleSocialLogin('Line')} disabled={isLoading}>
            <svg viewBox="0 0 24 24">
              <path d="M24 10.3c0-4.6-5.4-8.3-12-8.3S0 5.7 0 10.3c0 4.1 4.3 7.6 10.1 8.2.4.1.9.4 1 .9.1.5.1 1.2-.1 1.8 0 .2-.1.5.1.7.2.2.5.1.7-.1 1.7-2.3 5.9-4.1 8.8-5.3 2.1-.9 3.4-3.3 3.4-6.2zM8.2 12.3H6.4v-5c0-.3-.2-.5-.5-.5s-.5.2-.5.5v5.5c0 .3.2.5.5.5h2.3c.3 0 .5-.2.5-.5s-.2-.5-.5-.5zm3.8 0h-1.8v-5c0-.3-.2-.5-.5-.5s-.5.2-.5.5v5.5c0 .3.2.5.5.5h2.3c.3 0 .5-.2.5-.5s-.2-.5-.5-.5zm4.8-5c0-.3-.2-.5-.5-.5h-2.3c-.3 0-.5.2-.5.5v5.5c0 .3.2.5.5.5H16.3c.3 0 .5-.2.5-.5V9.4c0-.3-.2-.5-.5-.5h-1.3V8.3h1.3c.3 0 .5-.2.5-.5zm4.6 1.7c-.1-.2-.3-.3-.5-.3h-1.5v-1.4c0-.3-.2-.5-.5-.5s-.5.2-.5.5v5.5c0 .3.2.5.5.5h1.5c.3 0 .5-.1.6-.3.2-.2.3-.5.2-.8-.2-.8-.7-2.3-.9-3.2.3-.3.8-1 1-1.3.1-.3 0-.5-.1-.7z"/>
            </svg>
            Line
          </button>
        </div>
      </div>
    </div>
  )
}
