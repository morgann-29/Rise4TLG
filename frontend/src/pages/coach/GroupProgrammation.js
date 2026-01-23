import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import CoachLayout from '../../components/CoachLayout'
import { coachService } from '../../services/coachService'

function GroupProgrammation() {
  const { groupId } = useParams()
  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const data = await coachService.getGroup(groupId)
        setGroup(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [groupId])

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
            Programmation
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Planifiez les seances a venir pour le groupe
          </p>
        </div>

        {/* Placeholder content */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-12 text-center">
          <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h2 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
            Fonctionnalite a venir
          </h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            La programmation des seances vous permettra de planifier et organiser
            les entrainements a venir pour votre groupe.
          </p>
          <div className="mt-6 flex justify-center space-x-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {group?.sessions_count || 0}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Seances effectuees</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {group?.projects_count || 0}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Projets dans le groupe</div>
            </div>
          </div>
        </div>
      </div>
    </CoachLayout>
  )
}

export default GroupProgrammation
