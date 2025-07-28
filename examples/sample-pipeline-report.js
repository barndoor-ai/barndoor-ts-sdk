/**
 * Barndoor demo: pull a Salesforce pipeline report and post it to Notion.
 * 
 * This sample shows how an agent can use **two** MCP server integrations
 * (simultaneously):
 * 
 * • Salesforce (read-only) – fetch the latest pipeline metrics.
 * • Notion (read-write) – update or create a report page.
 * 
 * Run with:
 *     node examples/sample-pipeline-report.js
 * 
 * Environment / prerequisites
 * ---------------------------
 * 1. Ensure both Salesforce and Notion MCP servers exist for your org and that your
 *    user has *connected* them. If not, the helper below will launch the OAuth
 *    flows.
 * 2. Make sure your environment contains:
 *        AUTH_DOMAIN=…
 *        AGENT_CLIENT_ID=…
 *        AGENT_CLIENT_SECRET=…
 *    and export the desired MODE (localdev | development | production) –
 *    for shared DEV simply:
 * 
 *        export MODE=development
 */

import { 
  loginInteractive, 
  ensureServerConnected, 
  makeMcpConnectionParams 
} from '../src/index.js';
import 'dotenv/config';

// Slugs for the two target servers in your registry
const SF_SLUG = 'salesforce';
const NOTION_SLUG = 'notion';

async function main() {
  try {
    // Load auth creds and login
    console.log('🔐 Starting interactive login...');
    const sdk = await loginInteractive();
    console.log('✅ Login successful!');

    // List available servers
    const servers = await sdk.listServers();
    console.log('\n📋 Available MCP servers:');
    for (const server of servers) {
      console.log(`  • ${server.slug.padEnd(15)} status=${server.connection_status}`);
    }

    // Ensure both servers are connected
    console.log(`\n🔗 Ensuring ${SF_SLUG} server is connected...`);
    await ensureServerConnected(sdk, SF_SLUG);
    console.log(`✅ ${SF_SLUG} server is connected!`);

    console.log(`\n🔗 Ensuring ${NOTION_SLUG} server is connected...`);
    await ensureServerConnected(sdk, NOTION_SLUG);
    console.log(`✅ ${NOTION_SLUG} server is connected!`);

    // Get connection params for both servers
    const [sfParams, sfPublicUrl] = await makeMcpConnectionParams(sdk, SF_SLUG);
    const [notionParams, notionPublicUrl] = await makeMcpConnectionParams(sdk, NOTION_SLUG);

    console.log(`\n✅ Salesforce MCP URL: ${sfParams.url}`);
    console.log(`✅ Notion MCP URL: ${notionParams.url}`);

    // Demo: Multi-server MCP integration workflow
    console.log('\n🔄 Multi-server MCP integration workflow:');
    
    console.log('\n1️⃣ Salesforce Pipeline Query:');
    console.log(`
// Query Salesforce for pipeline data
const pipelineQuery = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'query_records',
    arguments: {
      query: \`
        SELECT Id, Name, Amount, StageName, CloseDate, Probability
        FROM Opportunity 
        WHERE CloseDate >= THIS_QUARTER 
        AND StageName IN ('Proposal', 'Negotiation', 'Closed Won')
        ORDER BY Amount DESC
        LIMIT 20
      \`
    }
  }
};

// Send to: ${sfParams.url}
// Headers: ${JSON.stringify(sfParams.headers, null, 2)}
    `);

    console.log('\n2️⃣ Process Pipeline Data:');
    console.log(`
// Process the Salesforce response
const opportunities = pipelineResponse.result.records;
const totalPipeline = opportunities.reduce((sum, opp) => sum + opp.Amount, 0);
const wonDeals = opportunities.filter(opp => opp.StageName === 'Closed Won');
const totalWon = wonDeals.reduce((sum, opp) => sum + opp.Amount, 0);

const reportData = {
  totalOpportunities: opportunities.length,
  totalPipelineValue: totalPipeline,
  closedWonCount: wonDeals.length,
  closedWonValue: totalWon,
  conversionRate: (wonDeals.length / opportunities.length * 100).toFixed(1),
  generatedAt: new Date().toISOString()
};
    `);

    console.log('\n3️⃣ Update Notion Report:');
    console.log(`
// Create or update Notion page with pipeline report
const notionUpdate = {
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/call',
  params: {
    name: 'update_page',
    arguments: {
      pageId: 'your-report-page-id',
      content: \`
# Quarterly Pipeline Report

**Generated:** \${reportData.generatedAt}

## Summary
- **Total Opportunities:** \${reportData.totalOpportunities}
- **Pipeline Value:** $\${reportData.totalPipelineValue.toLocaleString()}
- **Closed Won:** \${reportData.closedWonCount} deals
- **Won Value:** $\${reportData.closedWonValue.toLocaleString()}
- **Conversion Rate:** \${reportData.conversionRate}%

## Top Opportunities
\${opportunities.map(opp => 
  \`- **\${opp.Name}**: $\${opp.Amount.toLocaleString()} (\${opp.StageName})\`
).join('\\n')}
      \`
    }
  }
};

// Send to: ${notionParams.url}
// Headers: ${JSON.stringify(notionParams.headers, null, 2)}
    `);

    console.log('\n💡 In a real implementation, you would:');
    console.log('  1. Make the actual HTTP requests to both MCP endpoints');
    console.log('  2. Process the Salesforce data to generate insights');
    console.log('  3. Format and update the Notion page with the report');
    console.log('  4. Handle errors and retries appropriately');
    console.log('  5. Schedule this to run periodically (daily/weekly)');

    console.log('\n🔧 Both connection parameters are ready for your AI framework:');
    console.log(`  Salesforce: ${sfParams.url}`);
    console.log(`  Notion: ${notionParams.url}`);

    await sdk.close();
    console.log('\n✅ Multi-server pipeline report demo completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the main function
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
