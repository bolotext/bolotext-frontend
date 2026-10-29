import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { onSessionExpired, tokens } from '@/api/client'
import { authApi, usersApi } from '@/api/endpoints'
import type { Feature, MyOrganizationOut, OrganizationChoice, UserOut } from '@/api/types'
import { ALL_FEATURES } from '@/lib/features'
import { abilitiesFor, effectiveRole, type Abilities } from '@/lib/permissions'

type LoginResult = { ok: true } | { ok: false; organizations: OrganizationChoice[] }

interface AuthState {
  user: UserOut | null
  loading: boolean
  error: unknown
  abilities: Abilities
  /** Product areas the current organization may use. */
  features: Feature[]
  hasFeature: (feature: Feature) => boolean
  organizations: MyOrganizationOut[]
  currentOrg: MyOrganizationOut | null
  login: (credential: string, organizationId?: string) => Promise<LoginResult>
  logout: () => Promise<void>
  switchOrganization: (organizationId: string) => Promise<void>
  refreshUser: () => Promise<unknown>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [hasToken, setHasToken] = useState(() => Boolean(tokens.access))

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: usersApi.me,
    enabled: hasToken,
    staleTime: 60_000,
    retry: false,
  })

  const orgsQuery = useQuery({
    queryKey: ['me', 'organizations'],
    queryFn: usersApi.myOrganizations,
    enabled: hasToken && meQuery.isSuccess,
    staleTime: 5 * 60_000,
  })

  useEffect(
    () =>
      onSessionExpired(() => {
        setHasToken(false)
        qc.clear()
      }),
    [qc],
  )

  const login = useCallback(
    async (credential: string, organizationId?: string): Promise<LoginResult> => {
      const res = await authApi.login(credential, organizationId)
      if (!res.access_token || !res.refresh_token) {
        return { ok: false, organizations: res.organizations ?? [] }
      }
      tokens.set(res.access_token, res.refresh_token)
      qc.clear()
      setHasToken(true)
      await qc.fetchQuery({ queryKey: ['me'], queryFn: usersApi.me })
      return { ok: true }
    },
    [qc],
  )

  const logout = useCallback(async () => {
    const refresh = tokens.refresh
    tokens.clear()
    setHasToken(false)
    qc.clear()
    // Revoke server-side; the local session is already gone either way.
    if (refresh) await authApi.logout(refresh).catch(() => undefined)
  }, [qc])

  const switchOrganization = useCallback(
    async (organizationId: string) => {
      const res = await authApi.switchOrganization(organizationId)
      tokens.set(res.access_token, res.refresh_token)
      // Everything in memory (queries, page state) was scoped to the previous
      // organization — a full reload is the one reliable way to reset it all.
      window.location.assign('/')
    },
    [],
  )

  const user = hasToken ? (meQuery.data ?? null) : null
  const organizations = useMemo(() => orgsQuery.data ?? [], [orgsQuery.data])
  const features = useMemo<Feature[]>(() => user?.features ?? ALL_FEATURES, [user])
  const value = useMemo<AuthState>(
    () => ({
      user,
      loading: hasToken && meQuery.isPending,
      error: hasToken ? meQuery.error : null,
      abilities: abilitiesFor(effectiveRole(user)),
      features,
      hasFeature: (f) => features.includes(f),
      organizations,
      currentOrg: organizations.find((o) => o.organization_id === user?.organization_id) ?? null,
      login,
      logout,
      switchOrganization,
      refreshUser: meQuery.refetch,
    }),
    [user, features, hasToken, meQuery.isPending, meQuery.error, meQuery.refetch, organizations, login, logout, switchOrganization],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
