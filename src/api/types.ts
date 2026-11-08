// Types mirror the users-service and agents-service OpenAPI schemas
// (GET :8001/openapi.json, :8002/openapi.json). Keep names aligned with the
// backend so they're easy to diff when the API changes.

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'DEVELOPER' | 'QA'
export type OrgRole = Exclude<Role, 'SUPER_ADMIN'>
export type UserStatus = 'active' | 'invited' | 'disabled'
export type OrganizationStatus = 'active' | 'suspended'
/** Product areas a Super Admin can switch on or off per organization. */
export type Feature = 'voice_agents' | 'whatsapp' | 'sms'

export interface Envelope<T> {
  status: 'success' | 'error'
  code: number
  message: string
  data?: T
  errors?: unknown
}

// ---------- users-service ----------

export interface OrganizationChoice {
  organization_id: string
  name: string
  role: Role
}

export interface LoginResponse {
  access_token: string | null
  refresh_token: string | null
  token_type: string
  organizations: OrganizationChoice[] | null
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface UserOut {
  id: string
  /** Product areas this user may use; only set by GET /users/me. */
  features?: Feature[] | null
  organization_id: string | null
  email: string
  full_name: string
  role: Role | null
  is_super_admin: boolean
  status: UserStatus
  created_by: string | null
  created_at: string
  updated_at: string
  last_login_at: string | null
}

export interface UserCreate {
  email: string
  full_name: string
  role: OrgRole
  password?: string | null
  organization_id?: string | null
}

export interface UserUpdate {
  full_name?: string | null
  role?: OrgRole | null
  status?: UserStatus | null
}

export interface UserSelfUpdate {
  full_name?: string | null
}

export interface MyOrganizationOut {
  organization_id: string
  name: string
  slug: string
  role: Role
}

export interface OrganizationOut {
  id: string
  name: string
  slug: string
  status: OrganizationStatus
  features: Feature[]
  created_by: string
  created_at: string
  updated_at: string
}

export interface OrganizationCreate {
  name: string
  slug: string
  admin_email?: string | null
  admin_full_name?: string | null
  features?: Feature[]
}

export interface OrganizationCreateResponse {
  organization: OrganizationOut
  admin_user_id: string | null
}

export interface MembershipOut {
  user_id: string
  organization_id: string
  email: string
  full_name: string
  role: Role
  created_at: string
}

// ---------- agents-service ----------

export type AgentStatus = 'active' | 'inactive'
export type Environment = 'development' | 'stage' | 'production'
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface AgentDetails {
  name: string
  description?: string | null
  region: string
  timezone: string
  bot_type: string[]
}

export interface AgentTemplateSummary {
  key: string
  name: string
  category: string
  description: string
  direction: string
  languages: string[]
}

export interface AgentTemplateOut extends AgentTemplateSummary {
  regulatory_notes: string[]
  disclaimer: string
}

export interface AgentListItem {
  id: string
  user_id: string
  org_id: string | null
  status: AgentStatus
  agent_details: { name: string; description?: string | null }
  created_at: string
  updated_at: string
}

export interface DynamicMessageSettings {
  dynamic_message_enabled: boolean
  method: HttpMethod
  url: string | null
  headers: Record<string, string>
}

export interface PostCallTriggerSettings {
  post_call_trigger_enabled: boolean
  method: HttpMethod
  url: string | null
  headers: Record<string, string>
}

export type LanguageSwitchMode = 'implicit' | 'explicit' | 'custom'

export interface AgentPrompt {
  welcome_message: string
  system_prompt: string
  ending_message: string
  language_switch_mode: LanguageSwitchMode
  language_switch_prompt: string | null
  min_words_for_lang_switch: number
  pre_call_variables: Record<string, string>
  pre_call_variables_enabled: boolean
  dynamic_message: DynamicMessageSettings
}

export interface AgentFlow {
  agent_type: 'single_prompt' | 'flow'
  drop_off_scenarios: string[]
  flow_definition: Record<string, unknown> | null
}

export interface TranscriberSettings {
  provider_id: string
  model_id: string | null
  language: string
  tier?: string | null
  allow_interruptions: boolean
  min_time_to_barge: number
  background_noise_filtering: boolean
  noise_suppression_level: number
  inverse_text_normalization: boolean
  smart_pause: boolean
  max_speech_duration: number
  initial_silence_timeout: number
  speech_segmentation_silence_timeout: number
  enable_dtmf: boolean
}

export interface LLMSettings {
  provider_id: string
  model_id: string
  temperature: number
  max_tokens: number
  knowledge_base_ids: string[]
}

export interface VoicePersonaSection {
  model_id: string | null
  gender: 'male' | 'female' | 'neutral' | null
  provider_id: string
  voice_id: string
  rate_of_speech: number
  use_ambient_sound: boolean
  ambient_sound_volume: number
  ambient_sound_type: string | null
}

export interface ExtractionField {
  field_name: string
  field_description: string
  field_type: 'string' | 'enum' | 'number' | 'boolean'
  enum_values: string[] | null
  is_required: boolean
}

export interface AnalyticsSettings {
  disposition_enabled: boolean
  disposition_prompt: string | null
  post_call_extraction_enabled: boolean
  extraction_fields: ExtractionField[]
  post_call_trigger: PostCallTriggerSettings
}

export interface VoicemailDetectionConfig {
  enabled: boolean
  max_detection_retries: number
  voicemail_response: string | null
}

export interface CallTransferConfig {
  enabled: boolean
  default_transfer_message: string | null
  tta_type: 'phone' | 'sip'
  send_transcript_with_transfer: boolean
}

export interface OthersSettings {
  voicemail_detection: VoicemailDetectionConfig | null
  call_transfer: CallTransferConfig | null
}

export interface FAQPair {
  question: string
  answer: string
}

export interface FAQSettings {
  enabled: boolean
  pairs: FAQPair[]
}

export interface DeploymentSettings {
  inbound_calling_enabled: boolean
  inbound_number: string | null
  outbound_calling_enabled: boolean
  chat_widget_enabled: boolean
  valid_origins: string[]
}

export interface ActionParam {
  name: string
  type: 'string' | 'number' | 'boolean'
  description: string
  required: boolean
}

export interface AgentAction {
  name: string
  description: string
  endpoint_url: string
  method: 'GET' | 'POST'
  params: ActionParam[]
  headers: Record<string, string>
}

export interface MCPServer {
  server_id: string
  name: string
  url: string
  transport: 'streamable_http' | 'sse'
  auth_token: string | null
  enabled: boolean
  allowed_tools: string[]
}

export interface AgentOut {
  id: string
  user_id: string
  org_id: string | null
  status: AgentStatus
  environment: Environment
  languages: string[]
  agent_details: AgentDetails
  prompt: AgentPrompt
  flow: AgentFlow
  transcriber: TranscriberSettings
  llm: LLMSettings
  voice_persona: VoicePersonaSection
  analytics: AnalyticsSettings
  others: OthersSettings
  faq: FAQSettings
  deployment: DeploymentSettings
  actions: { actions: AgentAction[] }
  mcp: { servers: MCPServer[] }
  created_at: string
  updated_at: string
}

export interface EnvironmentSummary {
  environment: Environment
  exists: boolean
  updated_at: string | null
}

export interface SystemPromptVersionOut {
  prompt_key: string
  prompt_description: string | null
  system_prompt: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface TestRenderResponse {
  welcome_message: string
  system_prompt: string
  ending_message: string
  sample_values_used: Record<string, string>
}

export interface LanguageSwitchPreviewResponse {
  mode: LanguageSwitchMode
  languages: string[]
  prompt: string | null
}

export interface LanguageOption {
  language: string
  code: string
}

export interface VoiceOption {
  voice_id: string
  label: string
  gender: string | null
  language: string | null
  accent?: string | null
}

export interface ModelInfo {
  model_id: string
  label: string
  description: string | null
  is_active: boolean
  function_calling: boolean
  supported_languages: LanguageOption[]
  voice_ids: string[]
  voices?: VoiceOption[]
}

export interface ProviderInfo {
  provider_id: string
  label: string
  supports_function_calling: boolean
  multilingual: boolean
  models: ModelInfo[]
}

export interface ProviderCatalog {
  llm: ProviderInfo[]
  stt: ProviderInfo[]
  tts: ProviderInfo[]
}

// ---------- API tokens (Super Admin) ----------
export interface ApiTokenOut {
  id: string
  name: string
  token_prefix: string
  scopes: string[]
  created_by: string
  created_at: string
  revoked: boolean
  revoked_at: string | null
}

export interface ApiTokenCreated extends ApiTokenOut {
  /** The full token — returned only by the create call, never again. */
  token: string
}

// ---------- whatsapp (agents-service /whatsapp) ----------
export type WhatsAppAgentStatus = 'active' | 'inactive'
export type TemplateCategory = 'utility' | 'marketing' | 'authentication'
export type ApprovalStatus = 'draft' | 'pending' | 'approved' | 'rejected'
export type SendStatus = 'pending' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed'

export interface WhatsAppAgentOut {
  id: string
  org_id: string | null
  user_id: string
  name: string
  description: string | null
  use_case: string | null
  twilio_sender: string | null
  channel: 'whatsapp' | 'sms'
  status: WhatsAppAgentStatus
  field_mapper: WhatsAppField[]
  created_at: string
  updated_at: string
}
export type WhatsAppFieldType = 'string' | 'number' | 'long' | 'boolean' | 'checkbox' | 'date'
export interface WhatsAppFieldInput {
  key: string
  type: WhatsAppFieldType
  required: boolean
}
export interface WhatsAppField extends WhatsAppFieldInput {
  locked: boolean
}
export interface WhatsAppAgentCreate {
  channel?: 'whatsapp' | 'sms'
  name: string
  description?: string | null
  use_case?: string | null
  twilio_sender?: string | null
}
export type WhatsAppAgentUpdate = Partial<WhatsAppAgentCreate> & { status?: WhatsAppAgentStatus }

export interface WhatsAppConfig {
  dry_run: boolean
  default_sender_configured: boolean
  default_sms_sender_configured: boolean
}

export type TemplateSource = 'bolotext' | 'twilio'
export interface WhatsAppTwilioTemplate {
  sid: string
  name: string
  language: string
  body: string
  variables: string[]
  approval_status: string
  category: string | null
  rejection_reason: string | null
  template_id: string | null
}
export interface WhatsAppTemplateOut {
  id: string
  whatsapp_agent_id: string
  name: string
  language: string
  category: TemplateCategory
  body: string
  variables: string[]
  var_names: string[]
  source: TemplateSource
  twilio_content_sid: string | null
  approval_status: ApprovalStatus
  rejection_reason: string | null
  created_at: string
  updated_at: string
}
export interface WhatsAppTemplateInput {
  name: string
  language: string
  category: TemplateCategory
  body: string
}

export interface WhatsAppContactOut {
  id: string
  whatsapp_agent_id: string
  batch_id: string | null
  customer_name: string
  phone_number: number // E.164 digits without '+', stored as a MongoDB long
  message: string
  data: Record<string, unknown>
  send_status: SendStatus
  opted_out: boolean
  template_id: string | null
  twilio_message_sid: string | null
  error: string | null
  sent_at: string | null
  created_at: string
  updated_at: string
}
export interface WhatsAppContactInput {
  customer_name: string
  phone_number: string // any common format; stored as an integer
  data?: Record<string, unknown>
}
export interface WhatsAppContactList {
  items: WhatsAppContactOut[]
  total: number
}
export interface WhatsAppBatchOut {
  id: string
  whatsapp_agent_id: string
  filename: string
  total_rows: number
  valid_rows: number
  invalid_rows: number
  uploaded_by: string
  created_at: string
}
export interface WhatsAppUploadResult {
  batch: WhatsAppBatchOut
  errors: { row: number; error: string }[]
}
export interface WhatsAppSendRequest {
  contact_ids?: string[]
  batch_id?: string
  template_id?: string | null
  consent_confirmed: boolean
}
export interface WhatsAppSendResult {
  job_id: string
  requested: number
  queued: number
  skipped: number
  dry_run: boolean
}
export interface WhatsAppStats {
  total: number
  pending: number
  queued: number
  sent: number
  delivered: number
  read: number
  failed: number
  opted_out: number
}

export interface WhatsAppSettings {
  twilio_account_sid: string
  has_auth_token: boolean
  auth_token_hint: string | null
  twilio_whatsapp_from: string
  twilio_sms_from: string
  dry_run: boolean
  default_country_code: string
  simulated: boolean
  updated_at: string | null
}
/** Partial update; `auth_token` is write-only (omit/empty keeps the saved one). */
export interface WhatsAppSettingsUpdate {
  twilio_account_sid?: string
  auth_token?: string
  twilio_whatsapp_from?: string
  twilio_sms_from?: string
  dry_run?: boolean
  default_country_code?: string
}
export interface WhatsAppConnectionTest {
  ok: boolean
  detail: string
}

export interface WhatsAppMessageStatus {
  contact_id: string
  customer_name: string
  phone_number: number // E.164 digits without '+', stored as a MongoDB long
  message_sid: string | null
  status: string | null
  send_status: SendStatus
  error_code: string | null
  error_message: string | null
  sent_at: string | null
  status_at: string | null
  events: number
}
export interface WhatsAppMessageStatusList {
  items: WhatsAppMessageStatus[]
  total: number
}
export interface WhatsAppMessageEvent {
  id: string
  message_sid: string | null
  status: string
  error_code: string | null
  error_message: string | null
  source: 'send' | 'webhook' | 'refresh'
  payload: Record<string, string>
  received_at: string
}
export interface WhatsAppRefreshResult {
  checked: number
  updated: number
  errors: number
  simulated: number
}

// ---------- call logs ----------
export interface CallLogSummary {
  id: string
  agent_id: string
  session_id: string | null
  source: string | null
  direction: string | null
  status: string | null
  test: boolean
  duration: string | null
  duration_seconds: number | null
  started_at: string | null
  from_phone: string | null
  to_phone: string | null
  web_uuid: string | null
  recording_sid: string | null
  hangup_reason: string | null
  messages: number
  created_at: string
}
export interface CallLogList {
  items: CallLogSummary[]
  total: number
}
/** One entry of the stored conversation journey; its shape depends on `type`. */
export interface JourneyItem {
  id?: string
  type?: string
  role?: string
  content?: string[]
  interrupted?: boolean
  created_at?: number
  [key: string]: unknown
}
/** The stored call-log document, as the voice runtime posted it. */
export interface CallLogDocument {
  conversation_id?: string | null
  bot_id?: string | null
  bot_type?: string | null
  call_status?: string | null
  callType?: string | null
  callStartTime?: string | null
  is_test?: boolean
  environment?: string | null
  duration?: string | null
  hangup_reason?: Record<string, unknown> | null
  token_usage?: Record<string, number>
  conversation_log?: JourneyItem[]
  [key: string]: unknown
}
export interface CallLogOut extends CallLogSummary {
  log: CallLogDocument
}

/** LiveKit connection details for a browser voice call. Agent id, environment
 * and custom variables are embedded in the token's participant metadata. */
export interface WebCallToken {
  server_url: string
  participant_token: string
  room_name: string
  agent_id: string
  environment: Environment
}

// ---------- Usage & pricing (Super Admin) ----------
export type UsageKind = 'stt' | 'llm' | 'tts'

export interface UsageTotals {
  calls: number
  input_tokens: number
  cached_tokens: number
  output_tokens: number
  audio_seconds: number
  characters: number
}

export interface KindSummary {
  kind: UsageKind
  usage: UsageTotals
  cost: number
  unpriced_models: number
}

export interface UsageSummary {
  kinds: KindSummary[]
  cost: number
  has_unpriced: boolean
}

export interface OrgUsageRow extends UsageSummary {
  org_id: string
  org_name: string
}

export interface CostLine {
  kind: UsageKind
  provider_id: string
  model_id: string
  usage: UsageTotals
  cost: number | null
}

export interface DailyPoint {
  day: string
  cost: number
  calls: number
}

export interface UsageOverview {
  currency: string
  usd_to_inr: number | null
  total: UsageSummary
  organizations: OrgUsageRow[]
  daily: DailyPoint[]
}

export interface OrgUsageDetail {
  currency: string
  usd_to_inr: number | null
  org_id: string
  org_name: string
  total: UsageSummary
  models: CostLine[]
  daily: DailyPoint[]
}

export interface ModelPrice {
  kind: UsageKind
  provider_id: string
  model_id: string
  currency: string
  input_per_million: number | null
  cached_input_per_million: number | null
  output_per_million: number | null
  per_minute: number | null
  per_million_chars: number | null
  priced?: boolean
}

// ---------- Telephony (SIP trunks via LiveKit) ----------
export interface TelephonyState {
  connected: boolean
  origination_uri: string | null
  termination_uri: string | null
  auth_username: string | null
  numbers: string[]
  outbound_enabled: boolean
  inbound_enabled: boolean
  inbound_numbers: string[]
  outbound_trunk_id: string | null
  outbound_trunk_shared: boolean
  inbound_trunk_id: string | null
  dispatch_rule_id: string | null
  updated_at: string | null
}

export interface TelephonyConnectBody {
  termination_uri: string
  auth_username: string | null
  auth_password: string | null
  numbers: string[]
}

export interface AvailableTrunk {
  id: string
  name: string
  address: string | null
  numbers: string[]
  transport: string | null
  linked: boolean
  shared_with: number
  usable: boolean
}

export type TrunkKind = 'outbound' | 'inbound'

export interface SipTrunk {
  id: string
  kind: TrunkKind
  name: string
  address: string | null
  numbers: string[]
  auth_username: string | null
  allowed_addresses: string[]
  transport: string | null
  agent_id: string | null
}

export interface SipDispatchRule {
  id: string
  name: string
  trunk_ids: string[]
  room_prefix: string | null
  metadata: string | null
  agent_id: string | null
}

export interface SipTrunkList {
  origination_uri: string | null
  outbound: SipTrunk[]
  inbound: SipTrunk[]
  dispatch_rules: SipDispatchRule[]
}

export interface SipTrunkBody {
  name: string
  address?: string | null
  numbers: string[]
  auth_username?: string | null
  auth_password?: string | null
  allowed_addresses?: string[]
}

// ---------- Rent a number (LiveKit Phone Numbers) ----------
export interface NumberSearchResult {
  phone_number: string
  country_code: string | null
  area_code: string | null
  number_type: string
  locality: string | null
  region: string | null
  capabilities: string[]
}

export interface RentedNumber {
  id: string
  phone_number: string
  number_type: string
  locality: string | null
  region: string | null
  status: string
  agent_id: string | null
  org_id: string | null
  org_name: string | null
  external: boolean
  dispatch_rule_ids: string[]
  warning: string | null
}

export interface RentedNumberList {
  items: RentedNumber[]
  limit_per_org: number | null
}
