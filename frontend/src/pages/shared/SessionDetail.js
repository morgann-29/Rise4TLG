import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import CoachLayout from '../../components/CoachLayout'
import NavigantLayout from '../../components/NavigantLayout'
import FileManager from '../../components/FileManager'
import ContentEditor from '../../components/ContentEditor'
import RichTextEditor from '../../components/RichTextEditor'
import LocationPicker from '../../components/LocationPicker'
import { coachService } from '../../services/coachService'
import { navigantService } from '../../services/navigantService'
import { fileService } from '../../services/fileService'

function SessionDetail() {
  const { sessionId, groupId, projectId } = useParams()
  const navigate = useNavigate()
  const { isCoach } = useAuth()

  const Layout = isCoach ? CoachLayout : NavigantLayout

  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Modal states
  const [showCrewModal, setShowCrewModal] = useState(false)
  const [showDatesModal, setShowDatesModal] = useState(false)
  const [showDataModal, setShowDataModal] = useState(false)
  const [editDateStart, setEditDateStart] = useState('')
  const [editDateEnd, setEditDateEnd] = useState('')
  const [editLocation, setEditLocation] = useState(null)
  const [modalSaving, setModalSaving] = useState(false)

  // Thematique states
  const [thematiquesExpanded, setThematiquesExpanded] = useState(true)
  const [showThematiquesModal, setShowThematiquesModal] = useState(false)
  const [allProjectWorkLeads, setAllProjectWorkLeads] = useState([])
  const [thematiquesModalLoading, setThematiquesModalLoading] = useState(false)
  const [collapsedTypes, setCollapsedTypes] = useState({})
  const [pendingStatuses, setPendingStatuses] = useState({})
  const [initialStatuses, setInitialStatuses] = useState({})

  // Contenu commun states
  const [contenuCommunExpanded, setContenuCommunExpanded] = useState(true)

  // Fichiers communs states
  const [fichiersCommunsExpanded, setFichiersCommunsExpanded] = useState(false)
  const [masterFiles, setMasterFiles] = useState([])
  const [masterFilesLoading, setMasterFilesLoading] = useState(false)
  const [sharingFileId, setSharingFileId] = useState(null)

  // Both coach and navigant can edit their sessions (dates, location, weather, thematiques)
  const canEdit = true
  // Content: coach can always edit, navigant can edit only for non-master sessions
  const canEditContent = isCoach || !session?.session_master_id

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      let sessionData
      if (isCoach && groupId && projectId) {
        sessionData = await coachService.getProjectSessionDetail(groupId, projectId, sessionId)
      } else {
        sessionData = await navigantService.getSessionDetail(projectId, sessionId)
      }
      setSession(sessionData)
      setError(null)
    } catch (err) {
      console.error('Erreur chargement:', err)
      setError('Session non trouvee')
    } finally {
      setLoading(false)
    }
  }, [sessionId, groupId, projectId, isCoach])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Load master files when section is expanded
  useEffect(() => {
    if (fichiersCommunsExpanded && session?.session_master_id && masterFiles.length === 0) {
      loadMasterFiles()
    }
  }, [fichiersCommunsExpanded, session?.session_master_id])

  const loadMasterFiles = async () => {
    if (!session?.session_master_id) return
    try {
      setMasterFilesLoading(true)
      const files = await fileService.getFiles('session_master', session.session_master_id)
      setMasterFiles(files)
    } catch (err) {
      console.error('Erreur chargement fichiers communs:', err)
    } finally {
      setMasterFilesLoading(false)
    }
  }

  // Save content handler
  const handleSaveContent = async (content) => {
    if (isCoach && groupId && projectId) {
      await coachService.updateProjectSession(groupId, projectId, sessionId, {
        name: session.name,
        type_seance_id: session.type_seance_id,
        date_start: session.date_start,
        date_end: session.date_end,
        location: session.location,
        content
      })
    } else {
      await navigantService.updateSession(projectId, sessionId, {
        name: session.name,
        type_seance_id: session.type_seance_id,
        date_start: session.date_start,
        date_end: session.date_end,
        location: session.location,
        content
      })
    }
  }

  // Open dates modal
  const openDatesModal = () => {
    if (!canEdit) return
    const formatDateForInput = (dateStr) => {
      if (!dateStr) return ''
      const date = new Date(dateStr)
      return date.toISOString().slice(0, 16)
    }
    setEditDateStart(formatDateForInput(session.date_start))
    setEditDateEnd(formatDateForInput(session.date_end))
    setShowDatesModal(true)
  }

  // Save dates
  const saveDates = async () => {
    setModalSaving(true)
    try {
      if (isCoach && groupId && projectId) {
        await coachService.updateProjectSession(groupId, projectId, sessionId, {
          name: session.name,
          type_seance_id: session.type_seance_id,
          date_start: editDateStart || null,
          date_end: editDateEnd || null,
          location: session.location,
          content: session.content
        })
      } else {
        await navigantService.updateSession(projectId, sessionId, {
          name: session.name,
          type_seance_id: session.type_seance_id,
          date_start: editDateStart || null,
          date_end: editDateEnd || null,
          location: session.location,
          content: session.content
        })
      }
      setSession({ ...session, date_start: editDateStart || null, date_end: editDateEnd || null })
      setShowDatesModal(false)
    } catch (err) {
      console.error('Erreur sauvegarde dates:', err)
      alert(err.response?.data?.detail || 'Erreur lors de la sauvegarde')
    } finally {
      setModalSaving(false)
    }
  }

  // Open data/weather modal
  const openDataModal = () => {
    if (!canEdit) return
    setEditLocation(session.location || null)
    setShowDataModal(true)
  }

  // Save data/weather
  const saveData = async () => {
    setModalSaving(true)
    try {
      if (isCoach && groupId && projectId) {
        await coachService.updateProjectSession(groupId, projectId, sessionId, {
          name: session.name,
          type_seance_id: session.type_seance_id,
          date_start: session.date_start,
          date_end: session.date_end,
          location: editLocation,
          content: session.content
        })
      } else {
        await navigantService.updateSession(projectId, sessionId, {
          name: session.name,
          type_seance_id: session.type_seance_id,
          date_start: session.date_start,
          date_end: session.date_end,
          location: editLocation,
          content: session.content
        })
      }
      setSession({ ...session, location: editLocation })
      setShowDataModal(false)
    } catch (err) {
      console.error('Erreur sauvegarde donnees:', err)
      alert(err.response?.data?.detail || 'Erreur lors de la sauvegarde')
    } finally {
      setModalSaving(false)
    }
  }

  // Open thematiques modal
  const openThematiquesModal = async () => {
    if (!canEdit) return
    setThematiquesModalLoading(true)
    setShowThematiquesModal(true)
    try {
      let workLeads
      if (isCoach && groupId && projectId) {
        workLeads = await coachService.getProjectWorkLeads(groupId, projectId, false, false)
      } else {
        workLeads = await navigantService.getWorkLeads(projectId, false, false)
      }
      setAllProjectWorkLeads(workLeads)
      // Initialize pending statuses from current session data
      const statuses = {}
      session.work_leads?.forEach(wl => {
        statuses[wl.work_lead_id] = wl.status
      })
      setInitialStatuses(statuses)
      setPendingStatuses(statuses)
    } catch (err) {
      console.error('Erreur chargement thematiques:', err)
    } finally {
      setThematiquesModalLoading(false)
    }
  }

  // Toggle status for a work_lead
  const toggleStatus = (workLeadId, status) => {
    setPendingStatuses(prev => {
      const current = prev[workLeadId]
      if (current === status) {
        const newStatuses = { ...prev }
        delete newStatuses[workLeadId]
        return newStatuses
      }
      return { ...prev, [workLeadId]: status }
    })
  }

  // Save thematiques
  const saveThematiques = async () => {
    setModalSaving(true)
    try {
      const promises = []

      // Add or update
      for (const [wlId, status] of Object.entries(pendingStatuses)) {
        if (isCoach && groupId && projectId) {
          promises.push(coachService.updateProjectSessionWorkLead(groupId, projectId, sessionId, wlId, status))
        } else {
          promises.push(navigantService.updateSessionWorkLead(projectId, sessionId, wlId, status))
        }
      }

      // Delete removed entries (were in initial but not in pending)
      for (const wlId of Object.keys(initialStatuses)) {
        if (!(wlId in pendingStatuses)) {
          if (isCoach && groupId && projectId) {
            promises.push(coachService.updateProjectSessionWorkLead(groupId, projectId, sessionId, wlId, null))
          } else {
            promises.push(navigantService.updateSessionWorkLead(projectId, sessionId, wlId, null))
          }
        }
      }

      await Promise.all(promises)
      await loadData()
      setShowThematiquesModal(false)
    } catch (err) {
      console.error('Erreur sauvegarde thematiques:', err)
      alert(err.response?.data?.detail || 'Erreur lors de la sauvegarde')
    } finally {
      setModalSaving(false)
    }
  }

  // Toggle type collapse
  const toggleTypeCollapse = (typeId) => {
    setCollapsedTypes(prev => ({
      ...prev,
      [typeId]: !prev[typeId]
    }))
  }

  // Share file from master to session
  const handleShareFile = async (fileId) => {
    try {
      setSharingFileId(fileId)
      await fileService.shareFile(fileId, 'session', sessionId)
    } catch (err) {
      console.error('Erreur partage fichier:', err)
      alert(err.response?.data?.detail || 'Erreur lors du partage')
    } finally {
      setSharingFileId(null)
    }
  }

  // Status colors
  const getStatusColor = (status) => {
    switch (status) {
      case 'TODO': return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700'
      case 'DANGER': return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700'
      case 'WORKING': return 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 border-orange-300 dark:border-orange-700'
      case 'OK': return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700'
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600'
    }
  }

  // Group work leads by type (with parent name if exists)
  const groupByType = (workLeads) => {
    const grouped = {}
    workLeads.forEach(wl => {
      const typeId = wl.work_lead_type_id
      const typeName = wl.work_lead_type_parent_name
        ? `${wl.work_lead_type_parent_name} - ${wl.work_lead_type_name}`
        : (wl.work_lead_type_name || 'Sans type')
      if (!grouped[typeId]) {
        grouped[typeId] = { name: typeName, items: [] }
      }
      grouped[typeId].items.push(wl)
    })
    return grouped
  }

  // Get session type badge
  const getSessionTypeBadge = () => {
    if (!session.session_master_id) {
      return (
        <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
          Seance Individuelle
        </span>
      )
    }
    if (session.session_master?.coach_id) {
      return (
        <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Seance Encadree
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        Seance Supervisee
      </span>
    )
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

  if (error || !session) {
    return (
      <Layout>
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {error || 'Session non trouvee'}
          </h3>
          <button
            onClick={() => navigate(-1)}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Retour
          </button>
        </div>
      </Layout>
    )
  }

  const isCompleted = session.date_end && new Date(session.date_end) < new Date()

  // Calcul de la duree
  const getDuration = () => {
    if (!session.date_start || !session.date_end) return null
    const start = new Date(session.date_start)
    const end = new Date(session.date_end)
    const diffMs = end - start
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    if (diffHours > 0 && diffMins > 0) return `${diffHours}h${diffMins.toString().padStart(2, '0')}`
    if (diffHours > 0) return `${diffHours}h`
    return `${diffMins}min`
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                {session.project_name}
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {session.name}
              </h1>
            </div>
          </div>

          {/* Type badges */}
          <div className="flex items-center space-x-3">
            {session.type_seance_name && (
              <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                {session.type_seance_name}
              </span>
            )}
            {session.type_seance_is_sailing ? (
              <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200">
                <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                Navigation
              </span>
            ) : (
              <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200">
                <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                A terre
              </span>
            )}
            {getSessionTypeBadge()}
          </div>
        </div>

        {/* Infos - 3 blocs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Bloc gauche - Date et duree */}
          <div
            className={`rounded-lg p-4 ${
              isCompleted
                ? 'bg-green-50 dark:bg-green-900/30'
                : 'bg-blue-50 dark:bg-blue-900/30'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <svg className={`w-5 h-5 mr-2 ${isCompleted ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className={`text-xs font-medium ${isCompleted ? 'text-green-700 dark:text-green-300' : 'text-blue-700 dark:text-blue-300'}`}>
                  {isCompleted ? 'Seance realisee' : 'Seance programmee'}
                </span>
              </div>
              {canEdit && (
                <button
                  onClick={openDatesModal}
                  className={`p-1.5 rounded-lg transition-colors ${isCompleted ? 'hover:bg-green-100 dark:hover:bg-green-800' : 'hover:bg-blue-100 dark:hover:bg-blue-800'}`}
                >
                  <svg className={`w-4 h-4 ${isCompleted ? 'text-green-400' : 'text-blue-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
            </div>
            <p className={`text-sm ${isCompleted ? 'text-green-800 dark:text-green-200' : 'text-blue-800 dark:text-blue-200'}`}>
              {session.date_start
                ? new Date(session.date_start).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })
                : 'Date non definie'}
            </p>
            {session.date_start && (
              <p className={`text-xl font-bold mt-1 ${isCompleted ? 'text-green-900 dark:text-green-100' : 'text-blue-900 dark:text-blue-100'}`}>
                {new Date(session.date_start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                {getDuration() && (
                  <span className="ml-2 text-base font-semibold">
                    ({getDuration()})
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Bloc central - Equipage et coach */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Equipage</span>
              </div>
              <button
                onClick={() => setShowCrewModal(true)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
            {/* Crew */}
            <div className="mb-3">
              {session.crew && session.crew.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {session.crew.map((member) => (
                    <span
                      key={member.profile_id}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                    >
                      {member.name || member.email || 'Membre'}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-gray-500 dark:text-gray-400">Aucun equipier</span>
              )}
            </div>
            {/* Coach (only if session_master with coach) */}
            {session.session_master?.coach_id && (
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">
                  {session.session_master.coach_name || 'Coach'}
                </span>
              </div>
            )}
          </div>

          {/* Bloc droit - Meteo et Data */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Meteo et Data</span>
              </div>
              {canEdit && (
                <button
                  onClick={openDataModal}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
            </div>
            <div className="flex items-center justify-center h-16">
              {session.location ? (
                <div className="text-center">
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {session.location.lat?.toFixed(4)}, {session.location.lng?.toFixed(4)}
                  </span>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Lieu defini</p>
                </div>
              ) : isCompleted ? (
                <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                  Meteo indisponible
                </span>
              ) : (
                <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                  La meteo sera disponible plus tard
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Thematique Block */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <button
            onClick={() => session.work_leads?.length > 0 ? setThematiquesExpanded(!thematiquesExpanded) : (canEdit && openThematiquesModal())}
            className="w-full px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center">
              <svg className={`w-5 h-5 mr-2 text-gray-500 dark:text-gray-400 transition-transform ${thematiquesExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <div className="text-left">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                  Thematique
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {session.work_leads?.length > 0
                    ? `${session.work_leads.length} axe${session.work_leads.length > 1 ? 's' : ''} de travail`
                    : 'Aucun axe de travail associe'
                  }
                </p>
              </div>
            </div>
            {canEdit && (
              <div
                onClick={(e) => { e.stopPropagation(); openThematiquesModal() }}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
            )}
          </button>

          {thematiquesExpanded && session.work_leads?.length > 0 && (
            <div className="p-6">
              {Object.entries(groupByType(session.work_leads)).map(([typeId, { name: typeName, items }]) => (
                <div key={typeId} className="mb-4 last:mb-0">
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    {typeName}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {items.map(wl => (
                      <button
                        key={wl.work_lead_id}
                        onClick={() => navigate(isCoach && groupId ? `/coach/groups/${groupId}/projects/${projectId}/work-leads/${wl.work_lead_id}` : `/navigant/projects/${projectId}/work-leads/${wl.work_lead_id}`)}
                        className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border cursor-pointer hover:opacity-80 transition-opacity ${getStatusColor(wl.status)}`}
                      >
                        {/* Icon for master link - before name */}
                        {wl.work_lead_master_id && (
                          <svg className="w-3.5 h-3.5 mr-1.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="Lie a un modele">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                        )}
                        {wl.work_lead_name}
                        {/* Indicator for override - orange dot */}
                        {wl.override_master === true && (
                          <span className="ml-1.5 w-2 h-2 rounded-full bg-amber-500" title="Personnalise (desynchronise du modele)"></span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contenu Commun Block (only if session_master) */}
        {session.session_master_id && session.session_master?.content && (
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
                    Contenu partage depuis la seance de groupe
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
                  value={session.session_master.content}
                  readOnly={true}
                  entityType="session_master"
                  entityId={session.session_master_id}
                />
              </div>
            )}
          </div>
        )}

        {/* Content Editor */}
        <ContentEditor
          value={session.content || ''}
          onSave={handleSaveContent}
          entityType="session"
          entityId={sessionId}
          title="Contenu"
          description="Notes et compte-rendu de la seance"
          placeholder="Notes de la seance..."
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
              entityType="session"
              entityId={sessionId}
              readOnly={!canEdit}
              onFileUploaded={(file) => console.log('File uploaded:', file)}
              onFileDeleted={(fileId) => console.log('File deleted:', fileId)}
            />
          </div>
        </div>

        {/* Fichiers Communs Block (only if session_master) */}
        {session.session_master_id && (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <button
              onClick={() => setFichiersCommunsExpanded(!fichiersCommunsExpanded)}
              className="w-full px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center">
                <svg className={`w-5 h-5 mr-2 text-gray-500 dark:text-gray-400 transition-transform ${fichiersCommunsExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <div className="text-left">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                    Fichiers Communs
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Fichiers de la seance de groupe - selectionnez pour les associer
                  </p>
                </div>
              </div>
            </button>

            {fichiersCommunsExpanded && (
              <div className="p-6">
                {masterFilesLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : masterFiles.length === 0 ? (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                    Aucun fichier partage depuis la seance de groupe
                  </p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {masterFiles.map((file) => (
                      <div
                        key={file.id}
                        className="relative group border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
                      >
                        {file.file_type === 'image' && file.signed_url ? (
                          <img
                            src={file.signed_url}
                            alt={file.file_name}
                            className="w-full h-24 object-cover rounded mb-2"
                          />
                        ) : (
                          <div className="w-full h-24 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center mb-2">
                            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                        )}
                        <p className="text-xs text-gray-600 dark:text-gray-300 truncate" title={file.file_name}>
                          {file.file_name}
                        </p>
                        <button
                          onClick={() => handleShareFile(file.id)}
                          disabled={sharingFileId === file.id}
                          className="mt-2 w-full px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded transition-colors disabled:opacity-50"
                        >
                          {sharingFileId === file.id ? 'Association...' : 'Associer a ma seance'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Equipage */}
      {showCrewModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setShowCrewModal(false)}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Gerer l'equipage
              </h3>
              <div className="py-8 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-500 dark:text-gray-400">
                  Fonctionnalite indisponible
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                  La gestion avancee de l'equipage sera disponible prochainement.
                </p>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowCrewModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dates */}
      {showDatesModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setShowDatesModal(false)}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Modifier les dates
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date et heure de debut
                  </label>
                  <input
                    type="datetime-local"
                    value={editDateStart}
                    onChange={(e) => setEditDateStart(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date et heure de fin
                  </label>
                  <input
                    type="datetime-local"
                    value={editDateEnd}
                    onChange={(e) => setEditDateEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowDatesModal(false)}
                  disabled={modalSaving}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={saveDates}
                  disabled={modalSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center"
                >
                  {modalSaving ? (
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
            </div>
          </div>
        </div>
      )}

      {/* Modal Thematiques */}
      {showThematiquesModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setShowThematiquesModal(false)}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Gerer les thematiques
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Associez des axes de travail et definissez leur statut pour cette seance
                </p>
              </div>

              {thematiquesModalLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-6">
                  {allProjectWorkLeads.length === 0 ? (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                      Aucun axe de travail dans ce projet
                    </p>
                  ) : (
                    Object.entries(groupByType(allProjectWorkLeads)).map(([typeId, { name: typeName, items }]) => (
                      <div key={typeId} className="mb-4 last:mb-0 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleTypeCollapse(typeId)}
                          className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <span className="font-medium text-gray-900 dark:text-white">
                            {typeName}
                          </span>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {items.filter(wl => pendingStatuses[wl.id]).length} / {items.length}
                            </span>
                            <svg
                              className={`w-5 h-5 text-gray-400 transition-transform ${collapsedTypes[typeId] ? '' : 'rotate-180'}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>

                        {!collapsedTypes[typeId] && (
                          <div className="divide-y divide-gray-100 dark:divide-gray-700">
                            {items.map(wl => (
                              <div key={wl.id} className="px-4 py-3 flex items-center justify-between">
                                <button
                                  onClick={() => { setShowThematiquesModal(false); navigate(isCoach && groupId ? `/coach/groups/${groupId}/projects/${projectId}/work-leads/${wl.id}` : `/navigant/projects/${projectId}/work-leads/${wl.id}`) }}
                                  className="text-sm text-gray-900 dark:text-white font-medium hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left"
                                >
                                  {wl.name}
                                </button>
                                <div className="flex items-center space-x-1">
                                  {['TODO', 'WORKING', 'DANGER', 'OK'].map(status => {
                                    const isActive = pendingStatuses[wl.id] === status
                                    const baseClasses = 'px-2.5 py-1 text-xs font-medium rounded transition-all'
                                    let colorClasses = 'bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-500'

                                    if (isActive) {
                                      switch (status) {
                                        case 'TODO':
                                          colorClasses = 'bg-blue-500 text-white'
                                          break
                                        case 'WORKING':
                                          colorClasses = 'bg-orange-500 text-white'
                                          break
                                        case 'DANGER':
                                          colorClasses = 'bg-red-500 text-white'
                                          break
                                        case 'OK':
                                          colorClasses = 'bg-green-500 text-white'
                                          break
                                        default:
                                          break
                                      }
                                    }

                                    return (
                                      <button
                                        key={status}
                                        onClick={() => toggleStatus(wl.id, status)}
                                        className={`${baseClasses} ${colorClasses}`}
                                      >
                                        {status === 'DANGER' ? 'WARN' : status}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowThematiquesModal(false)}
                  disabled={modalSaving}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={saveThematiques}
                  disabled={modalSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 flex items-center"
                >
                  {modalSaving ? (
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
            </div>
          </div>
        </div>
      )}

      {/* Modal Data/Meteo */}
      {showDataModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setShowDataModal(false)}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Meteo et Data
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Gerez le lieu de la seance. Les donnees meteo seront disponibles ulterieurement.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Lieu de la seance
                  </label>
                  <LocationPicker
                    value={editLocation}
                    onChange={setEditLocation}
                  />
                </div>

                <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center">
                  <svg className="mx-auto h-10 w-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Les donnees meteo et autres informations seront disponibles ici
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowDataModal(false)}
                  disabled={modalSaving}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={saveData}
                  disabled={modalSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center"
                >
                  {modalSaving ? (
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
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

export default SessionDetail
