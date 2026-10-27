import type { Role, UserOut } from '@/api/types'

// The backend exposes no "list my permissions" endpoint, so this mirrors
// users_service/db/seed.py ROLE_PERMISSIONS and the agent rules in
// agents_service/agents/service.py (_authorize_agent_access, create_agent,
// clone_agent, _require_admin). It only drives what the UI shows — the
// backend still enforces every check, and a FORBIDDEN response is surfaced
// as-is if the two ever drift.

export type Permission =
  | 'user.create'
  | 'user.view'
  | 'user.update'
  | 'user.delete'
  | 'organization.create'
  | 'organization.view'
  | 'organization.update'
  | 'membership.create'
  | 'membership.view'
  | 'membership.update'
  | 'membership.delete'

const ROLE_PERMISSIONS: Record<Role, string[]> = {
  SUPER_ADMIN: ['*'],
  ADMIN: ['user.*', 'membership.*'],
  DEVELOPER: ['user.view'],
  QA: [],
}

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  DEVELOPER: 'Developer',
  QA: 'QA',
}

export const ROLE_DESCRIPTION: Record<Role, string> = {
  SUPER_ADMIN: 'Platform-wide access across every organization.',
  ADMIN: 'Full access to every agent in the organization; manages users and agent assignments.',
  DEVELOPER: 'Builds and edits agents assigned to them; can create new agents.',
  QA: 'View-only access to every agent in the organization, including prompt previews.',
}

export function effectiveRole(user: Pick<UserOut, 'is_super_admin' | 'role'> | null | undefined): Role | null {
  if (!user) return null
  if (user.is_super_admin) return 'SUPER_ADMIN'
  return user.role
}

function hasPermission(role: Role | null, perm: Permission): boolean {
  if (!role) return false
  const granted = ROLE_PERMISSIONS[role]
  if (granted.includes('*') || granted.includes(perm)) return true
  return granted.includes(`${perm.split('.')[0]}.*`)
}

export interface Abilities {
  role: Role | null
  can: (perm: Permission) => boolean
  // Agents
  createAgent: boolean
  editAgents: boolean
  cloneAgent: boolean
  deleteAgent: boolean
  promoteAgent: boolean
  manageAssignments: boolean
  // Navigation
  viewUsers: boolean
  viewOrganizations: boolean
  manageApiTokens: boolean
}

export function abilitiesFor(role: Role | null): Abilities {
  const can = (perm: Permission) => hasPermission(role, perm)
  const isQA = role === 'QA'
  const signedIn = role !== null
  return {
    role,
    can,
    createAgent: signedIn && !isQA,
    editAgents: signedIn && !isQA,
    cloneAgent: signedIn && !isQA,
    deleteAgent: signedIn && !isQA,
    promoteAgent: signedIn && !isQA,
    manageAssignments: role === 'ADMIN' || role === 'SUPER_ADMIN',
    // GET /users rejects QA regardless of permission.
    viewUsers: can('user.view') && !isQA,
    viewOrganizations: can('organization.view'),
    // POST/GET/DELETE /api-tokens are Super Admin only.
    manageApiTokens: role === 'SUPER_ADMIN',
  }
}
