import { api, request } from './client'
import type {
  AgentAction,
  AgentDetails,
  AgentFlow,
  AgentListItem,
  AgentOut,
  AgentStatus,
  AgentTemplateOut,
  AgentTemplateSummary,
  AnalyticsSettings,
  DeploymentSettings,
  DynamicMessageSettings,
  Environment,
  EnvironmentSummary,
  FAQSettings,
  LanguageSwitchPreviewResponse,
  LLMSettings,
  LoginResponse,
  MCPServer,
  MembershipOut,
  MyOrganizationOut,
  OrganizationCreate,
  OrganizationCreateResponse,
  OrganizationOut,
  OrganizationStatus,
  OrgRole,
  OthersSettings,
  PostCallTriggerSettings,
  ProviderCatalog,
  SystemPromptVersionOut,
  TestRenderResponse,
  TokenResponse,
  TranscriberSettings,
  UserCreate,
  UserOut,
  UserSelfUpdate,
  UserStatus,
  UserUpdate,
  VoicePersonaSection,
} from './types'

// ---------- auth ----------
export const authApi = {
  login: (credential: string, organization_id?: string) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { credential, organization_id: organization_id ?? null },
      auth: false,
    }),
  logout: (refresh_token: string) => request<null>('/auth/logout', { method: 'POST', body: { refresh_token }, auth: false }),
  switchOrganization: (organization_id: string) => api.post<TokenResponse>('/auth/switch-organization', { organization_id }),
}

// ---------- users ----------
export interface ListParams {
  skip?: number
  limit?: number
  search?: string
}

export const usersApi = {
  me: () => api.get<UserOut>('/users/me'),
  updateMe: (body: UserSelfUpdate) => api.patch<UserOut>('/users/me', body),
  myOrganizations: () => api.get<MyOrganizationOut[]>('/users/me/organizations'),
  list: (params: ListParams & { status?: UserStatus }) => api.get<UserOut[]>('/users', { ...params }),
  get: (id: string) => api.get<UserOut>(`/users/${id}`),
  create: (body: UserCreate) => api.post<UserOut>('/users', body),
  update: (id: string, body: UserUpdate) => api.patch<UserOut>(`/users/${id}`, body),
  disable: (id: string) => api.del<UserOut>(`/users/${id}`),
}

// ---------- organizations & memberships ----------
export const orgsApi = {
  list: (params: ListParams & { status?: OrganizationStatus }) => api.get<OrganizationOut[]>('/organizations', { ...params }),
  get: (id: string) => api.get<OrganizationOut>(`/organizations/${id}`),
  create: (body: OrganizationCreate) => api.post<OrganizationCreateResponse>('/organizations', body),
  update: (id: string, body: { name?: string; status?: OrganizationStatus }) =>
    api.patch<OrganizationOut>(`/organizations/${id}`, body),
  members: (orgId: string, params: ListParams = {}) => api.get<MembershipOut[]>(`/organizations/${orgId}/members`, { ...params }),
  addMember: (orgId: string, user_id: string, role: OrgRole) =>
    api.post<MembershipOut>(`/organizations/${orgId}/members`, { user_id, role }),
  updateMember: (orgId: string, userId: string, role: OrgRole) =>
    api.patch<MembershipOut>(`/organizations/${orgId}/members/${userId}`, { role }),
  removeMember: (orgId: string, userId: string) => api.del<null>(`/organizations/${orgId}/members/${userId}`),
}

// ---------- agents ----------
const a = (id: string, path = '') => `/agents/${id}${path}`

export const templatesApi = {
  list: () => api.get<AgentTemplateSummary[]>('/agent-templates'),
  get: (key: string) => api.get<AgentTemplateOut>(`/agent-templates/${key}`),
  createAgent: (key: string, body: { name?: string | null; description?: string | null }) =>
    api.post<AgentOut>(`/agent-templates/${key}/create-agent`, body),
}

export const agentsApi = {
  list: (params: { skip?: number; limit?: number; status?: AgentStatus }) => api.get<AgentListItem[]>('/agents', { ...params }),
  get: (id: string) => api.get<AgentOut>(a(id)),
  create: (body: AgentDetails) => api.post<AgentOut>('/agents', body),
  remove: (id: string) => api.del<AgentOut>(a(id)),
  setStatus: (id: string, status: AgentStatus) => api.patch<AgentOut>(a(id, '/status'), { status }),
  clone: (id: string) => api.post<AgentOut>(a(id, '/clone')),

  environments: (id: string) => api.get<EnvironmentSummary[]>(a(id, '/environments')),
  environment: (id: string, env: Environment) => api.get<AgentOut>(a(id, `/environments/${env}`)),
  moveToStage: (id: string) => api.post<AgentOut>(a(id, '/move-to-stage')),
  moveToProd: (id: string) => api.post<AgentOut>(a(id, '/move-to-prod')),

  assignments: (id: string) => api.get<string[]>(a(id, '/assignments')),
  assign: (id: string, user_id: string) => api.post<string[]>(a(id, '/assignments'), { user_id }),
  unassign: (id: string, userId: string) => api.del<string[]>(a(id, `/assignments/${userId}`)),

  updateDetails: (id: string, body: Partial<AgentDetails>) => api.patch<AgentOut>(a(id, '/agent-details'), body),
  setLanguages: (id: string, languages: string[]) => api.put<AgentOut>(a(id, '/languages'), { languages }),
  setPreCallVariables: (id: string, pre_call_variables: Record<string, string>, pre_call_variables_enabled: boolean) =>
    api.put<AgentOut>(a(id, '/pre-call-variables'), { pre_call_variables, pre_call_variables_enabled }),
  updatePromptMessages: (id: string, body: Partial<{ welcome_message: string; system_prompt: string; ending_message: string }>) =>
    api.patch<AgentOut>(a(id, '/prompt/messages'), body),
  updateLanguageSwitch: (
    id: string,
    body: Partial<{ language_switch_mode: string; language_switch_prompt: string | null; min_words_for_lang_switch: number }>,
  ) => api.patch<AgentOut>(a(id, '/prompt/language-switch'), body),
  testRender: (id: string, sample_values: Record<string, string>) =>
    api.post<TestRenderResponse>(a(id, '/test'), { sample_values }),
  languageSwitchPreview: (id: string) => api.get<LanguageSwitchPreviewResponse>(a(id, '/prompt/language-switch-preview')),

  promptVersions: (id: string) => api.get<SystemPromptVersionOut[]>(a(id, '/prompt/versions')),
  createPromptVersion: (id: string, body: { prompt_key: string; prompt_description?: string | null; system_prompt: string }) =>
    api.post<SystemPromptVersionOut>(a(id, '/prompt/versions'), body),
  replacePromptVersion: (id: string, prompt_key: string, system_prompt: string) =>
    api.patch<SystemPromptVersionOut>(a(id, '/prompt/versions'), { prompt_key, system_prompt }),
  deletePromptVersion: (id: string, key: string) => api.del<null>(a(id, `/prompt/versions/${encodeURIComponent(key)}`)),

  updateFlow: (id: string, body: Partial<AgentFlow>) => api.patch<AgentOut>(a(id, '/flow'), body),
  updateTranscriber: (id: string, body: Partial<TranscriberSettings>) => api.patch<AgentOut>(a(id, '/transcriber'), body),
  updateLLM: (id: string, body: Partial<LLMSettings>) => api.patch<AgentOut>(a(id, '/llm'), body),
  updateVoice: (id: string, body: Partial<VoicePersonaSection>) => api.patch<AgentOut>(a(id, '/voice-persona'), body),
  updateAnalytics: (id: string, body: Partial<AnalyticsSettings>) => api.patch<AgentOut>(a(id, '/analytics'), body),
  updateOthers: (id: string, body: Partial<OthersSettings>) => api.patch<AgentOut>(a(id, '/others'), body),
  updateFAQ: (id: string, body: Partial<FAQSettings>) => api.patch<AgentOut>(a(id, '/faq'), body),
  updateDeployment: (id: string, body: Partial<DeploymentSettings>) => api.patch<AgentOut>(a(id, '/deployment'), body),
  updateDynamicMessage: (id: string, body: Partial<DynamicMessageSettings>) =>
    api.patch<AgentOut>(a(id, '/dynamic-message'), body),
  updatePostCallTrigger: (id: string, body: Partial<PostCallTriggerSettings>) =>
    api.patch<AgentOut>(a(id, '/post-call-trigger'), body),
  updateActions: (id: string, actions: AgentAction[]) => api.patch<AgentOut>(a(id, '/actions'), { actions }),
  updateMCP: (id: string, servers: MCPServer[]) => api.patch<AgentOut>(a(id, '/mcp'), { servers }),
}

export const providersApi = {
  catalog: () => api.get<ProviderCatalog>('/providers'),
}

/** The agents list has no total count, so page through until a short page. */
export async function fetchAllAgents(): Promise<AgentListItem[]> {
  const pageSize = 100
  const out: AgentListItem[] = []
  for (let skip = 0; ; skip += pageSize) {
    const page = await agentsApi.list({ skip, limit: pageSize })
    out.push(...page)
    if (page.length < pageSize || skip > 10_000) return out
  }
}

export async function fetchAllUsers(): Promise<UserOut[]> {
  const pageSize = 200
  const out: UserOut[] = []
  for (let skip = 0; ; skip += pageSize) {
    const page = await usersApi.list({ skip, limit: pageSize })
    out.push(...page)
    if (page.length < pageSize || skip > 10_000) return out
  }
}

export async function fetchAllMembers(orgId: string): Promise<MembershipOut[]> {
  const pageSize = 200
  const out: MembershipOut[] = []
  for (let skip = 0; ; skip += pageSize) {
    const page = await orgsApi.members(orgId, { skip, limit: pageSize })
    out.push(...page)
    if (page.length < pageSize || skip > 10_000) return out
  }
}
