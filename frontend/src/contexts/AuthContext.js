import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { authService } from '../services/authService'
import { profileService } from '../services/profileService'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [activeProfile, setActiveProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const isMounted = useRef(true)

  // Charger les profils de l'utilisateur depuis le backend
  const loadProfiles = async () => {
    try {
      const data = await profileService.getMyProfiles()
      if (!isMounted.current) return

      setProfiles(data.profiles || [])

      // Trouver le profil actif
      if (data.active_profile_id && data.profiles?.length > 0) {
        const active = data.profiles.find(p => p.id === data.active_profile_id)
        setActiveProfile(active || data.profiles[0])
      } else if (data.profiles?.length > 0) {
        setActiveProfile(data.profiles[0])
      } else {
        setActiveProfile(null)
      }
    } catch (err) {
      if (!isMounted.current) return
      console.error('Erreur chargement profils:', err)
      setProfiles([])
      setActiveProfile(null)
    }
  }

  // Changer de profil actif
  const switchProfile = async (profileId) => {
    try {
      const newProfile = await profileService.switchProfile(profileId)
      setActiveProfile(newProfile)
      return newProfile
    } catch (err) {
      console.error('Erreur changement profil:', err)
      throw err
    }
  }

  useEffect(() => {
    isMounted.current = true
    let subscription = null

    const init = async () => {
      try {
        // Get initial session
        const session = await authService.getSession()
        if (!isMounted.current) return

        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          await loadProfiles()
        }
      } catch (err) {
        // Ignore abort errors in StrictMode
        if (err.name === 'AbortError') return
        console.error('Auth init error:', err)
      } finally {
        if (isMounted.current) {
          setLoading(false)
        }
      }
    }

    init()

    // Listen for auth changes
    const authListener = authService.onAuthStateChange(
      async (_event, session) => {
        if (!isMounted.current) return
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          await loadProfiles()
        } else {
          setProfiles([])
          setActiveProfile(null)
        }
      }
    )
    subscription = authListener.data.subscription

    return () => {
      isMounted.current = false
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [])

  const login = async (email, password) => {
    const data = await authService.login(email, password)
    return data
  }

  const logout = async () => {
    await authService.logout()
    setUser(null)
    setSession(null)
    setProfiles([])
    setActiveProfile(null)
  }

  // Verifier si le profil actif est admin (type_profile_id = 1)
  const isAdmin = activeProfile?.type_profile_id === 1

  const value = {
    user,
    session,
    profiles,
    activeProfile,
    switchProfile,
    login,
    logout,
    isAuthenticated: !!session,
    isAdmin,
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}
