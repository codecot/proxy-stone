import { FastifyInstance } from "fastify";
import { join } from "path";
import { existsSync } from "fs";

export async function uiIntegrationRoutes(fastify: FastifyInstance) {
  // Check if UI build exists
  const uiBuildPath = join(process.cwd(), '../ui/dist');
  const hasUIBuild = existsSync(uiBuildPath);

  if (hasUIBuild) {
    // Serve built UI files if available
    await fastify.register(import('@fastify/static'), {
      root: uiBuildPath,
      prefix: '/ui/',
      decorateReply: false,
    });

    // UI entry point
    fastify.get('/ui', {
      schema: {
        tags: ["general"],
        summary: "Proxy Stone Web UI",
        description: "React-based web interface for managing the proxy service",
        responses: {
          200: {
            description: "Web UI application",
            content: {
              "text/html": {
                schema: { type: "string" },
              },
            },
          },
        },
      },
    }, async (request, reply) => {
      reply.type('text/html');
      return reply.sendFile('index.html');
    });

    // Catch-all for SPA routing
    fastify.get('/ui/*', async (request, reply) => {
      reply.type('text/html');
      return reply.sendFile('index.html');
    });

    fastify.log.info('UI integration enabled - serving from /ui');
  } else {
    // UI placeholder/redirect when no build exists
    fastify.get('/ui', {
      schema: {
        tags: ["general"],
        summary: "UI placeholder",
        description: "Placeholder when UI is not built or deployed separately",
        responses: {
          200: {
            description: "UI placeholder page",
            content: {
              "text/html": {
                schema: { type: "string" },
              },
            },
          },
        },
      },
    }, async (request, reply) => {
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proxy Stone UI - Development Mode</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }
    .container {
      max-width: 600px;
      padding: 3rem;
      text-align: center;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    h1 {
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }
    .status {
      background: rgba(251, 191, 36, 0.2);
      border: 1px solid #fbbf24;
      color: #fbbf24;
      padding: 1rem;
      border-radius: 12px;
      margin: 2rem 0;
    }
    .options {
      margin: 2rem 0;
    }
    .option {
      background: rgba(255, 255, 255, 0.1);
      padding: 1.5rem;
      margin: 1rem 0;
      border-radius: 12px;
      border-left: 4px solid #34d399;
    }
    .option h3 {
      margin: 0 0 0.5rem 0;
      color: #34d399;
    }
    .code {
      background: rgba(0, 0, 0, 0.3);
      padding: 1rem;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      margin: 1rem 0;
    }
    a {
      color: #60a5fa;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎛️ Web UI</h1>
    
    <div class="status">
      <strong>⚡ Development Mode</strong><br>
      UI is running separately or not yet built
    </div>

    <div class="options">
      <div class="option">
        <h3>🚀 Option 1: Standalone Development</h3>
        <p>Run the UI separately for development:</p>
        <div class="code">
          cd ../ui<br>
          npm run dev
        </div>
        <p>Then visit: <strong>http://localhost:3000</strong></p>
      </div>

      <div class="option">
        <h3>📦 Option 2: Integrated Deployment</h3>
        <p>Build and serve UI from backend:</p>
        <div class="code">
          cd ../ui<br>
          npm run build
        </div>
        <p>Then restart backend to serve UI at <strong>/ui</strong></p>
      </div>

      <div class="option">
        <h3>🌐 Option 3: Production Deployment</h3>
        <p>Deploy UI to static hosting (Vercel/Netlify) and configure CORS for API access.</p>
      </div>
    </div>

    <p style="margin-top: 2rem;">
      <a href="/">← Back to Home</a> • 
      <a href="/docs">📚 API Docs</a>
    </p>
  </div>
</body>
</html>
      `;

      reply.header('Content-Type', 'text/html');
      return html;
    });

    fastify.log.info('UI integration disabled - showing development placeholder');
  }

  // API endpoint to check UI availability
  fastify.get('/api/ui/status', {
    schema: {
      tags: ["general"],
      summary: "Check UI deployment status",
      description: "Returns information about UI availability and deployment mode",
      responses: {
        200: {
          description: "UI status information",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  available: { type: "boolean" },
                  mode: { type: "string" },
                  path: { type: "string" },
                  buildExists: { type: "boolean" },
                },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    return {
      available: hasUIBuild,
      mode: hasUIBuild ? "integrated" : "standalone",
      path: hasUIBuild ? "/ui" : "http://localhost:3000 (if running)",
      buildExists: hasUIBuild,
      buildPath: uiBuildPath,
      recommendations: {
        development: "Run UI separately with npm run dev for hot reload",
        production: "Either build and integrate, or deploy to static hosting",
      },
    };
  });
}