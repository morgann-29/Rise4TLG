import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { navigantService } from '../services/navigantService'
import Logo from './Logo'

function NavigantLayout({ children }) {
  const { logout, user, profiles, activeProfile, switchProfile } = useAuth()
  const { darkMode, toggleDarkMode } = useTheme()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef(null)

  // Projets du navigant (multi-projets)
  const [projects, setProjects] = useState([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [expandedProjects, setExpandedProjects] = useState({})

  // Charger les projets du navigant
  useEffect(() => {
    const loadProjects = async () => {
      try {
        setProjectsLoading(true)
        const data = await navigantService.getMyProjects()
        setProjects(data || [])

        // Auto-expand projet actif base sur l'URL
        const match = location.pathname.match(/\/navigant\/projects\/([^/]+)/)
        if (match) {
          setExpandedProjects(prev => ({ ...prev, [match[1]]: true }))
        }
      } catch (err) {
        console.error('Erreur chargement projets:', err)
      } finally {
        setProjectsLoading(false)
      }
    }
    loadProjects()
  }, [location.pathname])

  // Toggle projet expanded
  const toggleProject = (projectId) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }))
  }

  // Fermer le menu utilisateur si clic en dehors
  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Extraire les initiales de l'utilisateur
  const getInitials = () => {
    if (user?.user_metadata?.initial) {
      return user.user_metadata.initial.toUpperCase()
    }
    if (user?.user_metadata?.first_name && user?.user_metadata?.last_name) {
      return `${user.user_metadata.first_name[0]}${user.user_metadata.last_name[0]}`.toUpperCase()
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase()
    }
    return 'U'
  }

  // Nom complet de l'utilisateur
  const getFullName = () => {
    if (user?.user_metadata?.first_name && user?.user_metadata?.last_name) {
      return `${user.user_metadata.first_name} ${user.user_metadata.last_name}`
    }
    return 'Utilisateur'
  }

  // Profil actuel depuis le backend
  const currentProfileName = activeProfile?.type_profile_name || 'Chargement...'

  // Autres profils disponibles (exclure le profil actif)
  const otherProfiles = profiles.filter(p => p.id !== activeProfile?.id)

  // Changer de profil
  const handleSwitchProfile = async (profileId) => {
    try {
      await switchProfile(profileId)
      setUserMenuOpen(false)
    } catch (err) {
      console.error('Erreur changement profil:', err)
    }
  }

  // Verifier si un lien est actif
  const isActive = (path) => location.pathname === path
  const isProjectActive = (projectId) => location.pathname.includes(`/navigant/projects/${projectId}`)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar - Navigant Menu */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-800 shadow-lg transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } overflow-y-auto`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
          <span className="text-lg font-semibold text-gray-900 dark:text-white">Navigant</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="p-4 space-y-2">
          {/* Dashboard */}
          <Link
            to="/dashboard"
            className={`flex items-center px-4 py-2 rounded-md ${
              isActive('/dashboard')
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            onClick={() => setSidebarOpen(false)}
          >
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
          </Link>

          {/* Separator */}
          <div className="border-t border-gray-200 dark:border-gray-700 my-4"></div>

          {/* Section label */}
          <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Mes Projets
          </div>

          {/* Loading */}
          {projectsLoading && (
            <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
              Chargement...
            </div>
          )}

          {/* No projects */}
          {!projectsLoading && projects.length === 0 && (
            <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
              Aucun projet associe
            </div>
          )}

          {/* Projects list */}
          {projects.map((project) => (
            <div key={project.id} className="space-y-1">
              {/* Project header */}
              <button
                onClick={() => toggleProject(project.id)}
                className={`flex items-center justify-between w-full px-4 py-2 rounded-md text-left ${
                  isProjectActive(project.id)
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span className="font-medium truncate max-w-[140px]">{project.name || 'Mon Projet'}</span>
                </div>
                <svg
                  className={`w-4 h-4 transition-transform ${expandedProjects[project.id] ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Project submenus */}
              {expandedProjects[project.id] && (
                <div className="ml-4 pl-4 border-l border-gray-200 dark:border-gray-700 space-y-1">
                  {/* Seances */}
                  <Link
                    to={`/navigant/projects/${project.id}/sessions`}
                    className={`flex items-center px-3 py-2 text-sm rounded-md ${
                      location.pathname.includes(`/navigant/projects/${project.id}/sessions`)
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    Seances
                  </Link>

                  {/* Axes de travail */}
                  <Link
                    to={`/navigant/projects/${project.id}/work-leads`}
                    className={`flex items-center px-3 py-2 text-sm rounded-md ${
                      location.pathname.includes(`/navigant/projects/${project.id}/work-leads`)
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Axes de travail
                  </Link>
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* Overlay pour fermer le sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-30 bg-white dark:bg-gray-800 shadow">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left - Menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Center - Logo */}
            <div className="absolute left-1/2 transform -translate-x-1/2">
              <Logo className="h-10" />
            </div>

            {/* Right - User menu */}
            <div className="flex items-center">
              {/* User avatar menu */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center justify-center w-10 h-10 rounded-full text-white font-semibold text-sm bg-blue-600 hover:bg-blue-700"
                >
                  {getInitials()}
                </button>

                {/* Dropdown menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2">
                    {/* User info section */}
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {getFullName()}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {user?.email}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Profil: {currentProfileName}
                      </p>
                    </div>

                    {/* Other profiles */}
                    {otherProfiles.length > 0 && (
                      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Changer de profil</p>
                        {otherProfiles.map((profile) => (
                          <button
                            key={profile.id}
                            className="block w-full text-left px-2 py-1 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            onClick={() => handleSwitchProfile(profile.id)}
                          >
                            {profile.type_profile_name || `Profil ${profile.id}`}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="py-1">
                      <button
                        onClick={toggleDarkMode}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        {darkMode ? (
                          <svg className="w-4 h-4 mr-3" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                              clipRule="evenodd"
                            />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 mr-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                          </svg>
                        )}
                        {darkMode ? 'Mode clair' : 'Mode sombre'}
                      </button>
                      <button
                        onClick={() => {
                          setUserMenuOpen(false)
                          logout()
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Deconnexion
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content with top padding for fixed header */}
      <main className="pt-16">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  )
}

export default NavigantLayout
