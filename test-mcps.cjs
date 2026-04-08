const { spawn } = require('child_process');

function runTest(name, lspCmd, filePath, line, column) {
  return new Promise((resolve) => {
    console.log(`\n--- Testing ${name} ---`);
    const bridge = '/home/sam/projects/sams-custom-kotlin-mcp/sams-custom-kotlin-mcp';
    const args = ['--workspace', '/home/sam/projects/opencode-fork', '--lsp', ...lspCmd];
    const child = spawn(bridge, args);
    
    let output = '';
    let success = false;

    child.stdout.on('data', (data) => {
      output += data.toString();
      const lines = output.split('\n');
      for (const l of lines) {
        if (l.trim()) {
          try {
            const msg = JSON.parse(l);
            if (msg.id === 2 && msg.result && msg.result.content) {
              console.log(`SUCCESS for ${name} hover result:`);
              console.log(msg.result.content[0].text);
              success = true;
              child.kill();
              resolve();
            } else if (msg.id === 2 && msg.error) {
              console.error(`ERROR for ${name}:`, msg.error);
              child.kill();
              resolve();
            }
          } catch (e) {}
        }
      }
    });

    const initMsg = {
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } }
    };

    const callMsg = {
      jsonrpc: '2.0', id: 2, method: 'tools/call',
      params: { name: 'hover', arguments: { filePath, line, column } }
    };

    child.stdin.write(JSON.stringify(initMsg) + '\n');
    setTimeout(() => {
      child.stdin.write(JSON.stringify(callMsg) + '\n');
    }, 2000);
  });
}

async function main() {
  await runTest(
    'TypeScript',
    ['/home/sam/.npm-global/bin/typescript-language-server', '--', '--stdio'],
    '/home/sam/projects/opencode-fork/packages/app/src/index.ts',
    1, 1
  );

  await runTest(
    'Go',
    ['/home/sam/go/bin/gopls'],
    '/home/sam/projects/opencode-fork/test.go',
    5, 6 // hover over "Hello" func
  );
}

main();