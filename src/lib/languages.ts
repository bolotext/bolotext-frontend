// Display names for BCP-47 codes. The set of codes offered in pickers comes
// from the provider catalog's `supported_languages`, not from this map.
const display = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' })
  } catch {
    return null
  }
})()

export function languageLabel(code: string) {
  try {
    return display?.of(code) ?? code
  } catch {
    return code
  }
}
