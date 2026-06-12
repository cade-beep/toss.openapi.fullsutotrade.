import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://openapi.tossinvest.com';

interface LogEntry {
  endpoint: string;
  method: string;
  url: string;
  reqHeaders: Record<string, string>;
  reqBody: any;
  resStatus: number;
  resStatusText: string;
  resHeaders: Record<string, string>;
  resBody: any;
}

async function collect() {
  const logs: LogEntry[] = [];

  const endpoints: Array<{
    name: string;
    method: string;
    url: string;
    headers: Record<string, string>;
    body: any;
  }> = [
    {
      name: 'OAuth2 Token',
      method: 'POST',
      url: `${BASE_URL}/oauth2/token`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials&client_id=c_dummy_client_id_placeholder&client_secret=s_dummy_secret_placeholder'
    },
    {
      name: 'Account Discovery',
      method: 'GET',
      url: `${BASE_URL}/api/v1/accounts`,
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_token_placeholder'
      },
      body: null
    },
    {
      name: 'Holdings',
      method: 'GET',
      url: `${BASE_URL}/api/v1/holdings`,
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_token_placeholder',
        'X-Tossinvest-Account': '1'
      },
      body: null
    },
    {
      name: 'Buying Power',
      method: 'GET',
      url: `${BASE_URL}/api/v1/buying-power?currency=KRW`,
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_token_placeholder',
        'X-Tossinvest-Account': '1'
      },
      body: null
    },
    {
      name: 'Order Create',
      method: 'POST',
      url: `${BASE_URL}/api/v1/orders`,
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_token_placeholder',
        'X-Tossinvest-Account': '1',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clientOrderId: 'test-order-999',
        symbol: '005930',
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: '1',
        price: '50000'
      })
    },
    {
      name: 'Order Detail',
      method: 'GET',
      url: `${BASE_URL}/api/v1/orders/0d5QIHjmtksbsmM-hBRAgP-ExI8iodGm9fAR5txelPfnMM8XQ_swoJdwL5RpGWMo`,
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_token_placeholder',
        'X-Tossinvest-Account': '1'
      },
      body: null
    }
  ];

  for (const ep of endpoints) {
    console.log(`Executing ${ep.name}...`);
    try {
      const response = await fetch(ep.url, {
        method: ep.method,
        headers: ep.headers,
        body: ep.body
      });

      const responseBody = await response.json().catch(() => null);
      
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((val, key) => {
        responseHeaders[key] = val;
      });

      logs.push({
        endpoint: ep.name,
        method: ep.method,
        url: ep.url,
        reqHeaders: ep.headers,
        reqBody: ep.body && typeof ep.body === 'string' && ep.body.startsWith('{') ? JSON.parse(ep.body) : ep.body,
        resStatus: response.status,
        resStatusText: response.statusText,
        resHeaders: responseHeaders,
        resBody: responseBody
      });
    } catch (err: any) {
      console.error(`Error on ${ep.name}:`, err.message);
      logs.push({
        endpoint: ep.name,
        method: ep.method,
        url: ep.url,
        reqHeaders: ep.headers,
        reqBody: ep.body,
        resStatus: 0,
        resStatusText: 'Network Error',
        resHeaders: {},
        resBody: { error: err.message }
      });
    }
  }

  // Generate Markdown
  let md = `# REAL_API_EVIDENCE_LOG.md\n\n`;
  md += `This log captures live requests and response outputs retrieved directly from the official Toss OpenAPI environment (\`${BASE_URL}\`).\n\n`;
  md += `*   **Log Generation Time**: ${new Date().toISOString()}\n`;
  md += `*   **Credentials Status**: Running with dummy credential signatures to verify server route bindings and error schemas.\n\n---\n\n`;

  for (const entry of logs) {
    md += `## ${entry.endpoint}\n\n`;
    md += `### 1. Request Metadata\n`;
    md += `*   **HTTP Method**: \`${entry.method}\`\n`;
    md += `*   **Target URL**: \`${entry.url}\`\n`;
    md += `*   **Request Headers**:\n`;
    md += `    \`\`\`json\n`;
    md += `    ${JSON.stringify(entry.reqHeaders, null, 2)}\n`;
    md += `    \`\`\`\n`;
    if (entry.reqBody) {
      md += `*   **Request Body**:\n`;
      md += `    \`\`\`json\n`;
      md += `    ${typeof entry.reqBody === 'object' ? JSON.stringify(entry.reqBody, null, 2) : '"' + entry.reqBody + '"'}\n`;
      md += `    \`\`\`\n`;
    }
    md += `\n`;
    md += `### 2. Response Metadata\n`;
    md += `*   **HTTP Status**: \`${entry.resStatus} ${entry.resStatusText}\`\n`;
    md += `*   **Response Headers**:\n`;
    md += `    \`\`\`json\n`;
    md += `    ${JSON.stringify(entry.resHeaders, null, 2)}\n`;
    md += `    \`\`\`\n`;
    md += `*   **Response Payload**:\n`;
    md += `    \`\`\`json\n`;
    md += `    ${JSON.stringify(entry.resBody, null, 2)}\n`;
    md += `    \`\`\`\n`;
    md += `\n---\n\n`;
  }

  const workspaceRoot = process.cwd();
  const targetPath = path.join(workspaceRoot, 'REAL_API_EVIDENCE_LOG.md');
  fs.writeFileSync(targetPath, md, 'utf-8');
  console.log(`Evidence log written to: ${targetPath}`);
}

collect();
