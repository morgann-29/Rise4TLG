import { useState, useEffect, useCallback, useRef } from 'react'
import { fileService } from '../../services/fileService'
import ConfirmModal from '../shared/ConfirmModal'
import FileGrid from './FileGrid'

/**
 * FileManager - Composant de gestion de fichiers
 *
 * Props:
 * - entityType: string - Type d'entite (project, group, session, etc.)
 * - entityId: string - UUID de l'entite
 * - readOnly: boolean - Mode lecture seule (default: false)
 * - allowedTypes: string[] - Types autorises (default: tous)
 * - maxFileSize: number - Taille max en bytes (default: 50MB)
 * - onFileUploaded: (file) => void - Callback apres upload
 * - onFileDeleted: (fileId) => void - Callback apres suppression
 * - refreshTrigger: number - Incrementer pour forcer le rechargement (default: 0)
 * - className: string - Classes CSS supplementaires
 */
function FileManager({
  entityType,
  entityId,
  readOnly = false,
  allowedTypes = null,
  maxFileSize = 50 * 1024 * 1024, // 50MB
  onFileUploaded,
  onFileDeleted,
  refreshTrigger = 0,
  className = ''
}) {
  const [files, setFiles] = useState([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [limit, setLimit] = useState(20)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState('grid')
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteInfo, setDeleteInfo] = useState(null)
  const fileInputRef = useRef(null)
  const loadFilesRef = useRef(null) // Ref pour eviter re-abonnement du polling

  // Charger les fichiers (pagine)
  const loadFiles = useCallback(async () => {
    if (!entityType || !entityId) return

    try {
      setLoading(true)
      const data = await fileService.getFiles(entityType, entityId, { offset, limit })
      setFiles(data.items)
      setTotal(data.total)
      setError(null)
    } catch (err) {
      console.error('Erreur chargement fichiers:', err)
      setError('Erreur lors du chargement des fichiers')
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId, offset, limit])

  // Garder une ref a jour de loadFiles pour le polling
  useEffect(() => {
    loadFilesRef.current = loadFiles
  }, [loadFiles])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  // Rechargement via refreshTrigger
  useEffect(() => {
    if (refreshTrigger > 0) {
      loadFiles()
    }
  }, [refreshTrigger]) // eslint-disable-line react-hooks/exhaustive-deps

  // Polling automatique quand des fichiers sont en cours de traitement
  // Utilise une ref pour eviter le re-abonnement quand loadFiles change
  useEffect(() => {
    const hasProcessingFiles = files.some(f => fileService.isProcessing(f))

    if (!hasProcessingFiles) return

    const pollInterval = setInterval(() => {
      console.log('Polling for processing files...')
      loadFilesRef.current?.()
    }, 5000) // Poll toutes les 5 secondes

    return () => clearInterval(pollInterval)
  }, [files])

  // Gestion drag & drop
  const handleDrag = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback(async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (readOnly) return

    const droppedFiles = Array.from(e.dataTransfer.files)
    await handleUpload(droppedFiles)
  }, [readOnly]) // eslint-disable-line react-hooks/exhaustive-deps

  // Upload de fichiers
  const handleUpload = async (fileList) => {
    if (!fileList.length) return

    setUploading(true)
    setError(null)

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i]

        // Verifier la taille
        if (file.size > maxFileSize) {
          setError(`Le fichier "${file.name}" depasse la taille maximale (${fileService.formatFileSize(maxFileSize)})`)
          continue
        }

        // Verifier le type si restriction
        const detectedType = fileService.detectFileType(file.type)
        if (allowedTypes && !allowedTypes.includes(detectedType)) {
          setError(`Type de fichier non autorise: ${file.name}`)
          continue
        }

        setUploadProgress(Math.round((i / fileList.length) * 100))

        const uploadedFile = await fileService.uploadFile(
          file,
          entityType,
          entityId,
          detectedType
        )

        onFileUploaded?.(uploadedFile)
      }

      setUploadProgress(100)

      // Apres upload, revenir en page 1 et recharger
      setOffset(0)
    } catch (err) {
      console.error('Erreur upload:', err)
      setError(err.response?.data?.detail || 'Erreur lors de l\'upload')
    } finally {
      setUploading(false)
      setUploadProgress(0)
      // Recharger pour afficher les nouveaux fichiers
      loadFiles()
    }
  }

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files)
    handleUpload(selectedFiles)
    e.target.value = '' // Reset input
  }

  // Suppression
  const handleDeleteClick = async (file) => {
    setSelectedFile(file)
    try {
      const info = await fileService.getDeleteInfo(file.id, entityType, entityId)
      setDeleteInfo(info)
      setShowDeleteModal(true)
    } catch (err) {
      console.error('Erreur info suppression:', err)
      setError('Erreur lors de la verification')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!selectedFile) return

    try {
      await fileService.deleteFile(selectedFile.id, entityType, entityId)
      onFileDeleted?.(selectedFile.id)
      setShowDeleteModal(false)
      setSelectedFile(null)
      setDeleteInfo(null)

      // Recharger la page courante ; si la page serait vide, revenir en arriere
      if (files.length === 1 && offset > 0) {
        setOffset(Math.max(0, offset - limit))
      } else {
        loadFiles()
      }
    } catch (err) {
      console.error('Erreur suppression:', err)
      throw err
    }
  }

  // Pagination
  const handlePageChange = (newOffset) => {
    setOffset(newOffset)
  }

  const handleLimitChange = (newLimit) => {
    setLimit(newLimit)
    setOffset(0)
  }

  const getDeleteMessage = () => {
    if (!deleteInfo || !selectedFile) return ''

    if (deleteInfo.is_source) {
      return `Voulez-vous vraiment supprimer le fichier "${selectedFile.file_name}" ?`
    }
    return `Voulez-vous retirer le fichier "${selectedFile.file_name}" de cette entite ? Le fichier original ne sera pas supprime.`
  }

  const getDeleteWarning = () => {
    if (!deleteInfo) return null

    if (deleteInfo.is_source && deleteInfo.has_references) {
      return `Ce fichier est partage avec ${deleteInfo.reference_count} autre(s) entite(s). La suppression affectera egalement ces partages.`
    }
    return null
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <svg className="animate-spin h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Input file cache */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        accept={allowedTypes ? allowedTypes.map(t => {
          if (t === 'image') return 'image/*'
          if (t === 'video') return 'video/*'
          if (t === 'audio') return 'audio/*'
          return '*/*'
        }).join(',') : undefined}
      />

      {/* Erreur */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-3 mb-4">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Indicateur upload en cours */}
      {uploading && (
        <div className="flex items-center justify-center gap-3 p-3 mb-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg">
          <svg className="animate-spin h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm text-indigo-700 dark:text-indigo-300">
            Upload en cours... {uploadProgress}%
          </span>
        </div>
      )}

      {/* Header avec toggle vue et bouton upload */}
      {total > 0 && (
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {total} fichier{total > 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            {/* Bouton ajouter fichier */}
            {!readOnly && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                title={`Ajouter des fichiers (max ${fileService.formatFileSize(maxFileSize)})`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Ajouter
              </button>
            )}
            {/* Toggle vue */}
            <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}
                title="Vue grille"
              >
                <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}
                title="Vue liste"
              >
                <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zone de fichiers avec drag & drop */}
      <div
        className={`relative rounded-lg transition-colors ${
          !readOnly && dragActive
            ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-gray-900'
            : ''
        }`}
        onDragEnter={!readOnly ? handleDrag : undefined}
        onDragLeave={!readOnly ? handleDrag : undefined}
        onDragOver={!readOnly ? handleDrag : undefined}
        onDrop={!readOnly ? handleDrop : undefined}
      >
        {/* Overlay drag */}
        {!readOnly && dragActive && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-indigo-500/10 dark:bg-indigo-500/20 border-2 border-dashed border-indigo-500 rounded-lg">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="mt-2 text-sm font-medium text-indigo-600 dark:text-indigo-400">
                Deposez vos fichiers ici
              </p>
            </div>
          </div>
        )}

        {/* Contenu */}
        {files.length === 0 && total === 0 ? (
          !readOnly ? (
            <div
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-indigo-400 rounded-lg p-8 text-center cursor-pointer transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                <span className="font-medium text-indigo-600 dark:text-indigo-400">
                  Cliquez pour selectionner
                </span>
                {' '}ou glissez-deposez vos fichiers
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Max {fileService.formatFileSize(maxFileSize)} par fichier
              </p>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <svg className="mx-auto h-12 w-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <p>Aucun fichier</p>
            </div>
          )
        ) : (
          <FileGrid
            files={files}
            total={total}
            offset={offset}
            limit={limit}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            viewMode={viewMode}
            readOnly={readOnly}
            onDelete={readOnly ? undefined : handleDeleteClick}
          />
        )}
      </div>

      {/* Modal de confirmation suppression */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setSelectedFile(null)
          setDeleteInfo(null)
        }}
        onConfirm={handleDeleteConfirm}
        title="Supprimer le fichier"
        message={getDeleteMessage()}
        warning={getDeleteWarning()}
        confirmText="Supprimer"
        confirmColor="red"
      />
    </div>
  )
}

export default FileManager
