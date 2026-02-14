/**
 * Anthropic AI Client Factory
 * Dynamic import ile Anthropic SDK'sını yükler ve yapılandırılmış client döndürür.
 * Tekrarlanan `new (await import('@anthropic-ai/sdk')).default(...)` kalıbını merkezileştirir.
 */

/**
 * @returns {Promise<import('@anthropic-ai/sdk').default>} Yapılandırılmış Anthropic client
 */
export async function createAnthropicClient() {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}
