import { useState, useEffect, useCallback } from 'react'
import { fileService } from '../../services/fileService'
import FileGrid from './FileGrid'

/**
 * MasterFilesSection - Section collapsible affichant les fichiers d'une entite master
 * avec bouton "Associer" et badge "Ajoute" pour les fichiers deja partages.
 *
 * Props:
 * - masterEntityType: string - ex: "session_master" ou "period_master"
 * - masterEntityId: string - UUID de l'entite master
 * - targetEntityType: string - ex: "session" ou "period"
 * - targetEntityId: string - UUID de l'entite cible
 * - title: string - Titre de la section (default: "Fichiers Communs")
 * - description: string - Sous-titre
 * - emptyMessage: string - Message si aucun fichier
 * - shareButtonText: string - ex: "Associer a ma seance"
 * - sharingText: string - ex: "Association..."
 * - onFileShared: () => void - Callback apres partage reussi
 * - defaultExpanded: boolean - (default: false)
 */
function MasterFilesSection({
  masterEntityType,
  masterEntityId,
  targetEntityType,
  targetEntityId,
  title = 'Fichiers Communs',
  description = '',
  emptyMessage = 'Aucun fichier',
  shareButtonText = 'Associer',
  sharingText = 'Association...',
  onFileShared,
  defaultExpanded = false
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [masterFiles, setMasterFiles] = useState([])
  const [masterTotal, setMasterTotal] = useState(0)
  const [masterOffset, setMasterOffset] = useState(0)
  const [masterLimit, setMasterLimit] = useState(20)
  const [loading, setLoading] = useState(false)
  const [targetFileIds, setTargetFileIds] = useState(new Set())
  const [targetLoaded, setTargetLoaded] = useState(false)
  const [sharingFileId, setSharingFileId] = useState(null)

  // Charger les fichiers master (pagines) et les IDs cible
  const loadMasterFiles = useCallback(async () => {
    if (!masterEntityId) return
    try {
      setLoading(true)
      const data = await fileService.getFiles(masterEntityType, masterEntityId, {
        offset: masterOffset,
        limit: masterLimit
      })
      setMasterFiles(data.items)
      setMasterTotal(data.total)
    } catch (err) {
      console.error('Erreur chargement fichiers communs:', err)
    } finally {
      setLoading(false)
    }
  }, [masterEntityType, masterEntityId, masterOffset, masterLimit])

  // Charger les IDs de fichiers de l'entite cible (une seule fois)
  const loadTargetFileIds = useCallback(async () => {
    if (!targetEntityId || targetLoaded) return
    try {
      const ids = new Set()
      let offset = 0
      const limit = 100
      let total = Infinity
      while (offset < total) {
        const data = await fileService.getFiles(targetEntityType, targetEntityId, { offset, limit })
        data.items.forEach(f => ids.add(f.id))
        total = data.total
        offset += limit
      }
      setTargetFileIds(ids)
      setTargetLoaded(true)
    } catch (err) {
      console.error('Erreur chargement fichiers cible:', err)
    }
  }, [targetEntityType, targetEntityId, targetLoaded])

  // Charger au premier expand
  useEffect(() => {
    if (expanded && masterEntityId) {
      loadMasterFiles()
      loadTargetFileIds()
    }
  }, [expanded, masterEntityId, loadMasterFiles, loadTargetFileIds])

  // Partager un fichier
  const handleShare = async (fileId) => {
    try {
      setSharingFileId(fileId)
      await fileService.shareFile(fileId, targetEntityType, targetEntityId)
      // Marquer comme partage localement (optimiste)
      setTargetFileIds(prev => new Set([...prev, fileId]))
      // Notifier le parent pour rafraichir le FileManager
      onFileShared?.()
    } catch (err) {
      console.error('Erreur partage fichier:', err)
      alert(err.response?.data?.detail || 'Erreur lors du partage')
    } finally {
      setSharingFileId(null)
    }
  }

  const isAlreadyShared = (fileId) => targetFileIds.has(fileId)

  // Pagination handlers
  const handlePageChange = (newOffset) => {
    setMasterOffset(newOffset)
  }

  const handleLimitChange = (newLimit) => {
    setMasterLimit(newLimit)
    setMasterOffset(0)
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
      {/* Header collapsible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center">
          <svg
            className={`w-5 h-5 mr-2 text-gray-500 dark:text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <div className="text-left">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              {title}
            </h2>
            {description && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {description}
              </p>
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="p-6">
          {loading && masterFiles.length === 0 ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : masterTotal === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              {emptyMessage}
            </p>
          ) : (
            <FileGrid
              files={masterFiles}
              total={masterTotal}
              offset={masterOffset}
              limit={masterLimit}
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
              viewMode="grid"
              readOnly={true}
              renderFileActions={(file) => (
                isAlreadyShared(file.id) ? (
                  <div className="w-full px-2 py-1 text-xs font-medium text-center text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 rounded">
                    Ajoute
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleShare(file.id) }}
                    disabled={sharingFileId === file.id}
                    className="w-full px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded transition-colors disabled:opacity-50"
                  >
                    {sharingFileId === file.id ? sharingText : shareButtonText}
                  </button>
                )
              )}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default MasterFilesSection
