import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { fileService } from '../../services/fileService'
import ConfirmModal from '../shared/ConfirmModal'

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
  className = ''
}) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'list'
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [showFullscreen, setShowFullscreen] = useState(false)
  const [fullscreenIndex, setFullscreenIndex] = useState(0)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteInfo, setDeleteInfo] = useState(null)
  const fileInputRef = useRef(null)

  // Liste des fichiers visualisables (images uniquement) pour la navigation fullscreen
  const viewableFiles = useMemo(() => {
    return files.filter(f => fileService.isViewable(f))
  }, [files])

  // Charger les fichiers
  const loadFiles = useCallback(async () => {
    if (!entityType || !entityId) return

    try {
      setLoading(true)
      const data = await fileService.getFiles(entityType, entityId)
      setFiles(data)
      setError(null)
    } catch (err) {
      console.error('Erreur chargement fichiers:', err)
      setError('Erreur lors du chargement des fichiers')
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

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
  }, [readOnly])

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

        setFiles(prev => [uploadedFile, ...prev])
        onFileUploaded?.(uploadedFile)
      }

      setUploadProgress(100)
    } catch (err) {
      console.error('Erreur upload:', err)
      setError(err.response?.data?.detail || 'Erreur lors de l\'upload')
    } finally {
      setUploading(false)
      setUploadProgress(0)
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
      setFiles(prev => prev.filter(f => f.id !== selectedFile.id))
      onFileDeleted?.(selectedFile.id)
      setShowDeleteModal(false)
      setSelectedFile(null)
      setDeleteInfo(null)
    } catch (err) {
      console.error('Erreur suppression:', err)
      throw err
    }
  }

  // Fullscreen
  const handleImageClick = (file) => {
    if (fileService.isViewable(file)) {
      const index = viewableFiles.findIndex(f => f.id === file.id)
      setFullscreenIndex(index >= 0 ? index : 0)
      setSelectedFile(file)
      setShowFullscreen(true)
    }
  }

  // Navigation fullscreen
  const handleFullscreenNav = useCallback((direction) => {
    setFullscreenIndex(prev => {
      const newIndex = prev + direction
      if (newIndex >= 0 && newIndex < viewableFiles.length) {
        setSelectedFile(viewableFiles[newIndex])
        return newIndex
      }
      return prev
    })
  }, [viewableFiles])

  // Gestion clavier pour navigation fullscreen
  useEffect(() => {
    if (!showFullscreen) return

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') handleFullscreenNav(-1)
      else if (e.key === 'ArrowRight') handleFullscreenNav(1)
      else if (e.key === 'Escape') setShowFullscreen(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showFullscreen, handleFullscreenNav])

  // Download
  const handleDownload = async (file) => {
    await fileService.downloadFile(file)
  }

  // Open in new tab (PDF)
  const handleOpenNewTab = (file) => {
    fileService.openInNewTab(file)
  }

  // Share (disabled for now)
  const handleShare = (file) => {
    // TODO: Implementer le partage vers une autre entite
    console.log('Share not implemented yet', file)
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

  // Icone selon type de fichier
  const getFileIcon = (file) => {
    if (fileService.isImage(file)) {
      return (
        <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    }
    if (fileService.isVideo(file)) {
      return (
        <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )
    }
    if (file.file_type === 'audio') {
      return (
        <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      )
    }
    if (file.file_type === 'gps_track') {
      return (
        <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    }
    // PDF avec icone distincte rouge
    if (fileService.isPdf(file)) {
      return (
        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h2m-2 3h4m4-9v3h-3" />
        </svg>
      )
    }
    // Document generique
    return (
      <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
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
      {files.length > 0 && (
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {files.length} fichier{files.length > 1 ? 's' : ''}
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

        {/* Liste des fichiers ou etat vide */}
        {files.length === 0 ? (
          /* Zone d'upload initiale (quand pas de fichiers) */
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
        ) : viewMode === 'grid' ? (
        // Vue grille
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {files.map(file => (
            <div
              key={file.id}
              className="group relative bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 hover:border-indigo-400 transition-colors"
            >
              {/* Thumbnail ou icone */}
              <div
                className={`aspect-square flex items-center justify-center bg-gray-100 dark:bg-gray-800 ${
                  fileService.isViewable(file) ? 'cursor-pointer' : ''
                }`}
                onClick={() => handleImageClick(file)}
              >
                {fileService.isImage(file) && file.signed_url ? (
                  <img
                    src={file.signed_url}
                    alt={file.file_name}
                    className="w-full h-full object-cover"
                  />
                ) : fileService.isVideo(file) && file.signed_url ? (
                  <div className="relative w-full h-full">
                    <video
                      src={file.signed_url}
                      className="w-full h-full object-cover"
                      muted
                      preload="metadata"
                    />
                    {/* Play icon overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <svg className="w-12 h-12 text-white/80" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                ) : (
                  getFileIcon(file)
                )}
              </div>

              {/* Badge reference */}
              {file.is_reference && (
                <div className="absolute top-2 left-2">
                  <span className="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                    Partage
                  </span>
                </div>
              )}

              {/* Info + actions */}
              <div className="p-2">
                <p className="text-xs font-medium text-gray-900 dark:text-white truncate" title={file.file_name}>
                  {file.file_name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {fileService.formatFileSize(file.file_size)}
                </p>
              </div>

              {/* Actions au hover */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                {/* Telecharger */}
                <button
                  onClick={() => handleDownload(file)}
                  className="p-1.5 bg-gray-700 hover:bg-gray-800 text-white rounded-full shadow"
                  title="Telecharger"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>

                {/* Ouvrir PDF nouvel onglet */}
                {fileService.isPdf(file) && (
                  <button
                    onClick={() => handleOpenNewTab(file)}
                    className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow"
                    title="Ouvrir dans un nouvel onglet"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>
                )}

                {/* Partager (disabled) */}
                <button
                  onClick={() => handleShare(file)}
                  disabled
                  className="p-1.5 bg-gray-400 text-white rounded-full shadow cursor-not-allowed opacity-50"
                  title="Partager (bientot disponible)"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </button>

                {/* Supprimer */}
                {!readOnly && (
                  <button
                    onClick={() => handleDeleteClick(file)}
                    className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow"
                    title="Supprimer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Vue liste
        <div className="space-y-2">
          {files.map(file => (
            <div
              key={file.id}
              className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-indigo-400 transition-colors"
            >
              {/* Icone */}
              <div className="flex-shrink-0 mr-3">
                {fileService.isImage(file) && file.signed_url ? (
                  <img
                    src={file.signed_url}
                    alt={file.file_name}
                    className="w-10 h-10 object-cover rounded cursor-pointer"
                    onClick={() => handleImageClick(file)}
                  />
                ) : fileService.isVideo(file) && file.signed_url ? (
                  <div
                    className="relative w-10 h-10 rounded overflow-hidden cursor-pointer"
                    onClick={() => handleImageClick(file)}
                  >
                    <video
                      src={file.signed_url}
                      className="w-full h-full object-cover"
                      muted
                      preload="metadata"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <svg className="w-5 h-5 text-white/80" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                ) : (
                  getFileIcon(file)
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {file.file_name}
                </p>
                <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>{fileService.formatFileSize(file.file_size)}</span>
                  <span>•</span>
                  <span>{new Date(file.created_at).toLocaleDateString()}</span>
                  {file.is_reference && (
                    <>
                      <span>•</span>
                      <span className="text-blue-600 dark:text-blue-400">Partage</span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-1">
                {/* Telecharger */}
                <button
                  onClick={() => handleDownload(file)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  title="Telecharger"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>

                {/* Ouvrir PDF nouvel onglet */}
                {fileService.isPdf(file) && (
                  <button
                    onClick={() => handleOpenNewTab(file)}
                    className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                    title="Ouvrir dans un nouvel onglet"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>
                )}

                {/* Partager (disabled) */}
                <button
                  onClick={() => handleShare(file)}
                  disabled
                  className="p-2 text-gray-300 dark:text-gray-600 cursor-not-allowed"
                  title="Partager (bientot disponible)"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </button>

                {/* Supprimer */}
                {!readOnly && (
                  <button
                    onClick={() => handleDeleteClick(file)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    title="Supprimer"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        )}
      </div>

      {/* Modal fullscreen */}
      {showFullscreen && selectedFile && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-95 flex flex-col"
          onClick={() => setShowFullscreen(false)}
        >
          {/* Header avec infos et actions */}
          <div
            className="flex items-center justify-between p-4 bg-black/50"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Infos fichier */}
            <div className="text-white">
              <p className="font-medium">{selectedFile.file_name}</p>
              <p className="text-sm text-gray-400">
                {fullscreenIndex + 1} / {viewableFiles.length} • {fileService.formatFileSize(selectedFile.file_size)}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2">
              {/* Telecharger */}
              <button
                onClick={() => handleDownload(selectedFile)}
                className="p-2 text-white hover:bg-white/20 rounded-full"
                title="Telecharger"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>

              {/* Partager (disabled) */}
              <button
                onClick={() => handleShare(selectedFile)}
                disabled
                className="p-2 text-gray-500 cursor-not-allowed rounded-full"
                title="Partager (bientot disponible)"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>

              {/* Supprimer */}
              {!readOnly && (
                <button
                  onClick={() => {
                    setShowFullscreen(false)
                    handleDeleteClick(selectedFile)
                  }}
                  className="p-2 text-white hover:bg-red-500/50 rounded-full"
                  title="Supprimer"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}

              {/* Fermer */}
              <button
                className="p-2 text-white hover:bg-white/20 rounded-full ml-2"
                onClick={() => setShowFullscreen(false)}
                title="Fermer (Echap)"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Image avec navigation */}
          <div className="flex-1 flex items-center justify-center relative min-h-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Bouton precedent */}
            {fullscreenIndex > 0 && (
              <button
                onClick={() => handleFullscreenNav(-1)}
                className="absolute left-4 p-3 text-white hover:bg-white/20 rounded-full z-10"
                title="Precedent (fleche gauche)"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {/* Image ou Video */}
            {fileService.isImage(selectedFile) ? (
              <img
                src={selectedFile.signed_url}
                alt={selectedFile.file_name}
                className="max-w-[calc(100%-6rem)] max-h-full object-contain"
                onClick={() => setShowFullscreen(false)}
              />
            ) : (
              <video
                src={selectedFile.signed_url}
                controls
                autoPlay
                className="max-w-[calc(100%-6rem)] max-h-full"
                onClick={(e) => e.stopPropagation()}
              />
            )}

            {/* Bouton suivant */}
            {fullscreenIndex < viewableFiles.length - 1 && (
              <button
                onClick={() => handleFullscreenNav(1)}
                className="absolute right-4 p-3 text-white hover:bg-white/20 rounded-full z-10"
                title="Suivant (fleche droite)"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

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
