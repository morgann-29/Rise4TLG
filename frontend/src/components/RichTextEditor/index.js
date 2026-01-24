import { useEffect, useCallback, useState, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Toolbar from './Toolbar'
import MediaPicker from './MediaPicker'
import ImageEditorModal from './ImageEditorModal'
import { fileService } from '../../services/fileService'

/**
 * Extension Image personnalisee avec data-file-path et menu contextuel
 */
const CustomImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      'data-file-path': {
        default: null,
        parseHTML: element => element.getAttribute('data-file-path'),
        renderHTML: attributes => {
          if (!attributes['data-file-path']) return {}
          return { 'data-file-path': attributes['data-file-path'] }
        }
      },
      style: {
        default: null,
        parseHTML: element => element.getAttribute('style'),
        renderHTML: attributes => {
          if (!attributes.style) return {}
          return { style: attributes.style }
        }
      }
    }
  }
})

/**
 * Hook pour resoudre les URLs des fichiers dans le contenu HTML
 * Avec debouncing et cache pour eviter les requetes multiples
 */
function useResolveFileUrls(htmlContent, entityType, entityId) {
  const [resolvedContent, setResolvedContent] = useState(htmlContent)
  const resolvedCacheRef = useRef(new Map()) // Cache des URLs resolues
  const lastContentRef = useRef('') // Pour eviter les boucles
  const isResolvingRef = useRef(false)

  useEffect(() => {
    // Eviter les boucles et requetes inutiles
    if (!htmlContent || htmlContent === lastContentRef.current || isResolvingRef.current) {
      if (!htmlContent && resolvedContent !== '') {
        setResolvedContent('')
      }
      return
    }

    const resolveUrls = async () => {
      // Extraire les file_path du contenu
      const pathRegex = /data-file-path="([^"]+)"/g
      const matches = [...htmlContent.matchAll(pathRegex)]
      const paths = matches.map(m => m[1])

      if (paths.length === 0) {
        lastContentRef.current = htmlContent
        setResolvedContent(htmlContent)
        return
      }

      // Filtrer les paths deja en cache
      const uncachedPaths = paths.filter(p => !resolvedCacheRef.current.has(p))

      try {
        isResolvingRef.current = true

        // Ne faire la requete que si on a des paths non caches
        if (uncachedPaths.length > 0) {
          const urls = await fileService.resolveUrls(uncachedPaths)
          // Ajouter au cache
          for (const [path, url] of Object.entries(urls)) {
            resolvedCacheRef.current.set(path, url)
          }
        }

        // Remplacer les src avec les URLs du cache
        let resolved = htmlContent
        for (const path of paths) {
          const url = resolvedCacheRef.current.get(path)
          if (url) {
            const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            // Regex flexible: trouve les <img> avec ce data-file-path et remplace leur src
            // Gere tout ordre d'attributs (src avant ou apres data-file-path)
            const imgRegex = new RegExp(
              `(<img\\s+[^>]*?)\\bsrc="[^"]*"([^>]*?\\bdata-file-path="${escapedPath}"[^>]*>)`,
              'g'
            )
            resolved = resolved.replace(imgRegex, `$1src="${url}"$2`)

            // Aussi gerer le cas inverse: data-file-path avant src
            const imgRegexReverse = new RegExp(
              `(<img\\s+[^>]*?\\bdata-file-path="${escapedPath}"[^>]*?)\\bsrc="[^"]*"([^>]*>)`,
              'g'
            )
            resolved = resolved.replace(imgRegexReverse, `$1src="${url}"$2`)
          }
        }

        lastContentRef.current = htmlContent
        setResolvedContent(resolved)
      } catch (error) {
        console.error('Erreur resolution URLs:', error)
        lastContentRef.current = htmlContent
        setResolvedContent(htmlContent)
      } finally {
        isResolvingRef.current = false
      }
    }

    // Debounce de 100ms pour eviter les appels multiples
    const timeoutId = setTimeout(resolveUrls, 100)
    return () => clearTimeout(timeoutId)
  }, [htmlContent, entityType, entityId, resolvedContent])

  return resolvedContent
}

/**
 * RichTextEditor - Editeur de texte riche base sur TipTap
 *
 * Props:
 * - value: string - Contenu HTML
 * - onChange: (html) => void - Callback changement
 * - entityType: string - Type d'entite (pour acces mediatheque)
 * - entityId: string - ID de l'entite
 * - placeholder: string - Placeholder
 * - readOnly: boolean - Mode lecture seule
 * - minHeight: string - Hauteur minimale (default: '200px')
 * - className: string - Classes CSS supplementaires
 */
function RichTextEditor({
  value = '',
  onChange,
  entityType,
  entityId,
  placeholder = 'Commencez a ecrire...',
  readOnly = false,
  minHeight = '200px',
  className = ''
}) {
  const [showMediaPicker, setShowMediaPicker] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [showImageEditor, setShowImageEditor] = useState(false)
  const [editingImage, setEditingImage] = useState(null)
  const [uploading, setUploading] = useState(false)

  // Resoudre les URLs a l'initialisation
  const resolvedValue = useResolveFileUrls(value, entityType, entityId)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          HTMLAttributes: {
            class: 'text-gray-900 dark:text-white'
          }
        },
        bulletList: {
          HTMLAttributes: {
            class: 'list-disc pl-5 text-gray-900 dark:text-gray-100'
          }
        },
        orderedList: {
          HTMLAttributes: {
            class: 'list-decimal pl-5 text-gray-900 dark:text-gray-100'
          }
        },
        blockquote: {
          HTMLAttributes: {
            class: 'border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-700 dark:text-gray-300'
          }
        },
        codeBlock: {
          HTMLAttributes: {
            class: 'bg-gray-100 dark:bg-gray-800 rounded-lg p-4 text-sm font-mono text-gray-900 dark:text-gray-100'
          }
        }
      }),
      CustomImage.configure({
        inline: false,
        allowBase64: false
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-indigo-600 dark:text-indigo-400 underline hover:text-indigo-800 dark:hover:text-indigo-300'
        }
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'before:content-[attr(data-placeholder)] before:text-gray-400 dark:before:text-gray-500 before:float-left before:pointer-events-none before:h-0'
      })
    ],
    content: resolvedValue,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none text-gray-900 dark:text-gray-100',
        style: `min-height: ${minHeight}; padding: 1rem;`
      },
      handlePaste: (view, event) => {
        // Gerer le paste d'images
        const items = event.clipboardData?.items
        if (!items) return false

        for (const item of items) {
          if (item.type.startsWith('image/')) {
            event.preventDefault()
            const file = item.getAsFile()
            if (file) {
              handlePastedImage(file)
            }
            return true
          }
        }
        return false
      }
    }
  })

  // Synchroniser le contenu resolu avec l'editeur
  const hasInitializedRef = useRef(false)
  useEffect(() => {
    if (!editor || !resolvedValue) return

    const currentContent = editor.getHTML()
    const normalizeForCompare = (html) => html.replace(/src="[^"]*"/g, 'src=""')
    const currentNormalized = normalizeForCompare(currentContent)
    const resolvedNormalized = normalizeForCompare(resolvedValue)

    if (currentNormalized === resolvedNormalized) {
      // Structure identique - mettre a jour si les URLs different (resolution)
      if (currentContent !== resolvedValue) {
        editor.commands.setContent(resolvedValue, false)
      }
    } else if (!hasInitializedRef.current) {
      // Structure differente et pas encore initialise - premier chargement
      editor.commands.setContent(resolvedValue, false)
      hasInitializedRef.current = true
    }
    // Si structure differente et deja initialise, ne pas mettre a jour (edition en cours)
  }, [resolvedValue, editor])

  // Upload et insertion d'une image collee
  const handlePastedImage = async (file) => {
    if (!entityType || !entityId) {
      console.warn('entityType et entityId requis pour upload')
      return
    }

    try {
      setUploading(true)

      const uploadedFile = await fileService.uploadFile(
        file,
        entityType,
        entityId,
        'image'
      )

      // Inserer l'image avec le file_path
      editor?.chain().focus().setImage({
        src: uploadedFile.signed_url,
        'data-file-path': uploadedFile.file_path
      }).run()

    } catch (error) {
      console.error('Erreur upload image:', error)
    } finally {
      setUploading(false)
    }
  }

  // Insertion d'une image depuis la mediatheque
  const handleSelectFromLibrary = (image) => {
    editor?.chain().focus().setImage({
      src: image.signed_url,
      'data-file-path': image.file_path
    }).run()
    setShowMediaPicker(false)
  }

  // Insertion de lien
  const handleInsertLink = () => {
    if (linkUrl) {
      editor?.chain().focus().setLink({ href: linkUrl }).run()
    } else {
      editor?.chain().focus().unsetLink().run()
    }
    setShowLinkModal(false)
    setLinkUrl('')
  }

  // Ouvrir l'editeur d'image
  const handleEditImage = useCallback(() => {
    // Trouver l'image selectionnee
    const { selection } = editor.state
    const node = editor.state.doc.nodeAt(selection.from)

    if (node?.type.name === 'image') {
      setEditingImage({
        url: node.attrs.src,
        name: node.attrs['data-file-path']?.split('/').pop() || 'image',
        filePath: node.attrs['data-file-path']
      })
      setShowImageEditor(true)
    }
  }, [editor])

  // Sauvegarder l'image editee
  const handleSaveEditedImage = async (file) => {
    if (!entityType || !entityId) return

    try {
      const uploadedFile = await fileService.uploadFile(
        file,
        entityType,
        entityId,
        'image'
      )

      // Remplacer l'image dans l'editeur
      editor?.chain().focus().setImage({
        src: uploadedFile.signed_url,
        'data-file-path': uploadedFile.file_path
      }).run()

    } catch (error) {
      console.error('Erreur sauvegarde image editee:', error)
    }
  }

  // Verifier si une image est selectionnee
  const isImageSelected = useCallback(() => {
    if (!editor) return false
    const { selection } = editor.state
    const node = editor.state.doc.nodeAt(selection.from)
    return node?.type.name === 'image'
  }, [editor])

  return (
    <div className={`border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-900 ${className}`}>
      {/* Toolbar */}
      {!readOnly && (
        <Toolbar
          editor={editor}
          onImageClick={() => setShowMediaPicker(true)}
          onLinkClick={() => {
            const previousUrl = editor?.getAttributes('link').href
            setLinkUrl(previousUrl || '')
            setShowLinkModal(true)
          }}
        />
      )}

      {/* Indicateur upload */}
      {uploading && (
        <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center text-sm text-indigo-700 dark:text-indigo-300">
            <svg className="animate-spin mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Upload de l'image en cours...
          </div>
        </div>
      )}

      {/* Bouton edit image si image selectionnee */}
      {!readOnly && isImageSelected() && (
        <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 border-b border-indigo-200 dark:border-indigo-700 flex flex-wrap items-center gap-4">
          <span className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">Image sélectionnée</span>

          {/* Tailles predefinies */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">Taille:</span>
            {[
              { label: 'S', width: '25%' },
              { label: 'M', width: '50%' },
              { label: 'L', width: '75%' },
              { label: 'XL', width: '100%' }
            ].map(size => (
              <button
                key={size.label}
                onClick={() => {
                  const { selection } = editor.state
                  const node = editor.state.doc.nodeAt(selection.from)
                  if (node?.type.name === 'image') {
                    editor.chain().focus().updateAttributes('image', {
                      style: `width: ${size.width}; max-width: ${size.width};`
                    }).run()
                  }
                }}
                className="px-2 py-1 text-xs font-medium bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                title={`Largeur ${size.width}`}
              >
                {size.label}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-indigo-300 dark:bg-indigo-600" />

          <button
            onClick={handleEditImage}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center font-medium"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Éditer
          </button>
          <button
            onClick={() => {
              editor?.chain().focus().deleteSelection().run()
            }}
            className="text-sm text-red-600 dark:text-red-400 hover:underline flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Supprimer
          </button>
        </div>
      )}

      {/* Editor */}
      <EditorContent editor={editor} />

      {/* Media Picker Modal */}
      <MediaPicker
        isOpen={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onSelect={handleSelectFromLibrary}
        entityType={entityType}
        entityId={entityId}
      />

      {/* Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={() => setShowLinkModal(false)}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Inserer un lien
              </h3>
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                autoFocus
              />
              <div className="flex justify-end space-x-3 mt-4">
                <button
                  onClick={() => setShowLinkModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  onClick={handleInsertLink}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                >
                  {linkUrl ? 'Appliquer' : 'Supprimer le lien'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Editor Modal */}
      <ImageEditorModal
        isOpen={showImageEditor}
        onClose={() => {
          setShowImageEditor(false)
          setEditingImage(null)
        }}
        onSave={handleSaveEditedImage}
        imageUrl={editingImage?.url}
        imageName={editingImage?.name}
      />
    </div>
  )
}

export default RichTextEditor
