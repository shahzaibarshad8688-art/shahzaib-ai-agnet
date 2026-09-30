import { webSearchTool } from './web_search.js';
import { docGeneratorTool } from './doc_generator.js';
import { fileManagerTool } from './file_manager.js';

export const workflowRunnerTool = {
  name: 'workflow_runner',
  label: 'Autonomous Workflow Engine',
  description: 'Execute multi-step automated workflows (e.g. Research-to-Document, File-Batch-Process, Multi-API aggregation).',
  category: 'workflows',
  requiresConfirmation: false,
  dangerLevel: 'safe',
  enabled: true,
  parameters: {
    type: 'object',
    properties: {
      workflowType: {
        type: 'string',
        enum: ['research_and_report', 'workspace_audit', 'custom_chain'],
        description: 'Pre-configured workflow type or custom chain'
      },
      params: {
        type: 'object',
        description: 'Parameters required by the selected workflow'
      }
    },
    required: ['workflowType']
  },

  checkRequiresConfirmation(args) {
    if (args?.workflowType === 'custom_chain' && args?.params?.steps?.some(s => s.requiresConfirmation)) {
      return {
        required: true,
        dangerLevel: 'high',
        reason: 'Automated workflow contains steps requiring human authorization.'
      };
    }
    return { required: false, dangerLevel: 'safe' };
  },

  async execute({ workflowType, params = {} }) {
    const trace = [];

    switch (workflowType) {
      case 'research_and_report': {
        const topic = params.topic || params.query || 'Emerging Technology Trends';
        trace.push(`[Step 1/2] Initiating live web research on: "${topic}"`);
        
        const searchResult = await webSearchTool.execute({
          query: topic,
          maxResults: 4
        });
        trace.push(`[Step 1/2] Acquired ${searchResult.resultsCount} source references.`);

        trace.push(`[Step 2/2] Generating structured documentation file...`);
        let summaryBody = `## Executive Summary\n\nThis research report synthesizes live intelligence retrieved on topic: **${topic}**.\n\n### Discovered Key Findings:\n\n`;

        if (searchResult.results && searchResult.results.length > 0) {
          for (const item of searchResult.results) {
            summaryBody += `#### ${item.title}\n- **Source**: [${item.source}](${item.url})\n- **Intel**: ${item.snippet}\n\n`;
          }
        } else {
          summaryBody += `*No external entries found; synthesized from internal knowledge base.*`;
        }

        summaryBody += `\n### Strategic Recommendations\n- Cross-verify primary findings against workspace directives.\n- Integrate confirmed patterns into ongoing agent automations.\n`;

        const docResult = await docGeneratorTool.execute({
          title: `Research Report: ${topic}`,
          format: 'markdown',
          content: summaryBody,
          includeHeader: true
        });

        trace.push(`[Step 2/2] Document successfully created at: ${docResult.filename}`);

        return {
          status: 'success',
          workflow: 'research_and_report',
          trace,
          topic,
          sourcesConsulted: searchResult.resultsCount,
          documentCreated: docResult.filename,
          preview: docResult.preview
        };
      }

      case 'workspace_audit': {
        trace.push(`[Step 1/2] Scanning workspace filesystem...`);
        const listRes = await fileManagerTool.execute({ action: 'list' });
        
        trace.push(`[Step 2/2] Compiling audit report for ${listRes.totalFiles} files.`);
        const auditText = `## Workspace Audit Report\n\n- Total Assets: ${listRes.totalFiles}\n- Scan Timestamp: ${new Date().toISOString()}\n\n### File Index:\n` +
          listRes.files.map(f => `- **${f.name}** (${f.size} bytes, modified: ${f.modified || 'N/A'})`).join('\n');

        const auditDoc = await docGeneratorTool.execute({
          title: 'Workspace System Audit',
          format: 'markdown',
          content: auditText,
          filename: 'workspace_audit_report.md'
        });

        return {
          status: 'success',
          workflow: 'workspace_audit',
          trace,
          totalFiles: listRes.totalFiles,
          report: auditDoc.filename
        };
      }

      default:
        throw new Error(`Unsupported workflow type: ${workflowType}`);
    }
  }
};

export default workflowRunnerTool;
