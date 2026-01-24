import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import CoachLayout from '../../components/CoachLayout'
import { coachService } from '../../services/coachService'

// Status labels and colors
const STATUS_CONFIG = {
  NEW: { label: 'Nouveau', bgClass: 'bg-purple-100 dark:bg-purple-900', textClass: 'text-purple-800 dark:text-purple-200' },
  TODO: { label: 'A travailler', bgClass: 'bg-gray-100 dark:bg-gray-700', textClass: 'text-gray-800 dark:text-gray-200' },
  WORKING: { label: 'En cours', bgClass: 'bg-blue-100 dark:bg-blue-900', textClass: 'text-blue-800 dark:text-blue-200' },
  DANGER: { label: 'Danger', bgClass: 'bg-red-100 dark:bg-red-900', textClass: 'text-red-800 dark:text-red-200' },
  OK: { label: 'Valide', bgClass: 'bg-green-100 dark:bg-green-900', textClass: 'text-green-800 dark:text-green-200' }
}

function GroupWorkLeads() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const [group, setGroup] = useState(null)
  const [workLeads, setWorkLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    work_lead_type_id: ''
  })
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [showDeleted, setShowDeleted] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [workLeadTypes, setWorkLeadTypes] = useState([])
  const [collapsedGroups, setCollapsedGroups] = useState({})
  const [showImportModal, setShowImportModal] = useState(false)
  const [availableModels, setAvailableModels] = useState([])
  const [selectedModelId, setSelectedModelId] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState(null)
  const [modelsLoading, setModelsLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [groupId, showDeleted, showArchived])

  const loadData = async () => {
    try {
      setLoading(true)
      const [groupData, workLeadsData, typesData] = await Promise.all([
        coachService.getGroupBasic(groupId),
        coachService.getGroupWorkLeads(groupId, showDeleted, showArchived),
        coachService.getWorkLeadTypes()
      ])
      setGroup(groupData)
      setWorkLeads(workLeadsData || [])
      setWorkLeadTypes(typesData || [])
      setError(null)
    } catch (err) {
      setError('Erreur lors du chargement')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Group work leads by type
  const groupedWorkLeads = workLeads.reduce((acc, item) => {
    const typeId = item.work_lead_type_id || 'no-type'
    const typeName = item.work_lead_type_name || 'Sans type'
    if (!acc[typeId]) {
      acc[typeId] = { name: typeName, items: [] }
    }
    acc[typeId].items.push(item)
    return acc
  }, {})

  const toggleGroup = (typeId) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [typeId]: !prev[typeId]
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setActionLoading(true)
    setActionError(null)
    try {
      const submitData = {
        name: formData.name,
        work_lead_type_id: formData.work_lead_type_id
      }

      if (editingItem) {
        await coachService.updateGroupWorkLead(groupId, editingItem.id, submitData)
      } else {
        await coachService.createGroupWorkLead(groupId, submitData)
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
    if (!window.confirm(`Supprimer l'axe de travail "${item.name}" ?`)) return
    try {
      await coachService.deleteGroupWorkLead(groupId, item.id)
      await loadData()
    } catch (err) {
      alert(err.response?.data?.detail || 'Erreur lors de la suppression')
    }
  }

  const handleArchive = async (item) => {
    if (!window.confirm(`Archiver l'axe de travail "${item.name}" ?`)) return
    try {
      await coachService.archiveGroupWorkLead(groupId, item.id)
      await loadData()
    } catch (err) {
      alert(err.response?.data?.detail || 'Erreur lors de l\'archivage')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      work_lead_type_id: ''
    })
  }

  const openCreateModal = () => {
    setEditingItem(null)
    resetForm()
    setActionError(null)
    setShowModal(true)
  }

  const openImportModal = async () => {
    setShowImportModal(true)
    setSelectedModelId('')
    setImportError(null)
    setModelsLoading(true)
    try {
      const models = await coachService.getWorkLeadModels()
      setAvailableModels(models || [])
    } catch (err) {
      setImportError('Erreur lors du chargement des modeles')
      console.error(err)
    } finally {
      setModelsLoading(false)
    }
  }

  const handleImport = async () => {
    if (!selectedModelId) return
    setImportLoading(true)
    setImportError(null)
    try {
      await coachService.importWorkLeadModel(groupId, selectedModelId)
      setShowImportModal(false)
      setSelectedModelId('')
      await loadData()
    } catch (err) {
      setImportError(err.response?.data?.detail || 'Erreur lors de l\'import')
    } finally {
      setImportLoading(false)
    }
  }

  const openEditModal = (item, e) => {
    e.stopPropagation()
    setEditingItem(item)
    setFormData({
      name: item.name,
      work_lead_type_id: item.work_lead_type_id || ''
    })
    setActionError(null)
    setShowModal(true)
  }

  const handleRowClick = (item) => {
    if (!item.is_deleted) {
      navigate(`/coach/groups/${groupId}/work-leads/${item.id}`)
    }
  }

  // Show "Etat" column only when showArchived or showDeleted is true
  const showEtatColumn = showArchived || showDeleted

  if (loading) {
    return (
      <CoachLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </CoachLayout>
    )
  }

  return (
    <CoachLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {group?.name}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Axes de travail
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Gerez les axes de travail du groupe
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <label className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="mr-2 rounded border-gray-300 dark:border-gray-600"
              />
              Archives
            </label>
            <label className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
                className="mr-2 rounded border-gray-300 dark:border-gray-600"
              />
              Supprimes
            </label>
            <button
              onClick={openImportModal}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Importer
            </button>
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nouvel axe
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-lg">
            {error}
          </div>
        )}

        {/* Grouped blocks by type */}
        {Object.keys(groupedWorkLeads).length === 0 ? (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-12 text-center text-gray-500 dark:text-gray-400">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p>Aucun axe de travail</p>
            <p className="text-sm mt-1">Creez votre premier axe de travail</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedWorkLeads).map(([typeId, typeGroup]) => (
              <div key={typeId} className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                {/* Group header - collapsible */}
                <button
                  onClick={() => toggleGroup(typeId)}
                  className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className="flex items-center">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                      {typeGroup.name}
                    </span>
                    <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">
                      {typeGroup.items.length} axe{typeGroup.items.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${collapsedGroups[typeId] ? '' : 'rotate-180'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Group content - table */}
                {!collapsedGroups[typeId] && (
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Nom
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Statut
                        </th>
                        {showEtatColumn && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Etat
                          </th>
                        )}
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Modifie le
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {typeGroup.items.map((item) => (
                        <tr
                          key={item.id}
                          className={`${item.is_deleted ? 'opacity-50' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                          onClick={() => handleRowClick(item)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {item.name}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {item.current_status ? (
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[item.current_status]?.bgClass || ''} ${STATUS_CONFIG[item.current_status]?.textClass || ''}`}>
                                {STATUS_CONFIG[item.current_status]?.label || item.current_status}
                              </span>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500">-</span>
                            )}
                          </td>
                          {showEtatColumn && (
                            <td className="px-6 py-4 whitespace-nowrap">
                              {item.is_deleted ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                                  Supprime
                                </span>
                              ) : item.is_archived ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                                  Archive
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                                  Actif
                                </span>
                              )}
                            </td>
                          )}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {new Date(item.updated_at).toLocaleDateString('fr-FR')}
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
                                  {!item.is_archived && (
                                    <button
                                      onClick={() => handleArchive(item)}
                                      className="text-amber-600 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300"
                                      title="Archiver"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                      </svg>
                                    </button>
                                  )}
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
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Create/Edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black opacity-50" onClick={() => setShowModal(false)}></div>
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                {editingItem ? 'Modifier l\'axe' : 'Nouvel axe de travail'}
              </h3>
              {actionError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
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
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Technique de barre"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Type d'axe *
                  </label>
                  <select
                    required
                    value={formData.work_lead_type_id}
                    onChange={(e) => setFormData({ ...formData, work_lead_type_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selectionnez un type</option>
                    {workLeadTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>

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

      {/* Modal Import */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black opacity-50" onClick={() => setShowImportModal(false)}></div>
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Importer un modele d'axe de travail
              </h3>
              {importError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
                  {importError}
                </div>
              )}
              {modelsLoading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                </div>
              ) : availableModels.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p>Aucun modele disponible</p>
                  <p className="text-sm mt-1">Les modeles sont crees par le Super Coach</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {availableModels.map((model) => (
                    <label
                      key={model.id}
                      className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedModelId === model.id
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30'
                          : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="model"
                        value={model.id}
                        checked={selectedModelId === model.id}
                        onChange={(e) => setSelectedModelId(e.target.value)}
                        className="sr-only"
                      />
                      <div className="flex-shrink-0 h-10 w-10 bg-emerald-100 dark:bg-emerald-900 rounded-lg flex items-center justify-center mr-3">
                        <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {model.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {model.work_lead_type_name || 'Sans type'}
                          {model.current_status && (
                            <span className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_CONFIG[model.current_status]?.bgClass || ''} ${STATUS_CONFIG[model.current_status]?.textClass || ''}`}>
                              {STATUS_CONFIG[model.current_status]?.label || model.current_status}
                            </span>
                          )}
                        </div>
                      </div>
                      {selectedModelId === model.id && (
                        <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </label>
                  ))}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  onClick={handleImport}
                  disabled={!selectedModelId || importLoading}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importLoading ? 'Import en cours...' : 'Importer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </CoachLayout>
  )
}

export default GroupWorkLeads
