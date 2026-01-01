import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

// 角色層級定義
const ROLE_HIERARCHY = {
    developer: 4,
    admin: 3,
    teacher: 2,
    student: 1
}

export function AuthProvider({ children }) {
    // 暫時繞過驗證：預設為已登入狀態，權限為 developer
    const [user, setUser] = useState({ id: 'guest-id', email: 'guest@example.com' })
    const [profile, setProfile] = useState({
        id: 'guest-profile-id',
        display_name: 'Guest Developer',
        role: 'developer'
    })
    const [loading, setLoading] = useState(false)

    /* 註釋掉原本的驗證邏輯
    useEffect(() => {
        // ... 原本的邏輯 ...
    }, [])
    */

    // 取得使用者 profile
    const fetchProfile = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .single()

            if (error) throw error
            setProfile(data)
        } catch (error) {
            console.error('Error fetching profile:', error)
            setProfile(null)
        } finally {
            setLoading(false)
        }
    }

    // 登入
    const signIn = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        })
        return { data, error }
    }

    // 註冊
    const signUp = async (email, password, displayName) => {
        // 動態獲取目前的跳轉網址，確保支援 GitHub Pages 的子路徑
        const currentOrigin = window.location.origin;
        const currentPathname = window.location.pathname;
        const redirectTo = `${currentOrigin}${currentPathname.replace(/\/register\/?$/, '/login')}`;

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    display_name: displayName
                },
                emailRedirectTo: redirectTo
            }
        })
        return { data, error }
    }

    // 登出
    const signOut = async () => {
        const { error } = await supabase.auth.signOut()
        if (!error) {
            setUser(null)
            setProfile(null)
        }
        return { error }
    }

    // 檢查是否有特定角色權限
    const hasRole = (requiredRole) => {
        if (!profile?.role) return false
        const userLevel = ROLE_HIERARCHY[profile.role] || 0
        const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0
        return userLevel >= requiredLevel
    }

    // 檢查是否為特定角色
    const isRole = (role) => profile?.role === role

    // 更新 profile
    const updateProfile = async (updates) => {
        if (!profile?.id) return { error: new Error('No profile') }

        const { data, error } = await supabase
            .from('profiles')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', profile.id)
            .select()
            .single()

        if (!error && data) {
            setProfile(data)
        }
        return { data, error }
    }

    const value = {
        user,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        hasRole,
        isRole,
        updateProfile,
        isAuthenticated: !!user
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}
