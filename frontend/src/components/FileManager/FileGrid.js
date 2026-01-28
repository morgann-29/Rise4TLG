import { useState, useEffect, useCallback, useMemo } from 'react'
import { fileService } from '../../services/fileService'

/**
 * FileGrid - Composant de presentation pour afficher des fichiers
 *
 * Props:
 * - files: Array - Fichiers a afficher
 * - total: number - Nombre total (pour la pagination)
 * - offset: number - Offset courant
 * - limit: number - Taille de page
 * - onPageChange: (offset) => void - Navigation de page
 * - onLimitChange: (limit) => void - Changement de taille de page
 * - viewMode: 'grid' | 'list' - Mode d'affichage
 * - readOnly: boolean - Cache les boutons de suppression (default: false)
 * - onDelete: (file) => void - Handler suppression (optionnel, si absent pas de bouton)
 * - renderFileActions: (file) => ReactNode - Actions custom par fichier (optionnel)
 * - emptyMessage: string - Message si vide
 * - className: string
 */
function FileGrid({
  files = [],
  total = 0,
  offset = 0,
  limit = 20,
  onPageChange,
  onLimitChange,
  viewMode = 'grid',
  readOnly = false,
  onDelete,
  renderFileActions,
  emptyMessage = 'Aucun fichier',
  className = ''
}) {
  const [showFullscreen, setShowFullscreen] = useState(false)
  const [fullscreenIndex, setFullscreenIndex] = useState(0)
  const [selectedFile, setSelectedFile] = useState(null)

  // Fichiers visualisables (images et videos) pour la navigation fullscreen
  const viewableFiles = useMemo(() => {
    return files.filter(f => fileService.isViewable(f))
  }, [files])

  // Pagination
  const currentPage = Math.floor(offset / limit) + 1
  const totalPages = Math.ceil(total / limit)

  // Calcul des numeros de pages a afficher
  const getPageNumbers = () => {
    const pages = []
    const maxVisible = 5
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
    let end = Math.min(totalPages, start + maxVisible - 1)
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1)
    }
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    return pages
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

  // Clavier pour navigation fullscreen
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
    if (fileService.isPdf(file)) {
      return (
        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h2m-2 3h4m4-9v3h-3" />
        </svg>
      )
    }
    return (
      <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  }

  if (files.length === 0) {
    return (
      <div className={`text-center py-8 text-gray-500 dark:text-gray-400 ${className}`}>
        <svg className="mx-auto h-12 w-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <p>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Vue grille */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {files.map(file => (
            <div
              key={file.id}
              className="group relative bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 hover:border-indigo-400 transition-colors"
            >
              {/* Thumbnail ou icone */}
              <div
                className={`aspect-square flex items-center justify-center bg-gray-100 dark:bg-gray-800 ${
                  fileService.isViewable(file) && !fileService.isProcessing(file) ? 'cursor-pointer' : ''
                }`}
                onClick={() => !fileService.isProcessing(file) && handleImageClick(file)}
              >
                {fileService.isImage(file) && fileService.getDisplayUrl(file) ? (
                  <img
                    src={fileService.getDisplayUrl(file)}
                    alt={file.file_name}
                    className="w-full h-full object-cover"
                  />
                ) : fileService.isVideo(file) ? (
                  <div className="relative w-full h-full">
                    {/* Thumbnail video ou fallback sur video element */}
                    {file.thumbnail_url ? (
                      <img
                        src={file.thumbnail_url}
                        alt={file.file_name}
                        className="w-full h-full object-cover"
                      />
                    ) : file.signed_url && !fileService.isProcessing(file) ? (
                      <video
                        src={file.signed_url}
                        className="w-full h-full object-cover"
                        muted
                        preload="metadata"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {getFileIcon(file)}
                      </div>
                    )}
                    {/* Overlay play icon (seulement si pas en traitement) */}
                    {!fileService.isProcessing(file) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <svg className="w-12 h-12 text-white/80" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    )}
                    {/* Indicateur de traitement en cours */}
                    {fileService.isProcessing(file) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <div className="text-center text-white">
                          <svg className="animate-spin h-8 w-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          <span className="text-xs">Traitement...</span>
                        </div>
                      </div>
                    )}
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

              {/* Badge erreur traitement */}
              {fileService.isProcessingFailed(file) && (
                <div className="absolute top-2 left-2">
                  <span className="px-1.5 py-0.5 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded">
                    Erreur
                  </span>
                </div>
              )}

              {/* Info */}
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

                {/* Supprimer */}
                {!readOnly && onDelete && (
                  <button
                    onClick={() => onDelete(file)}
                    className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow"
                    title="Supprimer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Actions custom (ex: bouton Associer pour MasterFilesSection) */}
              {renderFileActions && (
                <div className="px-2 pb-2">
                  {renderFileActions(file)}
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
                {fileService.isImage(file) && fileService.getDisplayUrl(file) ? (
                  <img
                    src={fileService.getDisplayUrl(file)}
                    alt={file.file_name}
                    className="w-10 h-10 object-cover rounded cursor-pointer"
                    onClick={() => handleImageClick(file)}
                  />
                ) : fileService.isVideo(file) ? (
                  <div
                    className={`relative w-10 h-10 rounded overflow-hidden ${
                      !fileService.isProcessing(file) ? 'cursor-pointer' : ''
                    }`}
                    onClick={() => !fileService.isProcessing(file) && handleImageClick(file)}
                  >
                    {file.thumbnail_url ? (
                      <img
                        src={file.thumbnail_url}
                        alt={file.file_name}
                        className="w-full h-full object-cover"
                      />
                    ) : file.signed_url && !fileService.isProcessing(file) ? (
                      <video
                        src={file.signed_url}
                        className="w-full h-full object-cover"
                        muted
                        preload="metadata"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-600">
                        {fileService.isProcessing(file) ? (
                          <svg className="animate-spin h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          getFileIcon(file)
                        )}
                      </div>
                    )}
                    {!fileService.isProcessing(file) && (file.thumbnail_url || file.signed_url) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <svg className="w-5 h-5 text-white/80" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    )}
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
                  {fileService.isProcessing(file) && (
                    <>
                      <span>•</span>
                      <span className="text-yellow-600 dark:text-yellow-400">Traitement...</span>
                    </>
                  )}
                  {fileService.isProcessingFailed(file) && (
                    <>
                      <span>•</span>
                      <span className="text-red-600 dark:text-red-400">Erreur</span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions custom */}
              {renderFileActions && (
                <div className="flex-shrink-0 mr-2">
                  {renderFileActions(file)}
                </div>
              )}

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

                {/* Supprimer */}
                {!readOnly && onDelete && (
                  <button
                    onClick={() => onDelete(file)}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 gap-3">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {total} fichier{total > 1 ? 's' : ''} — Page {currentPage} / {totalPages}
          </div>
          <div className="flex items-center gap-2">
            {/* Selecteur par page */}
            <select
              value={limit}
              onChange={(e) => onLimitChange?.(Number(e.target.value))}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>

            {/* Boutons de page */}
            <div className="flex items-center space-x-1">
              {/* Precedent */}
              <button
                onClick={() => onPageChange?.(Math.max(0, offset - limit))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Page precedente"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Numeros */}
              {getPageNumbers()[0] > 1 && (
                <>
                  <button
                    onClick={() => onPageChange?.(0)}
                    className="px-2.5 py-1 text-sm rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    1
                  </button>
                  {getPageNumbers()[0] > 2 && (
                    <span className="px-1 text-gray-400">...</span>
                  )}
                </>
              )}

              {getPageNumbers().map(p => (
                <button
                  key={p}
                  onClick={() => onPageChange?.((p - 1) * limit)}
                  className={`px-2.5 py-1 text-sm rounded-lg transition-colors ${
                    p === currentPage
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                >
                  {p}
                </button>
              ))}

              {getPageNumbers()[getPageNumbers().length - 1] < totalPages && (
                <>
                  {getPageNumbers()[getPageNumbers().length - 1] < totalPages - 1 && (
                    <span className="px-1 text-gray-400">...</span>
                  )}
                  <button
                    onClick={() => onPageChange?.((totalPages - 1) * limit)}
                    className="px-2.5 py-1 text-sm rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    {totalPages}
                  </button>
                </>
              )}

              {/* Suivant */}
              <button
                onClick={() => onPageChange?.(offset + limit)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Page suivante"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

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
            <div className="text-white">
              <p className="font-medium">{selectedFile.file_name}</p>
              <p className="text-sm text-gray-400">
                {fullscreenIndex + 1} / {viewableFiles.length} • {fileService.formatFileSize(selectedFile.file_size)}
              </p>
            </div>

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

              {/* Supprimer */}
              {!readOnly && onDelete && (
                <button
                  onClick={() => {
                    setShowFullscreen(false)
                    onDelete(selectedFile)
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
    </div>
  )
}

export default FileGrid
