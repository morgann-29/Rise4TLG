import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import CoachLayout from '../../components/CoachLayout'
import FileManager from '../../components/FileManager'
import RichTextEditor from '../../components/RichTextEditor'
import { coachService } from '../../services/coachService'

function GroupSessionDetail() {
  const { groupId, sessionId } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const [content, setContent] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [sessionData, groupData] = await Promise.all([
        coachService.getGroupSession(groupId, sessionId),
        coachService.getGroupBasic(groupId)
      ])
      setSession(sessionData)
      setGroup(groupData)
      setContent(sessionData.content || '')
      setError(null)
    } catch (err) {
      console.error('Erreur chargement:', err)
      setError('Session non trouvee')
    } finally {
      setLoading(false)
    }
  }, [groupId, sessionId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleContentChange = (newContent) => {
    setContent(newContent)
    setHasChanges(true)
    setSaveSuccess(false)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      await coachService.updateGroupSession(groupId, sessionId, {
        name: session.name,
        type_seance_id: session.type_seance_id,
        date_start: session.date_start,
        date_end: session.date_end,
        content
      })
      setHasChanges(false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error('Erreur sauvegarde:', err)
      alert(err.response?.data?.detail || 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
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

  if (error || !session) {
    return (
      <CoachLayout>
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {error || 'Session non trouvee'}
          </h3>
          <button
            onClick={() => navigate(`/coach/groups/${groupId}/sessions`)}
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
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(`/coach/groups/${groupId}/sessions`)}
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
                {session.name}
              </h1>
              <div className="flex items-center space-x-2 mt-1">
                {session.type_seance_name && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                    {session.type_seance_name}
                  </span>
                )}
                {session.type_seance_is_sailing ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200">
                    Navigation
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200">
                    A terre
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Save button */}
          <div className="flex items-center space-x-3">
            {saveSuccess && (
              <span className="text-sm text-green-600 dark:text-green-400 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Sauvegarde
              </span>
            )}
            {hasChanges && (
              <span className="text-sm text-amber-600 dark:text-amber-400">
                Modifications non sauvegardees
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {saving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Sauvegarde...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Sauvegarder
                </>
              )}
            </button>
          </div>
        </div>

        {/* Infos */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Date debut</span>
              <p className="font-medium text-gray-900 dark:text-white">
                {session.date_start
                  ? new Date(session.date_start).toLocaleString('fr-FR')
                  : '-'}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Date fin</span>
              <p className="font-medium text-gray-900 dark:text-white">
                {session.date_end
                  ? new Date(session.date_end).toLocaleString('fr-FR')
                  : '-'}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Cree le</span>
              <p className="font-medium text-gray-900 dark:text-white">
                {new Date(session.created_at).toLocaleDateString('fr-FR')}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Modifie le</span>
              <p className="font-medium text-gray-900 dark:text-white">
                {new Date(session.updated_at).toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>
        </div>

        {/* Content Editor */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              Contenu
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Notes et compte-rendu de la seance
            </p>
          </div>
          <div className="p-6">
            <RichTextEditor
              value={content}
              onChange={handleContentChange}
              entityType="session_master"
              entityId={sessionId}
              placeholder="Notes de la seance..."
              minHeight="300px"
            />
          </div>
        </div>

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
              entityType="session_master"
              entityId={sessionId}
              onFileUploaded={(file) => console.log('File uploaded:', file)}
              onFileDeleted={(fileId) => console.log('File deleted:', fileId)}
            />
          </div>
        </div>
      </div>
    </CoachLayout>
  )
}

export default GroupSessionDetail
