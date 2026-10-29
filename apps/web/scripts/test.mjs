import { createServer } from 'vite';

const server = await createServer({
  server: { middlewareMode: true, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: 'custom',
});
try {
  const suite = await server.ssrLoadModule('/src/__tests__/acorn.characterization.test.ts');
  suite.runAcornFrontendCharacterizationSuite();
  console.log('Frontend characterization passed: redaction, truthful suggestions, and command mapping.');
} finally {
  await server.close();
}
