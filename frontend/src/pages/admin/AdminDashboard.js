import AdminLayout from '../../components/AdminLayout'

function AdminDashboard() {
  return (
    <AdminLayout>
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Admin Dashboard
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Interface d'administration. Personnalisez cette page selon vos besoins.
        </p>
      </div>
    </AdminLayout>
  )
}

export default AdminDashboard
