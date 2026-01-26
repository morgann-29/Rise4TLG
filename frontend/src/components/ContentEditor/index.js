import { useState, useEffect, useRef, useCallback } from 'react'
import RichTextEditor from '../RichTextEditor'

export { default as RichTextEditor } from '../RichTextEditor'

/**
 * ContentEditor - Wrapper around RichTextEditor with edit/view mode and autosave
 *
 * Props:
 * - value: string - Initial HTML content
 * - onSave: (content: string) => Promise<void> - Save function (API call)
 * - entityType: string - Entity type for file management
 * - entityId: string - Entity ID for file management
 * - placeholder: string - Editor placeholder
 * - minHeight: string - Minimum editor height (default: '300px')
 * - autoSaveDelay: number - Debounce delay in ms (default: 3000, 0 to disable)
 * - title: string - Optional section title
 * - description: string - Optional section description
 * - className: string - Additional CSS classes
 * - initialEditMode: boolean - Start in edit mode (default: false)
 * - showHeader: boolean - Show title/description header (default: true)
 */
function ContentEditor({
  value = '',
  onSave,
  entityType,
  entityId,
  placeholder = 'Commencez a ecrire...',
  minHeight = '300px',
  autoSaveDelay = 3000,
  title,
  description,
  className = '',
  initialEditMode = false,
  showHeader = true
}) {
  const [content, setContent] = useState(value)
  const [isEditing, setIsEditing] = useState(initialEditMode)
  const [hasChanges, setHasChanges] = useState(false)
  const [saveStatus, setSaveStatus] = useState('idle') // 'idle' | 'saving' | 'saved' | 'error'
  const [errorMessage, setErrorMessage] = useState(null)

  const autoSaveTimeoutRef = useRef(null)
  const lastSavedContentRef = useRef(value)

  // Sync with external value changes
  useEffect(() => {
    if (value !== lastSavedContentRef.current && !hasChanges) {
      setContent(value)
      lastSavedContentRef.current = value
    }
  }, [value, hasChanges])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [])

  // Save function
  const save = useCallback(async (contentToSave) => {
    if (!onSave) return

    try {
      setSaveStatus('saving')
      setErrorMessage(null)
      await onSave(contentToSave)
      lastSavedContentRef.current = contentToSave
      setHasChanges(false)
      setSaveStatus('saved')

      // Reset status after 3 seconds
      setTimeout(() => {
        setSaveStatus((current) => (current === 'saved' ? 'idle' : current))
      }, 3000)
    } catch (error) {
      console.error('Erreur sauvegarde:', error)
      setSaveStatus('error')
      setErrorMessage(error.response?.data?.detail || 'Erreur lors de la sauvegarde')
    }
  }, [onSave])

  // Handle content change
  const handleContentChange = useCallback((newContent) => {
    setContent(newContent)

    // Check if content actually changed from last saved
    if (newContent !== lastSavedContentRef.current) {
      setHasChanges(true)
      setSaveStatus('idle')

      // Clear previous autosave timeout
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }

      // Schedule autosave if enabled
      if (autoSaveDelay > 0 && onSave) {
        autoSaveTimeoutRef.current = setTimeout(() => {
          save(newContent)
        }, autoSaveDelay)
      }
    } else {
      setHasChanges(false)
    }
  }, [autoSaveDelay, onSave, save])

  // Manual save
  const handleManualSave = useCallback(() => {
    // Clear any pending autosave
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }
    save(content)
  }, [content, save])

  // Toggle edit mode
  const handleToggleEdit = useCallback(() => {
    if (isEditing && hasChanges) {
      // Switching from edit to view with unsaved changes - save first
      handleManualSave()
    }
    setIsEditing(!isEditing)
  }, [isEditing, hasChanges, handleManualSave])

  // Status indicator component
  const StatusIndicator = () => {
    if (saveStatus === 'saving') {
      return (
        <span className="text-sm text-blue-600 dark:text-blue-400 flex items-center">
          <svg className="animate-spin mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Sauvegarde...
        </span>
      )
    }

    if (saveStatus === 'saved') {
      return (
        <span className="text-sm text-green-600 dark:text-green-400 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Sauvegarde
        </span>
      )
    }

    if (saveStatus === 'error') {
      return (
        <span className="text-sm text-red-600 dark:text-red-400 flex items-center" title={errorMessage}>
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Erreur
        </span>
      )
    }

    if (hasChanges) {
      return (
        <span className="text-sm text-amber-600 dark:text-amber-400 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {autoSaveDelay > 0 ? 'Sauvegarde auto...' : 'Non sauvegarde'}
        </span>
      )
    }

    return null
  }

  return (
    <div className={`bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      {showHeader && (
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              {title && (
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                  {title}
                </h2>
              )}
              {description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {description}
                </p>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <StatusIndicator />

              {isEditing ? (
                <>
                  <button
                    onClick={handleToggleEdit}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    Fermer
                  </button>
                  <button
                    onClick={handleManualSave}
                    disabled={saveStatus === 'saving' || !hasChanges}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-sm font-medium transition-colors"
                  >
                    {saveStatus === 'saving' ? (
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
                </>
              ) : (
                <button
                  onClick={handleToggleEdit}
                  className="px-4 py-2 text-sm font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 hover:bg-indigo-200 dark:hover:bg-indigo-900 rounded-lg transition-colors flex items-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Modifier
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Editor */}
      <div className="p-6">
        <RichTextEditor
          value={content}
          onChange={handleContentChange}
          entityType={entityType}
          entityId={entityId}
          placeholder={placeholder}
          minHeight={minHeight}
          readOnly={!isEditing}
        />
      </div>

      {/* Compact header (when showHeader is false but we still need controls) */}
      {!showHeader && (
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end space-x-3">
          <StatusIndicator />
          {isEditing ? (
            <>
              <button
                onClick={handleToggleEdit}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Fermer
              </button>
              <button
                onClick={handleManualSave}
                disabled={saveStatus === 'saving' || !hasChanges}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-sm font-medium transition-colors"
              >
                Sauvegarder
              </button>
            </>
          ) : (
            <button
              onClick={handleToggleEdit}
              className="px-3 py-1.5 text-sm font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 hover:bg-indigo-200 dark:hover:bg-indigo-900 rounded-lg transition-colors"
            >
              Modifier
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default ContentEditor
