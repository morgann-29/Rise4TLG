import api from './api'

export const fileService = {
  // ============================================
  // UPLOAD
  // ============================================

  /**
   * Upload un fichier vers une entite
   * @param {File} file - Fichier a uploader
   * @param {string} entityType - Type d'entite (project, group, session, etc.)
   * @param {string} entityId - ID de l'entite
   * @param {string} fileType - Type de fichier (image, document, video, audio, gps_track, other)
   * @returns {Promise<Object>} Fichier cree avec signed_url
   */
  async uploadFile(file, entityType, entityId, fileType = null) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('origin_entity_type', entityType)
    formData.append('origin_entity_id', entityId)
    if (fileType) {
      formData.append('file_type', fileType)
    }

    const response = await api.post('/api/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  },

  // ============================================
  // LIST
  // ============================================

  /**
   * Liste tous les fichiers d'une entite (sources + references)
   */
  async getFiles(entityType, entityId) {
    const response = await api.get(`/api/files/${entityType}/${entityId}`)
    return response.data
  },

  /**
   * Liste uniquement les images d'une entite (pour le picker de l'editeur)
   */
  async getImages(entityType, entityId) {
    const response = await api.get(`/api/files/${entityType}/${entityId}/images`)
    return response.data
  },

  /**
   * Recupere un fichier par son ID avec une URL signee fraiche
   */
  async getFile(fileId) {
    const response = await api.get(`/api/files/info/${fileId}`)
    return response.data
  },

  // ============================================
  // DELETE
  // ============================================

  /**
   * Recupere les infos de suppression (source ou reference, nombre de partages)
   */
  async getDeleteInfo(fileId, entityType = null, entityId = null) {
    const params = {}
    if (entityType) params.entity_type = entityType
    if (entityId) params.entity_id = entityId

    const response = await api.get(`/api/files/delete-info/${fileId}`, { params })
    return response.data
  },

  /**
   * Supprime un fichier
   * - Si source : hard delete + supprime toutes les references
   * - Si reference : supprime uniquement la reference
   */
  async deleteFile(fileId, entityType = null, entityId = null) {
    const params = {}
    if (entityType) params.entity_type = entityType
    if (entityId) params.entity_id = entityId

    const response = await api.delete(`/api/files/${fileId}`, { params })
    return response.data
  },

  // ============================================
  // SHARE
  // ============================================

  /**
   * Partage un fichier vers une autre entite
   */
  async shareFile(fileId, targetEntityType, targetEntityId) {
    const response = await api.post(`/api/files/${fileId}/share`, {
      files_id: fileId,
      entity_type: targetEntityType,
      entity_id: targetEntityId
    })
    return response.data
  },

  // ============================================
  // URL RESOLUTION
  // ============================================

  /**
   * Resout une liste de chemins en URLs signees
   * Utilise pour rafraichir les URLs dans le contenu de l'editeur
   */
  async resolveUrls(paths) {
    const response = await api.post('/api/files/resolve-urls', { paths })
    return response.data.urls
  },

  // ============================================
  // HELPERS
  // ============================================

  /**
   * Detecte le type de fichier a partir du MIME type
   */
  detectFileType(mimeType) {
    if (!mimeType) return 'other'
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType.startsWith('video/')) return 'video'
    if (mimeType.startsWith('audio/')) return 'audio'
    if (mimeType === 'application/gpx+xml' || mimeType.includes('gpx')) return 'gps_track'
    return 'document'
  },

  /**
   * Formate la taille d'un fichier en format lisible
   */
  formatFileSize(bytes) {
    if (!bytes) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`
  },

  /**
   * Verifie si un fichier est une image
   */
  isImage(file) {
    return file.file_type === 'image' || file.mime_type?.startsWith('image/')
  },

  /**
   * Verifie si un fichier est une video
   */
  isVideo(file) {
    return file.file_type === 'video' || file.mime_type?.startsWith('video/')
  },

  /**
   * Verifie si un fichier est un PDF
   */
  isPdf(file) {
    return file.mime_type === 'application/pdf' || file.file_name?.toLowerCase().endsWith('.pdf')
  },

  /**
   * Verifie si un fichier est visualisable en fullscreen (images et videos)
   */
  isViewable(file) {
    return this.isImage(file) || this.isVideo(file)
  },

  /**
   * Telecharge un fichier (force le telechargement meme pour les types geres par le navigateur)
   */
  async downloadFile(file) {
    try {
      // Fetch le fichier comme blob pour forcer le telechargement
      const response = await fetch(file.signed_url)
      const blob = await response.blob()

      // Creer une URL blob locale
      const blobUrl = window.URL.createObjectURL(blob)

      // Creer un lien et forcer le telechargement
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = file.file_name
      document.body.appendChild(link)
      link.click()

      // Cleanup
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error('Erreur telechargement:', error)
      // Fallback: ouvrir dans un nouvel onglet
      window.open(file.signed_url, '_blank')
    }
  },

  /**
   * Ouvre un fichier dans un nouvel onglet
   */
  openInNewTab(file) {
    window.open(file.signed_url, '_blank')
  }
}
