import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import SuperCoachLayout from '../components/SuperCoachLayout'
import FileManager from '../components/FileManager'
import ContentEditor from '../components/ContentEditor'
import { sessionMasterService } from '../services/sessionMasterService'

function SessionMasterDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [model, setModel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadModel = useCallback(async () => {
    try {
      setLoading(true)
      const data = await sessionMasterService.getModel(id)
      setModel(data)
      setError(null)
    } catch (err) {
      console.error('Erreur chargement modele:', err)
      setError('Modele non trouve')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadModel()
  }, [loadModel])

  // Save content handler for ContentEditor
  const handleSaveContent = async (content) => {
    await sessionMasterService.updateModel(id, { content })
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

  if (error || !model) {
    return (
      <SuperCoachLayout>
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {error || 'Modele non trouve'}
          </h3>
          <button
            onClick={() => navigate('/super-coach/session-models')}
            className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
          >
            Retour a la liste
          </button>
        </div>
      </SuperCoachLayout>
    )
  }

  return (
    <SuperCoachLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/super-coach/session-models')}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {model.name}
            </h1>
            <div className="flex items-center space-x-2 mt-1">
              {model.type_seance_name && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                  {model.type_seance_name}
                </span>
              )}
              {model.type_seance_is_sailing ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200">
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                  Navigation
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                  A terre
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Infos */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Cree le</span>
              <p className="font-medium text-gray-900 dark:text-white">
                {new Date(model.created_at).toLocaleDateString('fr-FR')}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Modifie le</span>
              <p className="font-medium text-gray-900 dark:text-white">
                {new Date(model.updated_at).toLocaleDateString('fr-FR')}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Type de seance</span>
              <p className="font-medium text-gray-900 dark:text-white">
                {model.type_seance_name || '-'}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Navigation</span>
              <p className="font-medium text-gray-900 dark:text-white">
                {model.type_seance_is_sailing ? 'En mer' : 'A terre'}
              </p>
            </div>
          </div>
        </div>

        {/* Content Editor */}
        <ContentEditor
          value={model.content || ''}
          onSave={handleSaveContent}
          entityType="session_master"
          entityId={id}
          title="Contenu"
          description="Description et instructions pour cette seance type"
          placeholder="Decrivez cette seance type..."
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
              entityType="session_master"
              entityId={id}
              onFileUploaded={(file) => console.log('File uploaded:', file)}
              onFileDeleted={(fileId) => console.log('File deleted:', fileId)}
            />
          </div>
        </div>
      </div>
    </SuperCoachLayout>
  )
}

export default SessionMasterDetail
