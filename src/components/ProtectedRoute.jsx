import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children, requiredRole = null }) {
    // 暫時繞過：直接回傳內容
    return children
}
