import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from './pages/login'
import RegisterPage from './pages/register'
import DashboardPage from './pages/dashboard'
import LogWorkoutPage from './pages/logworkout'
import HistoryPage from './pages/history'
import ProgressPage from './pages/progress'
import ExerciseProgressPage from './pages/exerciseProgress'
import SettingsPage from './pages/settings'
import NotFoundPage from './pages/404'
import { AuthProvider, useAuth } from './context/authContext'
import { ThemeProvider } from './context/themeContext'
import './App.css'

function AppRoutes() {
  const { user } = useAuth()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/dashboard"
          element={user ? <DashboardPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/logworkout"
          element={user ? <LogWorkoutPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/history"
          element={user ? <HistoryPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/progress"
          element={user ? <ProgressPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/exercise/:exerciseId"
          element={user ? <ExerciseProgressPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/settings"
          element={user ? <SettingsPage /> : <Navigate to="/login" replace />}
        />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App