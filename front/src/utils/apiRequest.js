export async function parseApiResponse(response, fallbackMessage) {
  const rawText = await response.text()
  let result = {}

  if (rawText) {
    try {
      result = JSON.parse(rawText)
    } catch {
      result = { detail: rawText }
    }
  }

  if (!response.ok) {
    throw new Error(result.detail || result.message || fallbackMessage)
  }

  return result
}
