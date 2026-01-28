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
  const profilesLoadedRef = useRef(false) // Eviter double chargement des profils

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
    profilesLoadedRef.current = false
    let subscription = null
    let initCompleted = false

    const init = async () => {
      try {
        // Get initial session
        const session = await authService.getSession()
        if (!isMounted.current) return

        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user && !profilesLoadedRef.current) {
          profilesLoadedRef.current = true
          await loadProfiles()
        }
      } catch (err) {
        // Ignore abort errors in StrictMode
        if (err.name === 'AbortError') return
        console.error('Auth init error:', err)
      } finally {
        if (isMounted.current) {
          setLoading(false)
          initCompleted = true
        }
      }
    }

    init()

    // Listen for auth changes (ignore events during init to avoid double load)
    const authListener = authService.onAuthStateChange(
      async (event, session) => {
        if (!isMounted.current) return

        // Ignorer l'evenement INITIAL_SESSION qui fire pendant l'init
        if (event === 'INITIAL_SESSION' && !initCompleted) return

        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          // Recharger les profils seulement si c'est un vrai changement d'auth
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            profilesLoadedRef.current = true
            await loadProfiles()
          }
        } else {
          profilesLoadedRef.current = false
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

  // Verifier le type de profil actif
  const isAdmin = activeProfile?.type_profile_id === 1
  const isSuperCoach = activeProfile?.type_profile_id === 2
  const isCoach = activeProfile?.type_profile_id === 3
  const isNavigant = activeProfile?.type_profile_id === 4

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
    isSuperCoach,
    isCoach,
    isNavigant,
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}
