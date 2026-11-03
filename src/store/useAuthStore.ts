import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { getUserRole } from '../lib/auth'
import type { UserRole } from '../types/auth'

interface AuthState {
  session: Session | null
  user: User | null
  role: UserRole | null
  loading: boolean
  initialized: boolean
  initialize: () => Promise<void>
  signOut: () => Promise<void>
}

let authListenerAttached = false

function buildSessionState(session: Session | null) {
  return {
    session,
    user: session?.user ?? null,
    role: getUserRole(session?.user),
    loading: false,
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  role: null,
  loading: true,
  initialized: false,

  initialize: async () => {
    try {
      const { data } = await supabase.auth.getSession()
      set({ ...buildSessionState(data.session), initialized: true })
    } catch {
      set({ loading: false, initialized: true })
    }

    if (!authListenerAttached) {
      authListenerAttached = true

      supabase.auth.onAuthStateChange((_event, session) => {
        useAuthStore.setState(buildSessionState(session))
      })
    }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    useAuthStore.setState({ ...buildSessionState(null), initialized: true })
  },
}))
