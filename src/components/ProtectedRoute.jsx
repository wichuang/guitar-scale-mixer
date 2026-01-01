import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children, requiredRole = null }) {
    const { user, profile, loading, hasRole } = useAuth()
    const location = useLocation()

    // 載入中顯示 loading
    if (loading) {
        return (
            <div className="auth-loading">
                <div className="loading-spinner"></div>
                <p>載入中...</p>
            </div>
        )
    }

    // 未登入導向登入頁
    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    // 檢查角色權限
    if (requiredRole && !hasRole(requiredRole)) {
        return (
            <div className="auth-error">
                <h2>⛔ 權限不足</h2>
                <p>你沒有權限存取此頁面</p>
                <p>需要角色: {requiredRole}</p>
                <p>你的角色: {profile?.role || '未知'}</p>
            </div>
        )
    }

    return children
}
