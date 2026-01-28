import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import CoachLayout from '../../components/CoachLayout'
import NavigantLayout from '../../components/NavigantLayout'
import FileManager from '../../components/FileManager'
import MasterFilesSection from '../../components/FileManager/MasterFilesSection'
import ContentEditor from '../../components/ContentEditor'
import RichTextEditor from '../../components/RichTextEditor'
import { coachService } from '../../services/coachService'
import { navigantService } from '../../services/navigantService'

function PeriodDetail() {
  const { periodId, groupId, projectId } = useParams()
  const navigate = useNavigate()
  const { isCoach } = useAuth()

  const isCoachContext = isCoach && !!groupId
  const Layout = isCoachContext ? CoachLayout : NavigantLayout

  const [period, setPeriod] = useState(null)
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Sessions state
  const [sessions, setSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(false)

  // Contenu commun states
  const [contenuCommunExpanded, setContenuCommunExpanded] = useState(true)

  // File refresh trigger (for MasterFilesSection -> FileManager sync)
  const [fileRefreshTrigger, setFileRefreshTrigger] = useState(0)

  // Content: can always edit own content
  const canEditContent = true

  // Build back navigation URL
  const getBackUrl = useCallback(() => {
    if (isCoachContext) {
      return `/coach/groups/${groupId}/projects/${projectId}/periods`
    }
    return `/navigant/projects/${projectId}/periods`
  }, [isCoachContext, groupId, projectId])

  // Build session link URL
  const getSessionUrl = useCallback((sessionId) => {
    if (isCoachContext) {
      return `/coach/groups/${groupId}/projects/${projectId}/sessions/${sessionId}`
    }
    return `/navigant/projects/${projectId}/sessions/${sessionId}`
  }, [isCoachContext, groupId, projectId])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)

      let periodData, projectData

      if (isCoachContext) {
        [periodData, projectData] = await Promise.all([
          coachService.getProjectPeriod(groupId, projectId, periodId),
          coachService.getProjectDetail(groupId, projectId)
        ])
      } else {
        [periodData, projectData] = await Promise.all([
          navigantService.getPeriod(projectId, periodId),
          navigantService.getMyProjects().then(projects =>
            projects.find(p => p.id === projectId)
          )
        ])
      }

      setPeriod(periodData)
      setProject(projectData)
      setError(null)
    } catch (err) {
      console.error('Erreur chargement:', err)
      setError('Periode non trouvee')
    } finally {
      setLoading(false)
    }
  }, [isCoachContext, groupId, projectId, periodId])

  const loadSessions = useCallback(async () => {
    try {
      setSessionsLoading(true)

      let data
      if (isCoachContext) {
        data = await coachService.getProjectPeriodSessions(groupId, projectId, periodId)
      } else {
        data = await navigantService.getPeriodSessions(projectId, periodId)
      }

      setSessions(data)
    } catch (err) {
      console.error('Erreur chargement sessions:', err)
    } finally {
      setSessionsLoading(false)
    }
  }, [isCoachContext, groupId, projectId, periodId])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (period) {
      loadSessions()
    }
  }, [period, loadSessions])

  // Save content handler
  const handleSaveContent = async (content) => {
    if (isCoachContext) {
      await coachService.updateProjectPeriod(groupId, projectId, periodId, { content })
    } else {
      await navigantService.updatePeriod(projectId, periodId, { content })
    }
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
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    )
  }

  if (error || !period) {
    return (
      <Layout>
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {error || 'Periode non trouvee'}
          </h3>
          <button
            onClick={() => navigate(getBackUrl())}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Retour a la liste
          </button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(getBackUrl())}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                {project?.name}
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

          {/* Type badge */}
          <div className="flex flex-wrap items-center gap-2">
            {period.period_master_id ? (
              <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Periode de groupe
              </span>
            ) : (
              <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                Periode individuelle
              </span>
            )}
          </div>
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
                Sessions dans cette periode
              </p>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-80 overflow-y-auto">
              {sessionsLoading ? (
                <div className="p-6 flex justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : sessions.length === 0 ? (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                  Aucune seance dans cette periode
                </div>
              ) : (
                sessions.map((session) => (
                  <div key={session.session_id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <Link
                          to={getSessionUrl(session.session_id)}
                          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate block"
                        >
                          {session.session_name}
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

        {/* Contenu Commun Block (only if period_master) */}
        {period.period_master_id && period.period_master?.content && (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <button
              onClick={() => setContenuCommunExpanded(!contenuCommunExpanded)}
              className="w-full px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center">
                <svg className={`w-5 h-5 mr-2 text-gray-500 dark:text-gray-400 transition-transform ${contenuCommunExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <div className="text-left">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                    Contenu Commun
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Contenu partage depuis la periode de groupe
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                Lecture seule
              </span>
            </button>

            {contenuCommunExpanded && (
              <div className="p-6">
                <RichTextEditor
                  value={period.period_master.content}
                  readOnly={true}
                  entityType="period_master"
                  entityId={period.period_master_id}
                />
              </div>
            )}
          </div>
        )}

        {/* Content Editor */}
        <ContentEditor
          value={period.content || ''}
          onSave={handleSaveContent}
          entityType="period"
          entityId={periodId}
          title="Contenu"
          description="Notes et objectifs de cette periode"
          placeholder="Notes de la periode..."
          minHeight="300px"
          autoSaveDelay={3000}
          readOnly={!canEditContent}
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
              entityType="period"
              entityId={periodId}
              refreshTrigger={fileRefreshTrigger}
              onFileUploaded={(file) => console.log('File uploaded:', file)}
              onFileDeleted={(fileId) => console.log('File deleted:', fileId)}
            />
          </div>
        </div>

        {/* Fichiers Communs Block (only if period_master) */}
        {period.period_master_id && (
          <MasterFilesSection
            masterEntityType="period_master"
            masterEntityId={period.period_master_id}
            targetEntityType="period"
            targetEntityId={periodId}
            title="Fichiers Communs"
            description="Fichiers de la periode de groupe - selectionnez pour les associer"
            emptyMessage="Aucun fichier partage depuis la periode de groupe"
            shareButtonText="Associer a ma periode"
            sharingText="Association..."
            onFileShared={() => setFileRefreshTrigger(prev => prev + 1)}
          />
        )}
      </div>
    </Layout>
  )
}

export default PeriodDetail
