import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './AuthPages.css'

export default function RegisterPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [displayName, setDisplayName] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)

    const { signUp } = useAuth()
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        // 驗證密碼
        if (password !== confirmPassword) {
            return setError('密碼不一致')
        }

        if (password.length < 6) {
            return setError('密碼至少需要 6 個字元')
        }

        setLoading(true)

        try {
            const { error } = await signUp(email, password, displayName)
            if (error) throw error
            setSuccess(true)
        } catch (err) {
            setError(err.message || '註冊失敗')
        } finally {
            setLoading(false)
        }
    }

    if (success) {
        return (
            <div className="auth-page">
                <div className="auth-card">
                    <div className="auth-header">
                        <h1>🎸 Scale Mixer</h1>
                        <h2>✅ 註冊成功！</h2>
                    </div>
                    <div className="auth-success">
                        <p>請檢查你的 Email 並點擊確認連結來啟用帳號。</p>
                        <Link to="/login" className="auth-btn">前往登入</Link>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-header">
                    <h1>🎸 Scale Mixer</h1>
                    <h2>建立帳號</h2>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    {error && <div className="auth-error-msg">{error}</div>}

                    <div className="form-group">
                        <label htmlFor="displayName">顯示名稱</label>
                        <input
                            id="displayName"
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="你的名字"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">密碼</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="至少 6 個字元"
                            required
                            autoComplete="new-password"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword">確認密碼</label>
                        <input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="再次輸入密碼"
                            required
                            autoComplete="new-password"
                        />
                    </div>

                    <button type="submit" className="auth-btn" disabled={loading}>
                        {loading ? '註冊中...' : '註冊'}
                    </button>
                </form>

                <div className="auth-footer">
                    <p>已經有帳號？ <Link to="/login">登入</Link></p>
                </div>
            </div>
        </div>
    )
}
