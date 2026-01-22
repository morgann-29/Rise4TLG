import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import Logo from './Logo'

function Layout({ children }) {
  const { logout, user, profiles, activeProfile, switchProfile } = useAuth()
  const { darkMode, toggleDarkMode } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef(null)

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

  // Extraire les initiales de l'utilisateur (depuis user_metadata)
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 shadow-lg transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700">
          <span className="text-lg font-semibold text-gray-900 dark:text-white">Menu</span>
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
          {/* Dashboard - Exemple de lien */}
          <Link
            to="/dashboard"
            className="flex items-center px-4 py-2 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => setSidebarOpen(false)}
          >
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
          </Link>

          {/* TODO: Ajouter vos liens de navigation ici */}
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
                  className="flex items-center justify-center w-10 h-10 rounded-full text-white font-semibold text-sm bg-indigo-600 hover:bg-indigo-700"
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

export default Layout
