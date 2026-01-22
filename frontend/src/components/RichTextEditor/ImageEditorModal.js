import { useEffect, useRef, useState } from 'react'
import 'tui-image-editor/dist/tui-image-editor.css'

/**
 * Modal d'edition d'image avec tui-image-editor
 * Note: On charge tui-image-editor dynamiquement pour eviter les erreurs SSR
 */
function ImageEditorModal({ isOpen, onClose, onSave, imageUrl, imageName }) {
  const editorRef = useRef(null)
  const editorInstanceRef = useRef(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen && editorRef.current && imageUrl) {
      setLoading(true)
      setError(null)

      // Charger l'image via fetch pour contourner les problemes CORS
      const loadImage = async () => {
        try {
          // Fetch l'image comme blob pour contourner CORS
          const response = await fetch(imageUrl)
          if (!response.ok) throw new Error('Impossible de charger l\'image')
          const blob = await response.blob()
          const objectUrl = URL.createObjectURL(blob)

          // Import dynamique pour eviter les erreurs SSR
          const { default: ImageEditor } = await import('tui-image-editor')

          // Initialiser l'editeur avec l'URL locale
          editorInstanceRef.current = new ImageEditor(editorRef.current, {
            includeUI: {
              loadImage: {
                path: objectUrl,
                name: imageName || 'image'
              },
              theme: {
                // Theme sombre compatible
                'common.bi.image': '',
                'common.bisize.width': '0',
                'common.bisize.height': '0',
                'common.backgroundColor': '#1e1e1e',
                'header.backgroundImage': 'none',
                'header.backgroundColor': '#1e1e1e',
                'header.border': '0px',
                'downloadButton.backgroundColor': '#4f46e5',
                'downloadButton.borderColor': '#4f46e5',
                'downloadButton.color': '#fff',
                'menu.normalIcon.color': '#8a8a8a',
                'menu.activeIcon.color': '#fff',
                'menu.disabledIcon.color': '#555',
                'menu.hoverIcon.color': '#e9e9e9',
                'submenu.backgroundColor': '#1e1e1e',
                'submenu.partition.color': '#3c3c3c',
                'submenu.normalLabel.color': '#8a8a8a',
                'submenu.activeLabel.color': '#fff',
                'submenu.normalIcon.color': '#8a8a8a',
                'submenu.activeIcon.color': '#e9e9e9',
                'checkbox.border': '1px solid #ccc',
                'range.pointer.color': '#4f46e5',
                'range.bar.color': '#666',
                'range.subbar.color': '#4f46e5'
              },
              initMenu: 'filter',
              menuBarPosition: 'bottom'
            },
            cssMaxWidth: 800,
            cssMaxHeight: 600,
            usageStatistics: false
          })

          setLoading(false)
        } catch (err) {
          console.error('Erreur chargement editeur image:', err)
          setError(err.message || 'Erreur lors du chargement de l\'image')
          setLoading(false)
        }
      }

      loadImage()

      return () => {
        if (editorInstanceRef.current) {
          editorInstanceRef.current.destroy()
          editorInstanceRef.current = null
        }
      }
    }
  }, [isOpen, imageUrl, imageName])

  const handleSave = async () => {
    if (!editorInstanceRef.current) return

    try {
      setSaving(true)

      // Recuperer l'image editee en base64
      const dataUrl = editorInstanceRef.current.toDataURL()

      // Convertir en Blob
      const response = await fetch(dataUrl)
      const blob = await response.blob()

      // Creer un File object
      const file = new File(
        [blob],
        `edited_${imageName || 'image'}.png`,
        { type: 'image/png' }
      )

      await onSave(file)
      onClose()
    } catch (error) {
      console.error('Erreur sauvegarde image:', error)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-75" />

      {/* Modal */}
      <div className="fixed inset-4 flex flex-col bg-gray-900 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">
            Éditeur d'image
          </h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading || error}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Sauvegarde...
                </span>
              ) : (
                'Sauvegarder comme nouvelle image'
              )}
            </button>
          </div>
        </div>

        {/* Editor container */}
        <div className="flex-1 overflow-hidden relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center">
                <svg className="animate-spin h-10 w-10 text-indigo-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-gray-300">Chargement de l'éditeur...</p>
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center">
                <svg className="h-12 w-12 text-red-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-400 mb-2">{error}</p>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
                >
                  Fermer
                </button>
              </div>
            </div>
          )}
          <div ref={editorRef} className="w-full h-full" />
        </div>
      </div>
    </div>
  )
}

export default ImageEditorModal
