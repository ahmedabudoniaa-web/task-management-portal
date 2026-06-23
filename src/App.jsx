import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Actions from './pages/Actions'
import Governance from './pages/Governance'
import PortfolioDashboard from './pages/PortfolioDashboard'
import TeamDashboard from './pages/TeamDashboard'
import ProjectDashboard from './pages/ProjectDashboard'
import Trash from './pages/Trash'
import Profile from './pages/Profile'
import Inbox from './pages/Inbox'

function AppInner() {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>Loading…</p>
      </div>
    )
  }

  if (!session || !profile) return <Login />

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/portfolio" element={<PortfolioDashboard />} />
        <Route path="/teams" element={<TeamDashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:projectId" element={<ProjectDetail />} />
        <Route path="/projects/:projectId/dashboard" element={<ProjectDashboard />} />
        <Route path="/trash" element={<Trash />} />
        <Route path="/actions" element={<Actions />} />
        <Route path="/governance" element={<Governance />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
