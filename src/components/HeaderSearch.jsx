import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { fetchProjects } from '../lib/projects'
import { fetchTasks } from '../lib/tasks'
import { fetchActions } from '../lib/governance'
import { fetchRisks, fetchDecisions } from '../lib/risks'
import GlobalSearch from './GlobalSearch'

export default function HeaderSearch() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [actions, setActions] = useState([])
  const [risks, setRisks] = useState([])
  const [decisions, setDecisions] = useState([])

  useEffect(() => {
    let alive = true
    async function loadSearchData() {
      try {
        const [p, t, a, r, d] = await Promise.all([
          fetchProjects({ profile, teamFilter: null }),
          fetchTasks({ profile, scope: 'team' }),
          fetchActions({ profile, teamFilter: null }),
          fetchRisks({ profile, teamFilter: null }),
          fetchDecisions({ profile, teamFilter: null }),
        ])
        if (!alive) return
        setProjects(p); setTasks(t); setActions(a); setRisks(r); setDecisions(d)
      } catch {
        // Search is helpful, not life support. If it fails, the rest of the app should still work.
      }
    }
    if (profile?.id) loadSearchData()
    return () => { alive = false }
  }, [profile?.id])

  return (
    <GlobalSearch
      projects={projects}
      tasks={tasks}
      actions={actions}
      risks={risks}
      decisions={decisions}
      onSelectTask={() => navigate('/')}
    />
  )
}
