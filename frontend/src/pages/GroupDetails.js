import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import SuperCoachLayout from '../components/SuperCoachLayout'
import { groupService } from '../services/groupService'

function GroupDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Coachs
  const [allCoaches, setAllCoaches] = useState([])
  const [showAddCoachModal, setShowAddCoachModal] = useState(false)
  const [selectedCoachId, setSelectedCoachId] = useState('')
  const [coachActionLoading, setCoachActionLoading] = useState(false)

  // Projets
  const [availableProjects, setAvailableProjects] = useState([])
  const [showAddProjectModal, setShowAddProjectModal] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [projectActionLoading, setProjectActionLoading] = useState(false)

  useEffect(() => {
    loadGroup()
    loadAllCoaches()
  }, [id])

  const loadGroup = async () => {
    try {
      setLoading(true)
      const data = await groupService.getGroup(id)
      setGroup(data)
      setError(null)
    } catch (err) {
      setError('Erreur lors du chargement du groupe')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadAllCoaches = async () => {
    try {
      const data = await groupService.getCoaches()
      setAllCoaches(data || [])
    } catch (err) {
      console.error('Erreur chargement coachs:', err)
    }
  }

  const loadAvailableProjects = async () => {
    try {
      const data = await groupService.getAvailableProjects(id)
      setAvailableProjects(data || [])
    } catch (err) {
      console.error('Erreur chargement projets:', err)
    }
  }

  // Coachs non encore dans le groupe
  const getAvailableCoaches = () => {
    if (!group || !allCoaches) return []
    const groupCoachIds = group.coaches.map(c => c.profile_id)
    return allCoaches.filter(c => !groupCoachIds.includes(c.profile_id))
  }

  const getCoachDisplay = (coach) => {
    const name = [coach.user_first_name, coach.user_last_name].filter(Boolean).join(' ')
    if (name) return name
    return coach.user_email || '-'
  }

  // ============================================
  // ACTIONS COACHS
  // ============================================

  const handleAddCoach = async (e) => {
    e.preventDefault()
    if (!selectedCoachId) return
    setCoachActionLoading(true)
    try {
      await groupService.addCoachToGroup(id, selectedCoachId)
      setShowAddCoachModal(false)
      setSelectedCoachId('')
      await loadGroup()
    } catch (err) {
      alert(err.response?.data?.detail || 'Erreur lors de l\'ajout du coach')
    } finally {
      setCoachActionLoading(false)
    }
  }

  const handleRemoveCoach = async (profileId, coachName) => {
    if (!window.confirm(`Retirer "${coachName}" du groupe ?`)) return
    try {
      await groupService.removeCoachFromGroup(id, profileId)
      await loadGroup()
    } catch (err) {
      alert(err.response?.data?.detail || 'Erreur lors du retrait du coach')
    }
  }

  // ============================================
  // ACTIONS PROJETS
  // ============================================

  const openAddProjectModal = async () => {
    await loadAvailableProjects()
    setSelectedProjectId('')
    setShowAddProjectModal(true)
  }

  const handleAddProject = async (e) => {
    e.preventDefault()
    if (!selectedProjectId) return
    setProjectActionLoading(true)
    try {
      await groupService.addProjectToGroup(id, selectedProjectId)
      setShowAddProjectModal(false)
      setSelectedProjectId('')
      await loadGroup()
    } catch (err) {
      alert(err.response?.data?.detail || 'Erreur lors de l\'ajout du projet')
    } finally {
      setProjectActionLoading(false)
    }
  }

  const handleRemoveProject = async (projectId, projectName) => {
    if (!window.confirm(`Retirer "${projectName}" du groupe ?`)) return
    try {
      await groupService.removeProjectFromGroup(id, projectId)
      await loadGroup()
    } catch (err) {
      alert(err.response?.data?.detail || 'Erreur lors du retrait du projet')
    }
  }

  if (loading) {
    return (
      <SuperCoachLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      </SuperCoachLayout>
    )
  }

  if (error || !group) {
    return (
      <SuperCoachLayout>
        <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-lg">
          {error || 'Groupe non trouve'}
        </div>
        <button
          onClick={() => navigate('/super-coach/groups')}
          className="mt-4 text-emerald-600 dark:text-emerald-400 hover:underline"
        >
          Retour aux groupes
        </button>
      </SuperCoachLayout>
    )
  }

  const availableCoaches = getAvailableCoaches()

  return (
    <SuperCoachLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/super-coach/groups')}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {group.name}
              </h1>
              {group.type_support_name && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 mt-1">
                  {group.type_support_name}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bloc 1: Coachs */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
                <svg className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Coachs ({group.coaches?.length || 0})
              </h2>
              <button
                onClick={() => setShowAddCoachModal(true)}
                disabled={availableCoaches.length === 0}
                className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Ajouter
              </button>
            </div>
            <div className="p-6">
              {group.coaches && group.coaches.length > 0 ? (
                <ul className="space-y-3">
                  {group.coaches.map((coach) => (
                    <li
                      key={coach.profile_id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                          <span className="text-purple-600 dark:text-purple-300 font-medium">
                            {(coach.user_first_name || coach.user_email || '?')[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {getCoachDisplay(coach)}
                          </p>
                          {coach.user_email && coach.user_first_name && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {coach.user_email}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveCoach(coach.profile_id, getCoachDisplay(coach))}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                        title="Retirer du groupe"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                  Aucun coach dans ce groupe
                </p>
              )}
            </div>
          </div>

          {/* Bloc 2: Projets */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
                <svg className="w-5 h-5 mr-2 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Projets ({group.projects?.length || 0})
              </h2>
              <button
                onClick={openAddProjectModal}
                className="px-3 py-1.5 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 flex items-center"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Ajouter
              </button>
            </div>
            <div className="p-6">
              {group.projects && group.projects.length > 0 ? (
                <ul className="space-y-3">
                  {group.projects.map((project) => (
                    <li
                      key={project.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {project.name}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          {project.type_support_name && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                              {project.type_support_name}
                            </span>
                          )}
                          {project.navigant_name && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {project.navigant_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveProject(project.id, project.name)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 ml-3"
                        title="Retirer du groupe"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                  Aucun projet dans ce groupe
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Ajouter Coach */}
      {showAddCoachModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black opacity-50" onClick={() => setShowAddCoachModal(false)}></div>
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Ajouter un coach
              </h3>
              <form onSubmit={handleAddCoach} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Coach *
                  </label>
                  <select
                    required
                    value={selectedCoachId}
                    onChange={(e) => setSelectedCoachId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Selectionner un coach...</option>
                    {availableCoaches.map((coach) => (
                      <option key={coach.profile_id} value={coach.profile_id}>
                        {getCoachDisplay(coach)}
                      </option>
                    ))}
                  </select>
                  {availableCoaches.length === 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Tous les coachs sont deja dans ce groupe
                    </p>
                  )}
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddCoachModal(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={coachActionLoading || !selectedCoachId}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {coachActionLoading ? 'En cours...' : 'Ajouter'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajouter Projet */}
      {showAddProjectModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black opacity-50" onClick={() => setShowAddProjectModal(false)}></div>
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Ajouter un projet
              </h3>
              <form onSubmit={handleAddProject} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Projet *
                  </label>
                  <select
                    required
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Selectionner un projet...</option>
                    {availableProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name} {project.navigant_name ? `(${project.navigant_name})` : ''}
                      </option>
                    ))}
                  </select>
                  {availableProjects.length === 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Tous les projets sont deja dans ce groupe
                    </p>
                  )}
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddProjectModal(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={projectActionLoading || !selectedProjectId}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                  >
                    {projectActionLoading ? 'En cours...' : 'Ajouter'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </SuperCoachLayout>
  )
}

export default GroupDetails
