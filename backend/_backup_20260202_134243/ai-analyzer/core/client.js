/**
 * Claude Client - Anthropic API Client Singleton
 */

import Anthropic from '@anthropic-ai/sdk';
import { aiConfig } from '../../../config/ai.config.js';
import { AIApiError } from '../../../lib/errors.js';
import logger from '../../../utils/logger.js';

class ClaudeClient {
  constructor() {
    this._client = null;
  }

  /**
   * Anthropic client instance al
   * @returns {Anthropic}
   */
  getClient() {
    if (!this._client) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new AIApiError('Claude', 'ANTHROPIC_API_KEY env variable is required');
      }

      this._client = new Anthropic({ apiKey });

      logger.info('Claude client initialized', {
        module: 'ai-analyzer',
        action: 'client.init',
      });
    }
    return this._client;
  }

  /**
   * Claude ile mesaj gönder
   * @param {Array} messages - Message array
   * @param {Object} options - Options
   * @returns {Promise<Object>}
   */
  async sendMessage(messages, options = {}) {
    const startTime = Date.now();
    const model = options.model || aiConfig.claude.defaultModel;
    const maxTokens = options.maxTokens || aiConfig.claude.maxTokens;

    try {
      const response = await this.getClient().messages.create({
        model,
        max_tokens: maxTokens,
        messages,
      });

      const duration = Date.now() - startTime;

      logger.info('Claude API call successful', {
        module: 'ai-analyzer',
        action: 'client.sendMessage',
        model,
        duration: `${duration}ms`,
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Claude API call failed', {
        module: 'ai-analyzer',
        action: 'client.sendMessage',
        model,
        duration: `${duration}ms`,
        error: error.message,
      });

      throw new AIApiError('Claude', error.message, { model, duration });
    }
  }

  /**
   * Tek bir text mesajı gönder
   * @param {string} prompt - User prompt
   * @param {Object} options - Options
   * @returns {Promise<string>}
   */
  async analyze(prompt, options = {}) {
    const response = await this.sendMessage(
      [
        {
          role: 'user',
          content: prompt,
        },
      ],
      options
    );

    return response.content[0]?.text || '';
  }

  /**
   * Görsel ile analiz yap
   * @param {string} base64Image - Base64 encoded image
   * @param {string} mimeType - Image MIME type
   * @param {string} prompt - Analysis prompt
   * @param {Object} options - Options
   * @returns {Promise<string>}
   */
  async analyzeWithImage(base64Image, mimeType, prompt, options = {}) {
    const response = await this.sendMessage(
      [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
      options
    );

    return response.content[0]?.text || '';
  }

  /**
   * PDF döküman ile analiz yap
   * @param {string} base64Pdf - Base64 encoded PDF
   * @param {string} prompt - Analysis prompt
   * @param {Object} options - Options
   * @returns {Promise<string>}
   */
  async analyzeWithDocument(base64Pdf, prompt, options = {}) {
    const response = await this.sendMessage(
      [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64Pdf,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
      { ...options, maxTokens: options.maxTokens || 8192 }
    );

    return response.content[0]?.text || '';
  }
}

// Singleton export
const claudeClient = new ClaudeClient();
export default claudeClient;
export { claudeClient, ClaudeClient };
