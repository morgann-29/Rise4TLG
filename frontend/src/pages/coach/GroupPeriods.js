import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import CoachLayout from '../../components/CoachLayout'
import { coachService } from '../../services/coachService'

function GroupPeriods() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const [group, setGroup] = useState(null)
  const [periods, setPeriods] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    date_start: '',
    date_end: ''
  })
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [showDeleted, setShowDeleted] = useState(false)
  const [projects, setProjects] = useState([])
  const [selectedProjectIds, setSelectedProjectIds] = useState([])

  useEffect(() => {
    loadData()
  }, [groupId, showDeleted])

  const loadData = async () => {
    try {
      setLoading(true)
      const [groupData, periodsData, projectsData] = await Promise.all([
        coachService.getGroupBasic(groupId),
        coachService.getGroupPeriods(groupId, showDeleted),
        coachService.getGroupProjects(groupId)
      ])
      setGroup(groupData)
      setPeriods(periodsData || [])
      setProjects(projectsData || [])
      setError(null)
    } catch (err) {
      setError('Erreur lors du chargement')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setActionLoading(true)
    setActionError(null)
    try {
      const submitData = {
        name: formData.name,
        date_start: formData.date_start || null,
        date_end: formData.date_end || null
      }

      if (editingItem) {
        await coachService.updateGroupPeriod(groupId, editingItem.id, submitData)
      } else {
        submitData.project_ids = selectedProjectIds
        await coachService.createGroupPeriod(groupId, submitData)
      }
      setShowModal(false)
      setEditingItem(null)
      resetForm()
      await loadData()
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Erreur lors de l\'operation')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async (item) => {
    if (!window.confirm(`Supprimer la periode "${item.name}" ?`)) return
    try {
      await coachService.deleteGroupPeriod(groupId, item.id)
      await loadData()
    } catch (err) {
      alert(err.response?.data?.detail || 'Erreur lors de la suppression')
    }
  }

  const handleRestore = async (item) => {
    try {
      await coachService.restoreGroupPeriod(groupId, item.id)
      await loadData()
    } catch (err) {
      alert(err.response?.data?.detail || 'Erreur lors de la restauration')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      date_start: '',
      date_end: ''
    })
    setSelectedProjectIds(projects.map(p => p.id))
  }

  const openCreateModal = () => {
    setEditingItem(null)
    setFormData({
      name: '',
      date_start: '',
      date_end: ''
    })
    setSelectedProjectIds(projects.map(p => p.id))
    setActionError(null)
    setShowModal(true)
  }

  const openEditModal = (item, e) => {
    e.stopPropagation()
    setEditingItem(item)
    setFormData({
      name: item.name,
      date_start: item.date_start ? item.date_start.slice(0, 16) : '',
      date_end: item.date_end ? item.date_end.slice(0, 16) : ''
    })
    setActionError(null)
    setShowModal(true)
  }

  const toggleProjectSelection = (projectId) => {
    setSelectedProjectIds(prev => {
      if (prev.includes(projectId)) {
        return prev.filter(id => id !== projectId)
      } else {
        return [...prev, projectId]
      }
    })
  }

  const toggleAllProjects = () => {
    if (selectedProjectIds.length === projects.length) {
      setSelectedProjectIds([])
    } else {
      setSelectedProjectIds(projects.map(p => p.id))
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <CoachLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </CoachLayout>
    )
  }

  if (error) {
    return (
      <CoachLayout>
        <div className="text-center py-12">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={loadData}
            className="mt-4 text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Reessayer
          </button>
        </div>
      </CoachLayout>
    )
  }

  return (
    <CoachLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {group?.name}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Periodes
            </h1>
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nouvelle periode
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Afficher les supprimees</span>
          </label>
        </div>

        {/* List */}
        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden rounded-lg">
          {periods.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Aucune periode</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Commencez par creer une nouvelle periode.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {periods.map((item) => (
                <li
                  key={item.id}
                  onClick={() => navigate(`/coach/groups/${groupId}/periods/${item.id}`)}
                  className={`px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer ${item.is_deleted ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {item.name}
                        </h3>
                        {item.is_deleted && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                            Supprimee
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                        <span>
                          {formatDate(item.date_start)} - {formatDate(item.date_end)}
                        </span>
                        <span>
                          {item.project_count} projet{item.project_count > 1 ? 's' : ''}
                        </span>
                        <span>
                          {item.session_master_count} seance{item.session_master_count > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {item.is_deleted ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRestore(item) }}
                          className="p-2 text-green-600 hover:text-green-700 dark:text-green-400"
                          title="Restaurer"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={(e) => openEditModal(item, e)}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            title="Modifier"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(item) }}
                            className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                            title="Supprimer"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </>
                      )}
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setShowModal(false)}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {editingItem ? 'Modifier la periode' : 'Nouvelle periode'}
              </h3>

              {actionError && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg text-sm">
                  {actionError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nom *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: Semaine 1 - Preparation"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Date de debut *
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.date_start}
                      onChange={(e) => setFormData({ ...formData, date_start: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Date de fin *
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.date_end}
                      onChange={(e) => setFormData({ ...formData, date_end: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Project selection (only for creation) */}
                {!editingItem && projects.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Projets participants
                      </label>
                      <button
                        type="button"
                        onClick={toggleAllProjects}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700"
                      >
                        {selectedProjectIds.length === projects.length ? 'Deselectionner tout' : 'Tout selectionner'}
                      </button>
                    </div>
                    <div className="border border-gray-300 dark:border-gray-600 rounded-lg max-h-40 overflow-y-auto">
                      {projects.map((project) => (
                        <label
                          key={project.id}
                          className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedProjectIds.includes(project.id)}
                            onChange={() => toggleProjectSelection(project.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-900 dark:text-white">
                            {project.name}
                          </span>
                          {project.navigant_name && (
                            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                              ({project.navigant_name})
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    disabled={actionLoading}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center"
                  >
                    {actionLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Enregistrement...
                      </>
                    ) : (
                      editingItem ? 'Modifier' : 'Creer'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </CoachLayout>
  )
}

export default GroupPeriods
