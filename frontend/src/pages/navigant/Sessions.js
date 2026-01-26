import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import NavigantLayout from '../../components/NavigantLayout'
import { navigantService } from '../../services/navigantService'
import LocationPicker from '../../components/LocationPicker'

function Sessions() {
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    type_seance_id: '',
    date_start: '',
    date_end: '',
    location: null
  })
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [showDeleted, setShowDeleted] = useState(false)
  const [typeSeances, setTypeSeances] = useState([])

  useEffect(() => {
    loadData()
  }, [showDeleted])

  const loadData = async () => {
    try {
      setLoading(true)
      const [projectData, sessionsData, typesData] = await Promise.all([
        navigantService.getMyProject(),
        navigantService.getSessions(showDeleted),
        navigantService.getTypeSeances()
      ])
      setProject(projectData)
      setSessions(sessionsData || [])
      setTypeSeances(typesData || [])
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
        type_seance_id: parseInt(formData.type_seance_id),
        date_start: formData.date_start || null,
        date_end: formData.date_end || null,
        location: formData.location
        // session_master_id is null for navigant sessions (standalone)
      }

      if (editingItem) {
        await navigantService.updateSession(editingItem.id, submitData)
      } else {
        await navigantService.createSession(submitData)
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
    if (!window.confirm(`Supprimer la seance "${item.name}" ?`)) return
    try {
      await navigantService.deleteSession(item.id)
      await loadData()
    } catch (err) {
      alert(err.response?.data?.detail || 'Erreur lors de la suppression')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      type_seance_id: '',
      date_start: '',
      date_end: '',
      location: null
    })
  }

  const openCreateModal = () => {
    setEditingItem(null)
    setFormData({
      name: '',
      type_seance_id: '',
      date_start: '',
      date_end: '',
      location: null
    })
    setActionError(null)
    setShowModal(true)
  }

  const openEditModal = (item, e) => {
    e.stopPropagation()
    setEditingItem(item)
    setFormData({
      name: item.name,
      type_seance_id: item.type_seance_id?.toString() || '',
      date_start: item.date_start ? item.date_start.slice(0, 16) : '',
      date_end: item.date_end ? item.date_end.slice(0, 16) : '',
      location: item.location || null
    })
    setActionError(null)
    setShowModal(true)
  }

  const handleRowClick = (item) => {
    if (!item.is_deleted) {
      navigate(`/shared/sessions/${item.id}`)
    }
  }

  if (loading) {
    return (
      <NavigantLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </NavigantLayout>
    )
  }

  return (
    <NavigantLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {project?.name}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Seances
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Seances de votre projet
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <label className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
                className="mr-2 rounded border-gray-300 dark:border-gray-600"
              />
              Supprimees
            </label>
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nouvelle seance
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-lg">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Nom
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {sessions.map((item) => (
                <tr
                  key={item.id}
                  className={`${item.is_deleted ? 'opacity-50' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                  onClick={() => handleRowClick(item)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center ${
                        item.type_seance_is_sailing
                          ? 'bg-cyan-100 dark:bg-cyan-900'
                          : 'bg-orange-100 dark:bg-orange-900'
                      }`}>
                        {item.type_seance_is_sailing ? (
                          <svg className="w-5 h-5 text-cyan-600 dark:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {item.type_seance_name ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                        {item.type_seance_name}
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {item.date_start ? new Date(item.date_start).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {item.is_deleted ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                        Supprimee
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2" onClick={(e) => e.stopPropagation()}>
                      {!item.is_deleted && (
                        <>
                          <button
                            onClick={(e) => openEditModal(item, e)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                            title="Modifier"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                            title="Supprimer"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p>Aucune seance</p>
                    <p className="text-sm mt-1">Creez votre premiere seance</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black opacity-50" onClick={() => setShowModal(false)}></div>
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                {editingItem ? 'Modifier la seance' : 'Nouvelle seance'}
              </h3>
              {actionError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
                  {actionError}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nom de la seance *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Entrainement regulier"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Type de seance *
                  </label>
                  <select
                    required
                    value={formData.type_seance_id}
                    onChange={(e) => setFormData({ ...formData, type_seance_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selectionnez un type</option>
                    {typeSeances.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name} {type.is_sailing ? '(Navigation)' : '(A terre)'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date de debut
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.date_start}
                    onChange={(e) => setFormData({ ...formData, date_start: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date de fin
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.date_end}
                    onChange={(e) => setFormData({ ...formData, date_end: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Lieu
                  </label>
                  <LocationPicker
                    value={formData.location}
                    onChange={(location) => setFormData({ ...formData, location })}
                  />
                </div>

                {/* TODO: integrer ici le choix de l'equipage */}
                {!editingItem && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm text-gray-500 dark:text-gray-400">
                    <p className="font-medium">Equipage</p>
                    <p className="text-xs mt-1">La selection de l'equipage sera disponible prochainement.</p>
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {actionLoading ? 'En cours...' : (editingItem ? 'Enregistrer' : 'Creer')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </NavigantLayout>
  )
}

export default Sessions