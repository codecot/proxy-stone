import { FastifyInstance } from "fastify";

export async function docsIndexRoutes(fastify: FastifyInstance) {
  // Documentation index page
  fastify.get("/docs", {
    schema: {
      tags: ["documentation"],
      summary: "Documentation index page",
      description: "Landing page with links to both internal and external API documentation",
      responses: {
        200: {
          description: "HTML documentation index",
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
  <title>API Documentation - Proxy Stone</title>
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
    }
    .container {
      max-width: 800px;
      padding: 2rem;
    }
    .header {
      text-align: center;
      color: white;
      margin-bottom: 3rem;
    }
    .header h1 {
      font-size: 3rem;
      margin: 0;
      text-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    .header p {
      font-size: 1.2rem;
      opacity: 0.9;
      margin: 1rem 0;
    }
    .docs-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
      margin-top: 2rem;
    }
    .doc-card {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      box-shadow: 0 8px 32px rgba(0,0,0,0.1);
      transition: transform 0.3s ease, box-shadow 0.3s ease;
      text-decoration: none;
      color: inherit;
    }
    .doc-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 48px rgba(0,0,0,0.15);
    }
    .doc-card h2 {
      margin: 0 0 1rem 0;
      color: #1f2937;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .doc-card p {
      color: #6b7280;
      margin: 0 0 1.5rem 0;
      line-height: 1.6;
    }
    .doc-card .features {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .doc-card .features li {
      color: #059669;
      margin: 0.5rem 0;
      padding-left: 1.5rem;
      position: relative;
    }
    .doc-card .features li:before {
      content: "✓";
      position: absolute;
      left: 0;
      font-weight: bold;
    }
    .internal-card {
      border-left: 4px solid #3b82f6;
    }
    .external-card {
      border-left: 4px solid #10b981;
    }
    .status {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
      font-size: 0.875rem;
      font-weight: 500;
      margin-top: 1rem;
    }
    .status.ready {
      background: #d1fae5;
      color: #065f46;
    }
    .status.dynamic {
      background: #dbeafe;
      color: #1e40af;
    }
    @media (max-width: 768px) {
      .docs-grid {
        grid-template-columns: 1fr;
      }
      .header h1 {
        font-size: 2rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📚 API Documentation</h1>
      <p>Choose the type of API documentation you need</p>
      <div style="background: rgba(255,255,255,0.1); padding: 1rem; border-radius: 8px; margin-top: 1rem;">
        <small>🔗 <strong>Quick Links:</strong> 
          <a href="/docs/internal" style="color: #60a5fa; margin: 0 0.5rem;">Internal API</a> | 
          <a href="/docs/dynamic" style="color: #34d399; margin: 0 0.5rem;">External APIs</a> |
          <a href="/docs/dynamic/stats" style="color: #fbbf24; margin: 0 0.5rem;">API Stats</a>
        </small>
      </div>
    </div>

    <div class="docs-grid">
      <a href="/docs/internal" class="doc-card internal-card">
        <h2>🔧 Internal Service API</h2>
        <p>Documentation for the proxy service management endpoints - health checks, metrics, cache control, authentication, and cluster management.</p>
        <ul class="features">
          <li>Health & monitoring endpoints</li>
          <li>Cache management operations</li>
          <li>Authentication & authorization</li>
          <li>Cluster node management</li>
          <li>Request analytics & logging</li>
        </ul>
        <span class="status ready">Static Documentation</span>
      </a>

      <a href="/docs/dynamic" class="doc-card external-card">
        <h2>🌐 External APIs</h2>
        <p>Auto-generated documentation for external APIs that are accessed through the proxy service, based on real usage patterns.</p>
        <ul class="features">
          <li>Auto-discovered endpoints</li>
          <li>Real usage statistics</li>
          <li>Performance metrics</li>
          <li>Sample requests/responses</li>
          <li>Cache hit rate analysis</li>
        </ul>
        <span class="status dynamic">Dynamic Documentation</span>
      </a>
    </div>

    <div style="text-align: center; margin-top: 3rem; color: white; opacity: 0.8;">
      <p>💡 <strong>Tip:</strong> External API documentation becomes more comprehensive as you use the proxy service</p>
      <div id="stats-summary" style="margin-top: 1rem; font-size: 0.9rem;">
        <span>Loading documentation statistics...</span>
      </div>
    </div>
  </div>

  <script>
    // Add some interactivity and load stats
    document.addEventListener('DOMContentLoaded', function() {
      const cards = document.querySelectorAll('.doc-card');
      cards.forEach(card => {
        card.addEventListener('mouseenter', function() {
          this.style.borderLeftWidth = '6px';
        });
        card.addEventListener('mouseleave', function() {
          this.style.borderLeftWidth = '4px';
        });
      });

      // Load documentation statistics
      Promise.all([
        fetch('/docs/internal/json').then(res => res.json()).catch(() => null),
        fetch('/docs/dynamic/stats').then(res => res.json()).catch(() => null)
      ]).then(([internalSpec, dynamicStats]) => {
        const statsEl = document.getElementById('stats-summary');
        
        const internalEndpoints = internalSpec ? Object.keys(internalSpec.paths || {}).length : 0;
        const externalEndpoints = dynamicStats ? dynamicStats.uniqueEndpoints || 0 : 0;
        const totalRequests = dynamicStats ? dynamicStats.totalRequests || 0 : 0;

        statsEl.innerHTML = \`
          📊 <strong>Documentation Overview:</strong> 
          \${internalEndpoints} internal endpoints | 
          \${externalEndpoints} discovered external APIs | 
          \${totalRequests} proxy requests analyzed
        \`;
      }).catch(() => {
        document.getElementById('stats-summary').innerHTML = 
          '📊 Documentation statistics temporarily unavailable';
      });
    });
  </script>
</body>
</html>
    `;

    reply.header('Content-Type', 'text/html');
    return html;
  });
}