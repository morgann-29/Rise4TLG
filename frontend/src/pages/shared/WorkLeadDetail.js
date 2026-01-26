import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import CoachLayout from '../../components/CoachLayout'
import NavigantLayout from '../../components/NavigantLayout'

function WorkLeadDetail() {
  const { workLeadId, groupId, projectId } = useParams()
  const navigate = useNavigate()
  const { isCoach } = useAuth()

  const Layout = isCoach ? CoachLayout : NavigantLayout

  return (
    <Layout>
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
              Detail de l'axe de travail
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              ID: {workLeadId}
            </p>
          </div>
        </div>

        {/* Placeholder content */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-12 text-center">
          <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Contenu a venir
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Le detail de cet axe de travail sera specifie ulterieurement.
          </p>
        </div>
      </div>
    </Layout>
  )
}

export default WorkLeadDetail
