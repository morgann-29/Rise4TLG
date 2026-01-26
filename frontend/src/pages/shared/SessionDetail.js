import { useParams, useNavigate } from 'react-router-dom'
import NavigantLayout from '../../components/NavigantLayout'

function SessionDetail() {
  const { sessionId } = useParams()
  const navigate = useNavigate()

  return (
    <NavigantLayout>
      <div className="space-y-6">
        {/* Header with back button */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Detail de la seance
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              ID: {sessionId}
            </p>
          </div>
        </div>

        {/* Placeholder content */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-12 text-center">
          <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Contenu a venir
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Le detail de cette seance sera specifie ulterieurement.
          </p>
        </div>
      </div>
    </NavigantLayout>
  )
}

export default SessionDetail
