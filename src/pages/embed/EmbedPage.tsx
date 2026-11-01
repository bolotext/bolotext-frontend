import { useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { webCallApi } from '@/api/endpoints'
import { ApiError } from '@/api/client'
import { VoiceCall } from '@/components/voice/VoiceCall'

/** Parse `?vars={"plan":"pro"}` into string-only custom variables. */
function parseVars(raw: string | null): Record<string, string> {
  if (!raw) return {}
  try {
    const obj = JSON.parse(raw) as unknown
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {}
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, String(v)]))
  } catch {
    return {}
  }
}

/**
 * Public voice widget, meant to be loaded in an iframe by public/embed.js.
 * The embedding site's origin is sent to the backend, which checks it against
 * the agent's allowed origins before issuing a token.
 */
export default function EmbedPage() {
  const { agentId = '' } = useParams()
  const [params] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const vars = useMemo(() => parseVars(params.get('vars')), [params])

  // Browsers that expose it give the real parent origin; the query param is a fallback.
  const parentOrigin = window.location.ancestorOrigins?.[0] ?? params.get('parent')

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 bg-surface p-4">
      <VoiceCall
        startLabel="Talk to our assistant"
        onError={(e) => setError(e instanceof ApiError ? e.message : 'Unable to start the call')}
        fetchToken={() => {
          setError(null)
          return webCallApi.publicToken(agentId, {
            parent_origin: parentOrigin,
            time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            custom_variables: vars,
          })
        }}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
