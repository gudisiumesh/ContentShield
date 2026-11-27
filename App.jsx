
import { useState } from 'react'

import Review from './components/Review'
import SubmissionResults from './components/SubmissionResults'
import BasicInformation from './components/BasicInformation'
import AppDetails from './components/AppDetails'
import MySubmissions from './components/MySubmissions'
import Login from './components/Login'
import Signup from './components/Signup'

import { API_BASE_URL } from './services/api'

import './App.css'
import './style.css'

// Check whether the saved JWT has expired.

function hasValidSession() {
  const token = localStorage.getItem('access_token')
  const user = localStorage.getItem('user')

  if (!token || !user) {
    return false
  }

  try {
    const parts = token.split('.')

    if (parts.length !== 3) {
      return false
    }

    const payloadPart = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')

    const paddedPayload = payloadPart.padEnd(
      Math.ceil(payloadPart.length / 4) * 4,
      '='
    )

    const payload = JSON.parse(atob(paddedPayload))

    if (!payload.exp || payload.exp * 1000 <= Date.now()) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('user')
      return false
    }

    JSON.parse(user)

    return true

  } catch (error) {
    console.error('Session validation error:', error)
    return false
  }
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => hasValidSession()
  )

  const [authPage, setAuthPage] = useState('login')

  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  const [currentPage, setCurrentPage] = useState('basicInformation')

  const [basicInfo, setBasicInfo] = useState({})
  const [appDetails, setAppDetails] = useState({})

  // Signup
  const handleSignup = async (userData) => {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(
        typeof result.detail === 'string'
          ? result.detail
          : 'Signup failed'
      )
    }

    setAuthPage('login')
  }

  // Login
  const handleLogin = async (userData) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(
        typeof result.detail === 'string'
          ? result.detail
          : 'Invalid email or password'
      )
    }

    localStorage.setItem('access_token', result.access_token)
    localStorage.setItem('user', JSON.stringify(result.user))

    setIsAuthenticated(true)
    setCurrentPage('basicInformation')
  }

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')

    setIsAuthenticated(false)
    setAuthPage('login')

    setBasicInfo({})
    setAppDetails({})
    setCurrentPage('basicInformation')
  }

  // Show authentication pages when the user is not logged in.
  if (!isAuthenticated) {
    return authPage === 'signup' ? (
      <Signup
        onSignup={handleSignup}
        onLogin={() => setAuthPage('login')}
      />
    ) : (
      <Login
        onLogin={handleLogin}
        onSignup={() => setAuthPage('signup')}
      />
    )
  }

  return (
    <div className="container">

      <aside className={`sidebar ${isSidebarOpen ? '' : 'hide'}`}>

        <div className="logo">
          <div className="logo-icon">
            <i className="fa-solid fa-shield-halved"></i>
          </div>

          <div className="logo-text">
            <h2>ContentShield</h2>
            <p>Content Screening Platform</p>
          </div>
        </div>

        <div className="sidebar-menu">

          <h4>Content Submission</h4>

          <a
            href="#basic-information"
            className={currentPage === 'basicInformation' ? 'active' : ''}
            onClick={(event) => {
              event.preventDefault()
              setCurrentPage('basicInformation')
            }}
          >
            Basic Information
          </a>

          <a
            href="#application-details"
            className={currentPage === 'appDetails' ? 'active' : ''}
            onClick={(event) => {
              event.preventDefault()
              setCurrentPage('appDetails')
            }}
          >
            App Details
          </a>

          <a
            href="#review"
            className={currentPage === 'review' ? 'active' : ''}
            onClick={(event) => {
              event.preventDefault()
              setCurrentPage('review')
            }}
          >
            Review
          </a>

          <a
            href="#submit"
            className={currentPage === 'submit' ? 'active' : ''}
            onClick={(event) => {
              event.preventDefault()
              setCurrentPage('submit')
            }}
          >
            Submit
          </a>

          <a
            href="#my-submissions"
            className={currentPage === 'mySubmissions' ? 'active' : ''}
            onClick={(event) => {
              event.preventDefault()
              setCurrentPage('mySubmissions')
            }}
          >
            My Submissions
          </a>

        </div>

        <div className="sidebar-card">
          <h3>Need Help?</h3>
          <p>Check our submission guide for assistance.</p>
          <button type="button">Submission Guide</button>
        </div>

      </aside>

      <main className="main-content">

        <header className="navbar">

          <button
            type="button"
            className="menu-btn"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <span className="menu-icon">
              <span></span>
              <span></span>
              <span></span>
            </span>
          </button>

          <div className="nav-right">

            <button className="help-btn">
              <i className="fa-regular fa-circle-question"></i>
              Help
            </button>

            <button
              type="button"
              onClick={handleLogout}
            >
              Logout
            </button>

          </div>

        </header>

        {currentPage === 'basicInformation' && (
          <BasicInformation
            basicInfo={basicInfo}
            onSave={setBasicInfo}
            onNext={() => setCurrentPage('appDetails')}
          />
        )}

        {currentPage === 'appDetails' && (
          <AppDetails
            basicInfo={basicInfo}
            appDetails={appDetails}
            onSave={setAppDetails}
            onPrevious={() => setCurrentPage('basicInformation')}
            onNext={() => setCurrentPage('review')}
          />
        )}

        {currentPage === 'review' && (
          <Review
            basicInfo={basicInfo}
            appDetails={appDetails}
            onEditBasic={() => setCurrentPage('basicInformation')}
            onEditApp={() => setCurrentPage('appDetails')}
            onPrevious={() => setCurrentPage('appDetails')}
            onSubmit={() => setCurrentPage('submit')}
          />
        )}

        {currentPage === 'submit' && (
          <SubmissionResults
            basicInfo={basicInfo}
            appDetails={appDetails}
            onPrevious={() => setCurrentPage('review')}
            onNext={() => setCurrentPage('mySubmissions')}
          />
        )}

        {currentPage === 'mySubmissions' && (
          <MySubmissions
            onPrevious={() => setCurrentPage('submit')}
          />
        )}

      </main>

    </div>
  )
}

export default App
