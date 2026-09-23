import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from './pages/login'
import RegisterPage from './pages/register'
import DashboardPage from './pages/dashboard'
import LogWorkoutPage from './pages/logworkout'
import HistoryPage from './pages/history'
import ProgressPage from './pages/progress'
import SettingsPage from './pages/settings'
import NotFoundPage from './pages/404'
import Layout from './components/Layout'
import SwipeDeck from './components/SwipeDeck'
import { AuthProvider, useAuth } from './context/authContext'
import { ThemeProvider } from './context/themeContext'
import './App.css'

function AppRoutes() {
  const { user } = useAuth()

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={user ? ( <Navigate to="/dashboard" replace />) : (<LoginPage /> )}
        />
        <Route
          path="/register" 
          element={user ? ( <Navigate to="/dashboard" replace /> ) : ( <RegisterPage /> )}
        />

        <Route element={user ? ( <Layout />) : ( <Navigate to="/login" replace /> ) } >
          <Route path="/dashboard" element={<SwipeDeck />} />
          <Route path="/history" element={<SwipeDeck />} />
          <Route path="/logworkout" element={<SwipeDeck />} />
          <Route path="/progress" element={<SwipeDeck />} />
          <Route path="/progress/:exerciseId" element={<SwipeDeck />} />
          <Route path="/settings" element={<SwipeDeck />} />
        </Route>

        <Route
          path="/"
          element={ <Navigate to={user ? '/dashboard' : '/login'} replace /> }
        />
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