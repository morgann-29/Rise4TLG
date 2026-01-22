import { useState, useEffect, useCallback, useRef } from 'react'
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
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteInfo, setDeleteInfo] = useState(null)
  const fileInputRef = useRef(null)

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
    if (fileService.isImage(file)) {
      setSelectedFile(file)
      setShowFullscreen(true)
    }
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
      {/* Zone d'upload */}
      {!readOnly && (
        <div
          className={`relative border-2 border-dashed rounded-lg p-6 mb-4 transition-colors ${
            dragActive
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
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

          <div className="text-center">
            {uploading ? (
              <div className="space-y-2">
                <svg className="animate-spin mx-auto h-10 w-10 text-indigo-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Upload en cours... {uploadProgress}%
                </p>
              </div>
            ) : (
              <>
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                  >
                    Cliquez pour selectionner
                  </button>
                  {' '}ou glissez-deposez vos fichiers
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Max {fileService.formatFileSize(maxFileSize)} par fichier
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-3 mb-4">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Header avec toggle vue */}
      {files.length > 0 && (
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {files.length} fichier{files.length > 1 ? 's' : ''}
          </span>
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
      )}

      {/* Liste des fichiers */}
      {files.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <svg className="mx-auto h-12 w-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <p>Aucun fichier</p>
        </div>
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
                  fileService.isImage(file) ? 'cursor-pointer' : ''
                }`}
                onClick={() => handleImageClick(file)}
              >
                {fileService.isImage(file) && file.signed_url ? (
                  <img
                    src={file.signed_url}
                    alt={file.file_name}
                    className="w-full h-full object-cover"
                  />
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
              {!readOnly && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleDeleteClick(file)}
                    className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow"
                    title="Supprimer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
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
          ))}
        </div>
      )}

      {/* Modal fullscreen */}
      {showFullscreen && selectedFile && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center"
          onClick={() => setShowFullscreen(false)}
        >
          <button
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-full"
            onClick={() => setShowFullscreen(false)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={selectedFile.signed_url}
            alt={selectedFile.file_name}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
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
