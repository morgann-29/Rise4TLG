import axios from 'axios'
import { supabase } from './supabase'

// Detection automatique : utilise le meme hote que le frontend, port 8000
const getApiUrl = () => {
  const hostname = window.location.hostname

  // En production (Vercel), utiliser l'URL du backend
  if (hostname.includes('vercel.app')) {
    return process.env.REACT_APP_API_URL
  }

  // En dev local (localhost ou IP reseau), utiliser le meme hostname que le frontend
  return `http://${hostname}:8000`
}

const API_URL = getApiUrl()

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Cache du token pour eviter les appels repetes a getSession
let cachedSession = null

// Ecouter les changements de session pour mettre a jour le cache
supabase.auth.onAuthStateChange((_event, session) => {
  cachedSession = session
})

// Initialiser le cache au demarrage
supabase.auth.getSession().then(({ data: { session } }) => {
  cachedSession = session
})

// Ajouter token Supabase automatiquement
api.interceptors.request.use(
  (config) => {
    if (cachedSession?.access_token) {
      config.headers.Authorization = `Bearer ${cachedSession.access_token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Gerer token expire
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await supabase.auth.signOut()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
