import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import CoachLayout from '../../components/CoachLayout'
import FileManager from '../../components/FileManager'
import ContentEditor from '../../components/ContentEditor'
import { coachService } from '../../services/coachService'

// Status labels and colors (coherent with GroupSessionDetail)
const STATUS_CONFIG = {
  NEW: { label: 'Nouveau', bgClass: 'bg-purple-100 dark:bg-purple-900', textClass: 'text-purple-800 dark:text-purple-200' },
  TODO: { label: 'A travailler', bgClass: 'bg-blue-100 dark:bg-blue-900', textClass: 'text-blue-800 dark:text-blue-200' },
  WORKING: { label: 'Travaille', bgClass: 'bg-orange-100 dark:bg-orange-900', textClass: 'text-orange-800 dark:text-orange-200' },
  DANGER: { label: 'Danger', bgClass: 'bg-red-100 dark:bg-red-900', textClass: 'text-red-800 dark:text-red-200' },
  OK: { label: 'Valide', bgClass: 'bg-green-100 dark:bg-green-900', textClass: 'text-green-800 dark:text-green-200' }
}

const SESSIONS_PER_PAGE = 5

function GroupWorkLeadDetail() {
  const { groupId, workLeadId } = useParams()
  const navigate = useNavigate()
  const [workLead, setWorkLead] = useState(null)
  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Session history state
  const [sessionHistory, setSessionHistory] = useState([])
  const [sessionHistoryTotal, setSessionHistoryTotal] = useState(0)
  const [sessionHistoryLoading, setSessionHistoryLoading] = useState(false)
  const [sessionHistoryOffset, setSessionHistoryOffset] = useState(0)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [workLeadData, groupData] = await Promise.all([
        coachService.getGroupWorkLead(groupId, workLeadId),
        coachService.getGroupBasic(groupId)
      ])
      setWorkLead(workLeadData)
      setGroup(groupData)
      setError(null)
    } catch (err) {
      console.error('Erreur chargement:', err)
      setError('Axe de travail non trouve')
    } finally {
      setLoading(false)
    }
  }, [groupId, workLeadId])

  const loadSessionHistory = useCallback(async (offset = 0, append = false) => {
    try {
      setSessionHistoryLoading(true)
      const data = await coachService.getGroupWorkLeadSessions(groupId, workLeadId, offset, SESSIONS_PER_PAGE)
      if (append) {
        setSessionHistory(prev => [...prev, ...data.items])
      } else {
        setSessionHistory(data.items)
      }
      setSessionHistoryTotal(data.total)
      setSessionHistoryOffset(offset + data.items.length)
    } catch (err) {
      console.error('Erreur chargement historique:', err)
    } finally {
      setSessionHistoryLoading(false)
    }
  }, [groupId, workLeadId])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (workLead) {
      loadSessionHistory(0, false)
    }
  }, [workLead, loadSessionHistory])

  const handleShowMore = () => {
    loadSessionHistory(sessionHistoryOffset, true)
  }

  // Save content handler for ContentEditor
  const handleSaveContent = async (content) => {
    await coachService.updateGroupWorkLead(groupId, workLeadId, {
      name: workLead.name,
      work_lead_type_id: workLead.work_lead_type_id,
      content
    })
  }

  // Format type name with parent
  const getTypeName = () => {
    if (workLead.work_lead_type_parent_name && workLead.work_lead_type_name) {
      return `${workLead.work_lead_type_parent_name} - ${workLead.work_lead_type_name}`
    }
    return workLead.work_lead_type_name
  }

  // Format date for display
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

  if (error || !workLead) {
    return (
      <CoachLayout>
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {error || 'Axe de travail non trouve'}
          </h3>
          <button
            onClick={() => navigate(`/coach/groups/${groupId}/work-leads`)}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Retour a la liste
          </button>
        </div>
      </CoachLayout>
    )
  }

  const hasMoreSessions = sessionHistoryOffset < sessionHistoryTotal

  return (
    <CoachLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          {/* Left side: back button, group name, title, type badge */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(`/coach/groups/${groupId}/work-leads`)}
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
                {workLead.name}
              </h1>
              {workLead.work_lead_type_name && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 mt-2">
                  {getTypeName()}
                </span>
              )}
            </div>
          </div>

          {/* Right side: current status + archived badge */}
          <div className="flex items-start space-x-4">
            {workLead.current_status && (
              <div className="text-right">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Statut courant</div>
                <span className={`inline-flex items-center px-4 py-2 rounded-full text-base font-semibold ${STATUS_CONFIG[workLead.current_status]?.bgClass || ''} ${STATUS_CONFIG[workLead.current_status]?.textClass || ''}`}>
                  {STATUS_CONFIG[workLead.current_status]?.label || workLead.current_status}
                </span>
              </div>
            )}
            {workLead.is_archived && (
              <div className="text-right">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">&nbsp;</div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                  Archive
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Two-column layout: History + Statistics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Historique */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                Historique
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Sessions ou cet axe a ete utilise
              </p>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-80 overflow-y-auto">
              {sessionHistory.length === 0 && !sessionHistoryLoading ? (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                  Aucune session associee
                </div>
              ) : (
                sessionHistory.map((session) => (
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
                      <span className={`ml-4 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[session.status]?.bgClass || ''} ${STATUS_CONFIG[session.status]?.textClass || ''}`}>
                        {STATUS_CONFIG[session.status]?.label || session.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
            {/* Show more button */}
            {(hasMoreSessions || sessionHistoryLoading) && (
              <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <button
                  onClick={handleShowMore}
                  disabled={sessionHistoryLoading}
                  className="w-full text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {sessionHistoryLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      Chargement...
                    </>
                  ) : (
                    `Voir plus (${sessionHistoryTotal - sessionHistoryOffset} restants)`
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Statistiques */}
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
          value={workLead.content || ''}
          onSave={handleSaveContent}
          entityType="work_lead_master"
          entityId={workLeadId}
          title="Contenu"
          description="Description et objectifs de cet axe de travail"
          placeholder="Decrivez cet axe de travail..."
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
              entityType="work_lead_master"
              entityId={workLeadId}
              onFileUploaded={(file) => console.log('File uploaded:', file)}
              onFileDeleted={(fileId) => console.log('File deleted:', fileId)}
            />
          </div>
        </div>
      </div>
    </CoachLayout>
  )
}

export default GroupWorkLeadDetail
