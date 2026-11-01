/*
 * Bolotext voice widget loader. Add to any page (classic script, not a module):
 *
 *   <script src="https://YOUR-APP/embed.js"
 *           data-agent-id="AGENT_ID"
 *           data-metadata='{"plan":"pro","account_id":"acc_123"}'></script>
 *
 * data-metadata is optional; its keys are passed to the agent as custom variables.
 * The embedding origin must be listed under the agent's Deployment → Allowed origins.
 */
(function () {
  var s = document.currentScript
  if (!s) return
  var agentId = s.getAttribute('data-agent-id')
  if (!agentId) return console.error('[bolotext] data-agent-id is required')
  var base = new URL(s.src).origin
  var q = new URLSearchParams({ parent: location.origin })
  var meta = s.getAttribute('data-metadata')
  if (meta) q.set('vars', meta)

  var f = document.createElement('iframe')
  f.src = base + '/embed/' + encodeURIComponent(agentId) + '?' + q.toString()
  f.allow = 'microphone'
  f.title = 'Voice assistant'
  f.style.cssText =
    'position:fixed;right:20px;bottom:20px;width:300px;height:180px;border:0;border-radius:16px;' +
    'box-shadow:0 8px 30px rgba(0,0,0,.2);z-index:2147483647;color-scheme:normal'
  document.body.appendChild(f)
})()
