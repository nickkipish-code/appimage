/**
 * n8n API Service
 * Handles all interactions with n8n API
 */

import 'dotenv/config';

const N8N_API_URL = process.env.N8N_API_URL || process.env.N8N_URL || 'http://localhost:5678';
const N8N_API_KEY = process.env.N8N_API_KEY;

if (!N8N_API_KEY && !N8N_API_URL.includes('localhost')) {
  console.warn('Warning: N8N_API_KEY is not set. Some operations may require authentication.');
}

class N8nService {
  constructor() {
    this.baseUrl = N8N_API_URL.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = N8N_API_KEY;
  }

  /**
   * Get headers for API requests
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['X-N8N-API-KEY'] = this.apiKey;
    }

    return headers;
  }

  /**
   * Make API request
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        throw new Error(
          `n8n API error (${response.status}): ${errorData.message || errorText}`
        );
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }

      return await response.text();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Request failed: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * List all workflows
   * @param {boolean} active - Filter by active status
   * @returns {Promise<Array>} List of workflows
   */
  async listWorkflows(active = null) {
    try {
      let endpoint = '/api/v1/workflows';
      const params = new URLSearchParams();
      
      if (active !== null && active !== undefined) {
        params.append('active', active.toString());
      }

      if (params.toString()) {
        endpoint += `?${params.toString()}`;
      }

      const workflows = await this.request(endpoint);
      return Array.isArray(workflows) ? workflows : workflows.data || [];
    } catch (error) {
      // If API endpoint doesn't exist, try alternative endpoints
      if (error.message.includes('404') || error.message.includes('Not Found')) {
        try {
          // Try REST API endpoint
          const workflows = await this.request('/rest/workflows');
          return Array.isArray(workflows) ? workflows : workflows.data || [];
        } catch (e) {
          throw new Error(`Failed to list workflows: ${error.message}`);
        }
      }
      throw error;
    }
  }

  /**
   * Get a specific workflow by ID
   * @param {string} workflowId - The workflow ID
   * @returns {Promise<Object>} Workflow details
   */
  async getWorkflow(workflowId) {
    try {
      return await this.request(`/api/v1/workflows/${workflowId}`);
    } catch (error) {
      if (error.message.includes('404') || error.message.includes('Not Found')) {
        try {
          return await this.request(`/rest/workflows/${workflowId}`);
        } catch (e) {
          throw new Error(`Workflow not found: ${workflowId}`);
        }
      }
      throw error;
    }
  }

  /**
   * Execute a workflow
   * @param {string} workflowId - The workflow ID to execute
   * @param {Object} inputData - Input data for the workflow
   * @returns {Promise<Object>} Execution result
   */
  async executeWorkflow(workflowId, inputData = {}) {
    try {
      return await this.request(`/api/v1/workflows/${workflowId}/execute`, {
        method: 'POST',
        body: JSON.stringify({ data: inputData }),
      });
    } catch (error) {
      if (error.message.includes('404') || error.message.includes('Not Found')) {
        try {
          return await this.request(`/rest/workflows/${workflowId}/execute`, {
            method: 'POST',
            body: JSON.stringify({ data: inputData }),
          });
        } catch (e) {
          throw new Error(`Failed to execute workflow: ${error.message}`);
        }
      }
      throw error;
    }
  }

  /**
   * Get execution status
   * @param {string} executionId - The execution ID
   * @returns {Promise<Object>} Execution status
   */
  async getExecutionStatus(executionId) {
    try {
      return await this.request(`/api/v1/executions/${executionId}`);
    } catch (error) {
      if (error.message.includes('404') || error.message.includes('Not Found')) {
        try {
          return await this.request(`/rest/executions/${executionId}`);
        } catch (e) {
          throw new Error(`Execution not found: ${executionId}`);
        }
      }
      throw error;
    }
  }

  /**
   * Trigger a workflow via webhook
   * @param {string} webhookPath - The webhook path or full URL
   * @param {string} method - HTTP method
   * @param {Object} data - Data to send
   * @returns {Promise<Object>} Webhook response
   */
  async triggerWebhook(webhookPath, method = 'POST', data = {}) {
    let url = webhookPath;

    // If it's not a full URL, construct it
    if (!webhookPath.startsWith('http://') && !webhookPath.startsWith('https://')) {
      // Remove leading slash if present
      const path = webhookPath.startsWith('/') ? webhookPath.slice(1) : webhookPath;
      url = `${this.baseUrl}/webhook/${path}`;
    }

    const config = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (method !== 'GET' && Object.keys(data).length > 0) {
      config.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, config);
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      
      return {
        status: response.status,
        statusText: response.statusText,
        text: await response.text(),
      };
    } catch (error) {
      throw new Error(`Webhook trigger failed: ${error.message}`);
    }
  }
}

export const n8nService = new N8nService();
