import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import CoachLayout from '../../components/CoachLayout'
import { coachService } from '../../services/coachService'

function GroupProjectDetail() {
  const { groupId, projectId } = useParams()
  const navigate = useNavigate()
  const [group, setGroup] = useState(null)
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const [groupData, projectData] = await Promise.all([
          coachService.getGroupBasic(groupId),
          coachService.getProjectDetail(groupId, projectId)
        ])
        setGroup(groupData)
        setProject(projectData)
        setError(null)
      } catch (err) {
        setError('Erreur lors du chargement')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [groupId, projectId])

  if (loading) {
    return (
      <CoachLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </CoachLayout>
    )
  }

  return (
    <CoachLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            {group?.name}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {project?.name || 'Projet'}
          </h1>
          {project?.navigant_name && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Navigant: {project.navigant_name}
            </p>
          )}
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-lg">
            {error}
          </div>
        )}

        {/* Top row - 4 blocks */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Left block - Project info + preparation score */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 h-12 w-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {project?.name}
                </h3>
                {project?.type_support_name && (
                  <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                    {project.type_support_name}
                  </span>
                )}
              </div>
            </div>
            {/* Score de preparation - placeholder */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Score de preparation</div>
              <div className="flex items-center">
                <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-3">
                  <div className="bg-gray-400 dark:bg-gray-500 h-2 rounded-full" style={{ width: '0%' }}></div>
                </div>
                <span className="text-sm text-gray-400 dark:text-gray-500">A venir</span>
              </div>
            </div>
          </div>

          {/* Center block - Sessions */}
          <div
            onClick={() => navigate(`/coach/groups/${groupId}/projects/${projectId}/sessions`)}
            className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 cursor-pointer hover:shadow-lg transition-shadow group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex-shrink-0 h-12 w-12 bg-cyan-100 dark:bg-cyan-900 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-cyan-600 dark:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <svg className="w-5 h-5 text-gray-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Seances
            </h3>
            <div className="mt-2">
              <span className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">
                {project?.sessions_count || 0}
              </span>
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                seance{(project?.sessions_count || 0) > 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Voir toutes les seances du projet
            </p>
          </div>

          {/* Work Leads block */}
          <div
            onClick={() => navigate(`/coach/groups/${groupId}/projects/${projectId}/work-leads`)}
            className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 cursor-pointer hover:shadow-lg transition-shadow group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex-shrink-0 h-12 w-12 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <svg className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Axes de travail
            </h3>
            <div className="mt-2">
              <span className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                {project?.work_leads_count || 0}
              </span>
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                axe{(project?.work_leads_count || 0) > 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Voir tous les axes du projet
            </p>
          </div>

          {/* Periods block */}
          <div
            onClick={() => navigate(`/coach/groups/${groupId}/projects/${projectId}/periods`)}
            className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 cursor-pointer hover:shadow-lg transition-shadow group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex-shrink-0 h-12 w-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <svg className="w-5 h-5 text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Periodes
            </h3>
            <div className="mt-2">
              <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {project?.periods_count || 0}
              </span>
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                periode{(project?.periods_count || 0) > 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Voir toutes les periodes du projet
            </p>
          </div>
        </div>

        {/* Bottom block - Statistics placeholder */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Statistiques
          </h3>
          <div className="flex items-center justify-center h-48 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-gray-500 dark:text-gray-400">Statistiques a venir</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Les graphiques et indicateurs seront affiches ici
              </p>
            </div>
          </div>
        </div>
      </div>
    </CoachLayout>
  )
}

export default GroupProjectDetail
