import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*, team:teams(id, name)')
      .eq('id', userId)
      .single()

    let managedTeamIds = []
    let managedTeams = []
    try {
      const { data: directorRows } = await supabase
        .from('team_directors')
        .select('team_id, team:teams(id, name)')
        .eq('director_id', userId)
      managedTeamIds = (directorRows || []).map((r) => r.team_id).filter(Boolean)
      managedTeams = (directorRows || []).map((r) => r.team).filter(Boolean)
    } catch {
      // The app still works before the role SQL migration is applied.
      managedTeamIds = []
      managedTeams = []
    }

    setProfile(data ? { ...data, managed_team_ids: managedTeamIds, managed_teams: managedTeams } : data)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) loadProfile(session.user.id)
      else setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) loadProfile(session.user.id)
      else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (profile !== null) setLoading(false)
  }, [profile])

  async function signIn(email, password) {
    return supabase.auth.signInWithPassword({ email, password })
  }

  async function signOut() {
    return supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signIn, signOut, refreshProfile: () => session?.user ? loadProfile(session.user.id) : null }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
