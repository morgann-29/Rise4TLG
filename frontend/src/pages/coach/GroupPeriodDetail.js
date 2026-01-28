import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import CoachLayout from '../../components/CoachLayout'
import FileManager from '../../components/FileManager'
import ContentEditor from '../../components/ContentEditor'
import { coachService } from '../../services/coachService'

function GroupPeriodDetail() {
  const { groupId, periodId } = useParams()
  const navigate = useNavigate()
  const [period, setPeriod] = useState(null)
  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Session masters state
  const [sessionMasters, setSessionMasters] = useState([])
  const [sessionMastersLoading, setSessionMastersLoading] = useState(false)

  // Participants modal state
  const [showParticipantsModal, setShowParticipantsModal] = useState(false)
  const [allProjects, setAllProjects] = useState([])
  const [selectedProjectIds, setSelectedProjectIds] = useState([])
  const [participantsLoading, setParticipantsLoading] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [periodData, groupData] = await Promise.all([
        coachService.getGroupPeriod(groupId, periodId),
        coachService.getGroupBasic(groupId)
      ])
      setPeriod(periodData)
      setGroup(groupData)
      setError(null)
    } catch (err) {
      console.error('Erreur chargement:', err)
      setError('Periode non trouvee')
    } finally {
      setLoading(false)
    }
  }, [groupId, periodId])

  const loadSessionMasters = useCallback(async () => {
    try {
      setSessionMastersLoading(true)
      const data = await coachService.getGroupPeriodSessionMasters(groupId, periodId)
      setSessionMasters(data)
    } catch (err) {
      console.error('Erreur chargement sessions:', err)
    } finally {
      setSessionMastersLoading(false)
    }
  }, [groupId, periodId])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (period) {
      loadSessionMasters()
    }
  }, [period, loadSessionMasters])

  // Save content handler for ContentEditor
  const handleSaveContent = async (content) => {
    await coachService.updateGroupPeriod(groupId, periodId, { content })
  }

  // Open participants modal
  const openParticipantsModal = async () => {
    try {
      setParticipantsLoading(true)
      setShowParticipantsModal(true)
      const projects = await coachService.getGroupProjects(groupId)
      setAllProjects(projects)
      setSelectedProjectIds(period.projects.map(p => p.project_id))
    } catch (err) {
      console.error('Erreur chargement projets:', err)
    } finally {
      setParticipantsLoading(false)
    }
  }

  // Save participants
  const saveParticipants = async () => {
    try {
      setParticipantsLoading(true)
      await coachService.updatePeriodParticipants(groupId, periodId, selectedProjectIds)
      await loadData()
      setShowParticipantsModal(false)
    } catch (err) {
      alert(err.response?.data?.detail || 'Erreur lors de la sauvegarde')
    } finally {
      setParticipantsLoading(false)
    }
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

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatDateTime = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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

  if (error || !period) {
    return (
      <CoachLayout>
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {error || 'Periode non trouvee'}
          </h3>
          <button
            onClick={() => navigate(`/coach/groups/${groupId}/periods`)}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Retour a la liste
          </button>
        </div>
      </CoachLayout>
    )
  }

  return (
    <CoachLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(`/coach/groups/${groupId}/periods`)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                {group?.name}
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {period.name}
              </h1>
              <div className="flex items-center space-x-2 mt-2 text-sm text-gray-500 dark:text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{formatDate(period.date_start)} - {formatDate(period.date_end)}</span>
              </div>
            </div>
          </div>

          {/* Participants badge */}
          <button
            onClick={openParticipantsModal}
            className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {period.project_count} projet{period.project_count > 1 ? 's' : ''}
          </button>
        </div>

        {/* Two-column layout: Sessions + Statistics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sessions */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                Seances
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Sessions de groupe dans cette periode
              </p>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-80 overflow-y-auto">
              {sessionMastersLoading ? (
                <div className="p-6 flex justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : sessionMasters.length === 0 ? (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                  Aucune seance dans cette periode
                </div>
              ) : (
                sessionMasters.map((session) => (
                  <div key={session.session_master_id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/coach/groups/${groupId}/sessions/${session.session_master_id}`}
                          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate block"
                        >
                          {session.session_master_name}
                        </Link>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {formatDateTime(session.date_start)}
                        </p>
                      </div>
                      {session.type_seance_name && (
                        <span className="ml-4 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                          {session.type_seance_name}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Statistics */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                Statistiques
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Metriques et indicateurs
              </p>
            </div>
            <div className="p-6 flex items-center justify-center min-h-[200px]">
              <div className="text-center text-gray-500 dark:text-gray-400">
                <svg className="mx-auto h-12 w-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-sm font-medium">A venir</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content Editor */}
        <ContentEditor
          value={period.content || ''}
          onSave={handleSaveContent}
          entityType="period_master"
          entityId={periodId}
          title="Contenu"
          description="Description et objectifs de cette periode"
          placeholder="Decrivez cette periode..."
          minHeight="300px"
          autoSaveDelay={3000}
        />

        {/* Files */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              Fichiers
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Documents, images et autres fichiers associes
            </p>
          </div>
          <div className="p-6">
            <FileManager
              entityType="period_master"
              entityId={periodId}
              onFileUploaded={(file) => console.log('File uploaded:', file)}
              onFileDeleted={(fileId) => console.log('File deleted:', fileId)}
            />
          </div>
        </div>
      </div>

      {/* Modal Participants */}
      {showParticipantsModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setShowParticipantsModal(false)}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Gerer les projets participants
              </h3>

              {participantsLoading && allProjects.length === 0 ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <>
                  <div className="border border-gray-300 dark:border-gray-600 rounded-lg max-h-60 overflow-y-auto mb-4">
                    {allProjects.map((project) => (
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

                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowParticipantsModal(false)}
                      disabled={participantsLoading}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={saveParticipants}
                      disabled={participantsLoading}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center"
                    >
                      {participantsLoading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Enregistrement...
                        </>
                      ) : (
                        'Enregistrer'
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </CoachLayout>
  )
}

export default GroupPeriodDetail
