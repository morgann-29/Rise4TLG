import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Dashboard from './pages/Dashboard'
import ForgotPassword from './pages/ForgotPassword'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import AdminDashboard from './pages/AdminDashboard'
import Users from './pages/Users'
import TypeSupports from './pages/TypeSupports'
import TypeSeances from './pages/TypeSeances'
import TypeWorkLeads from './pages/TypeWorkLeads'
import SuperCoachDashboard from './pages/SuperCoachDashboard'
import Projects from './pages/Projects'
import ProjectDetails from './pages/ProjectDetails'
import Groups from './pages/Groups'
import GroupDetails from './pages/GroupDetails'
import WorkLeadMasterModels from './pages/WorkLeadMasterModels'
import WorkLeadMasterDetail from './pages/WorkLeadMasterDetail'
import SessionMasterModels from './pages/SessionMasterModels'
import SessionMasterDetail from './pages/SessionMasterDetail'
// Coach pages
import CoachDashboard from './pages/coach/CoachDashboard'
import GroupProgrammation from './pages/coach/GroupProgrammation'
import GroupSessions from './pages/coach/GroupSessions'
import GroupSessionDetail from './pages/coach/GroupSessionDetail'
import GroupWorkLeads from './pages/coach/GroupWorkLeads'
import GroupWorkLeadDetail from './pages/coach/GroupWorkLeadDetail'
import GroupProjects from './pages/coach/GroupProjects'

// Helper pour obtenir la route par defaut selon le profil
function getDefaultRoute(isAdmin, isSuperCoach, isCoach) {
  if (isAdmin) return "/admin"
  if (isSuperCoach) return "/super-coach"
  if (isCoach) return "/coach"
  return "/dashboard"
}

// Route publique (redirect si deja connecte vers la bonne page selon le profil)
function PublicRoute({ children }) {
  const { isAuthenticated, isAdmin, isSuperCoach, isCoach } = useAuth()
  if (!isAuthenticated) return children
  return <Navigate to={getDefaultRoute(isAdmin, isSuperCoach, isCoach)} />
}

// Route admin uniquement
function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin, isSuperCoach, isCoach } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" />
  if (!isAdmin) return <Navigate to={getDefaultRoute(false, isSuperCoach, isCoach)} />
  return children
}

// Route Super Coach uniquement
function SuperCoachRoute({ children }) {
  const { isAuthenticated, isAdmin, isSuperCoach, isCoach } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" />
  if (!isSuperCoach) return <Navigate to={getDefaultRoute(isAdmin, false, isCoach)} />
  return children
}

// Route Coach uniquement
function CoachRoute({ children }) {
  const { isAuthenticated, isAdmin, isSuperCoach, isCoach } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" />
  if (!isCoach) return <Navigate to={getDefaultRoute(isAdmin, isSuperCoach, false)} />
  return children
}

// Route operateur uniquement (Navigant, type_profil = 4)
function OperatorRoute({ children }) {
  const { isAuthenticated, isAdmin, isSuperCoach, isCoach } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" />
  if (isAdmin) return <Navigate to="/admin" />
  if (isSuperCoach) return <Navigate to="/super-coach" />
  if (isCoach) return <Navigate to="/coach" />
  return children
}

// Redirection par defaut selon le type de profil
function DefaultRedirect() {
  const { isAuthenticated, isAdmin, isSuperCoach, isCoach } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" />
  return <Navigate to={getDefaultRoute(isAdmin, isSuperCoach, isCoach)} />
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
          <Route path="/" element={<DefaultRedirect />} />

          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />

          <Route
            path="/forgot-password"
            element={
              <PublicRoute>
                <ForgotPassword />
              </PublicRoute>
            }
          />

          <Route
            path="/reset-password"
            element={<ResetPassword />}
          />

          {/* Routes Admin */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />

          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <Users />
              </AdminRoute>
            }
          />

          <Route
            path="/admin/type-supports"
            element={
              <AdminRoute>
                <TypeSupports />
              </AdminRoute>
            }
          />

          <Route
            path="/admin/type-seances"
            element={
              <AdminRoute>
                <TypeSeances />
              </AdminRoute>
            }
          />

          <Route
            path="/admin/type-work-leads"
            element={
              <AdminRoute>
                <TypeWorkLeads />
              </AdminRoute>
            }
          />

          {/* Routes Super Coach */}
          <Route
            path="/super-coach"
            element={
              <SuperCoachRoute>
                <SuperCoachDashboard />
              </SuperCoachRoute>
            }
          />

          <Route
            path="/super-coach/projects"
            element={
              <SuperCoachRoute>
                <Projects />
              </SuperCoachRoute>
            }
          />

          <Route
            path="/super-coach/projects/:id"
            element={
              <SuperCoachRoute>
                <ProjectDetails />
              </SuperCoachRoute>
            }
          />

          <Route
            path="/super-coach/groups"
            element={
              <SuperCoachRoute>
                <Groups />
              </SuperCoachRoute>
            }
          />

          <Route
            path="/super-coach/groups/:id"
            element={
              <SuperCoachRoute>
                <GroupDetails />
              </SuperCoachRoute>
            }
          />

          <Route
            path="/super-coach/work-lead-models"
            element={
              <SuperCoachRoute>
                <WorkLeadMasterModels />
              </SuperCoachRoute>
            }
          />

          <Route
            path="/super-coach/work-lead-models/:id"
            element={
              <SuperCoachRoute>
                <WorkLeadMasterDetail />
              </SuperCoachRoute>
            }
          />

          <Route
            path="/super-coach/session-models"
            element={
              <SuperCoachRoute>
                <SessionMasterModels />
              </SuperCoachRoute>
            }
          />

          <Route
            path="/super-coach/session-models/:id"
            element={
              <SuperCoachRoute>
                <SessionMasterDetail />
              </SuperCoachRoute>
            }
          />

          {/* Routes Coach */}
          <Route
            path="/coach"
            element={
              <CoachRoute>
                <CoachDashboard />
              </CoachRoute>
            }
          />

          <Route
            path="/coach/groups/:groupId/programmation"
            element={
              <CoachRoute>
                <GroupProgrammation />
              </CoachRoute>
            }
          />

          <Route
            path="/coach/groups/:groupId/sessions"
            element={
              <CoachRoute>
                <GroupSessions />
              </CoachRoute>
            }
          />

          <Route
            path="/coach/groups/:groupId/sessions/:sessionId"
            element={
              <CoachRoute>
                <GroupSessionDetail />
              </CoachRoute>
            }
          />

          <Route
            path="/coach/groups/:groupId/work-leads"
            element={
              <CoachRoute>
                <GroupWorkLeads />
              </CoachRoute>
            }
          />

          <Route
            path="/coach/groups/:groupId/work-leads/:workLeadId"
            element={
              <CoachRoute>
                <GroupWorkLeadDetail />
              </CoachRoute>
            }
          />

          <Route
            path="/coach/groups/:groupId/projects"
            element={
              <CoachRoute>
                <GroupProjects />
              </CoachRoute>
            }
          />

          {/* Routes Operateur (Navigant) */}
          <Route
            path="/dashboard"
            element={
              <OperatorRoute>
                <Dashboard />
              </OperatorRoute>
            }
          />

          {/* TODO: Ajouter vos routes metier ici */}

          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
