import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { agentsApi, fetchAllAgents, fetchAllMembers, fetchAllUsers, providersApi, templatesApi } from './endpoints'
import type { Environment } from './types'

export const qk = {
  agents: ['agents'] as const,
  agent: (id: string, env: Environment = 'development') => ['agent', id, env] as const,
  environments: (id: string) => ['agent', id, 'environments'] as const,
  promptVersions: (id: string) => ['agent', id, 'prompt-versions'] as const,
  assignments: (id: string) => ['agent', id, 'assignments'] as const,
  providers: ['providers'] as const,
  templates: ['agent-templates'] as const,
  users: ['users'] as const,
  orgs: ['organizations'] as const,
  members: (orgId: string) => ['organizations', orgId, 'members'] as const,
}

export function useAllAgents() {
  return useQuery({ queryKey: qk.agents, queryFn: fetchAllAgents })
}

export function useAgent(id: string, env: Environment = 'development') {
  return useQuery({
    queryKey: qk.agent(id, env),
    queryFn: () => (env === 'development' ? agentsApi.get(id) : agentsApi.environment(id, env)),
    retry: (count, err) => count < 1 && !(err as { code?: number }).code,
  })
}

export function useEnvironments(id: string) {
  return useQuery({ queryKey: qk.environments(id), queryFn: () => agentsApi.environments(id) })
}

export function useAgentTemplates(enabled = true) {
  return useQuery({ queryKey: qk.templates, queryFn: templatesApi.list, staleTime: 10 * 60_000, enabled })
}

export function useProviders() {
  return useQuery({ queryKey: qk.providers, queryFn: providersApi.catalog, staleTime: 10 * 60_000 })
}

/**
 * id → {name, email} for showing owners/assignees. Uses GET /users where the
 * role allows it; QA can't list users, so names fall back to ids there.
 */
export function useUserDirectory() {
  const { abilities, user } = useAuth()
  const q = useQuery({
    queryKey: qk.users,
    queryFn: fetchAllUsers,
    enabled: abilities.viewUsers,
    staleTime: 60_000,
  })
  return useMemo(() => {
    const map = new Map<string, { name: string; email: string }>()
    for (const u of q.data ?? []) map.set(u.id, { name: u.full_name, email: u.email })
    if (user) map.set(user.id, { name: user.full_name, email: user.email })
    return { map, users: q.data ?? [], loading: q.isLoading }
  }, [q.data, q.isLoading, user])
}

export function useOrgMembers(orgId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.members(orgId ?? ''),
    queryFn: () => fetchAllMembers(orgId!),
    enabled: Boolean(orgId) && enabled,
  })
}

/** Union of language codes supported by any active STT/TTS/LLM model. */
export function useLanguageOptions() {
  const { data } = useProviders()
  return useMemo(() => {
    const set = new Set<string>()
    for (const group of [data?.stt, data?.tts, data?.llm])
      for (const p of group ?? []) for (const m of p.models) if (m.is_active) m.supported_languages.forEach((l) => set.add(l.code))
    return [...set].sort()
  }, [data])
}
