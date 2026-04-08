const { spawn } = require('child_process');

const bridge = '/home/sam/projects/sams-custom-kotlin-mcp/sams-custom-kotlin-mcp';
const args = ['--workspace', '/home/sam/projects/opencode-fork/packages/util', '--lsp', '/home/sam/.npm-global/bin/typescript-language-server', '--', '--stdio'];
console.log("Starting MCP Bridge with args:", args.join(' '));
const child = spawn(bridge, args);

let output = '';

child.stdout.on('data', (data) => {
  output += data.toString();
  const lines = output.split('\n');
  for (const l of lines) {
    if (l.trim()) {
      try {
        const msg = JSON.parse(l);
        if (msg.id === 2) {
          console.log("\n--- Hover Result ---");
          if (msg.result && msg.result.content) {
            console.log(msg.result.content[0].text);
          } else {
            console.log(JSON.stringify(msg, null, 2));
          }
          child.kill();
          process.exit(0);
        }
      } catch (e) {}
    }
  }
});

child.stderr.on('data', (data) => {
  console.error("BRIDGE LOG:", data.toString().trim());
});

const initMsg = {
  jsonrpc: '2.0', id: 1, method: 'initialize',
  params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } }
};

const listToolsMsg = {
  jsonrpc: "2.0",
  id: 1,
  method: "tools/list",
  params: {}
};

const callMsg = {
  jsonrpc: "2.0",
  id: 2,
  method: "tools/call",
  params: {
    name: "hover",
    arguments: {
      filePath: "/home/sam/projects/opencode-fork/packages/util/src/array.ts",
      line: 1,
      column: 18
    }
  }
};

console.log("Waiting 10 seconds for typescript-language-server to initialize the workspace...");
setTimeout(() => {
  console.log("Requesting tools list...");
  child.stdin.write(JSON.stringify(listToolsMsg) + '\n');
}, 5000);

setTimeout(() => {
  console.log("Sending hover request for array.ts...");
  child.stdin.write(JSON.stringify(callMsg) + '\n');
}, 10000);

setTimeout(() => {
  console.log("Timeout reached.");
  child.kill();
  process.exit(1);
}, 20000);
