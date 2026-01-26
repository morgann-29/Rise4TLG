import NavigantLayout from '../../components/NavigantLayout'

function NavigantDashboard() {
  return (
    <NavigantLayout>
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Bienvenue sur votre espace Navigant !
        </p>
      </div>
    </NavigantLayout>
  )
}

export default NavigantDashboard
