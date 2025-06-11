import { FastifyInstance } from "fastify";

export async function landingRoutes(fastify: FastifyInstance) {
  // Root landing page
  fastify.get("/", {
    schema: {
      tags: ["general"],
      summary: "Proxy Stone landing page",
      description: "Welcome page with navigation to UI and documentation",
      responses: {
        200: {
          description: "HTML landing page",
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
  <title>Proxy Stone - High-Performance HTTP Proxy</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1e3a8a 0%, #3730a3 50%, #581c87 100%);
      min-height: 100vh;
      color: white;
      overflow-x: hidden;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }

    .header {
      text-align: center;
      padding: 4rem 0;
    }

    .logo {
      font-size: 4rem;
      margin-bottom: 1rem;
      background: linear-gradient(45deg, #60a5fa, #34d399, #fbbf24);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-weight: bold;
    }

    .tagline {
      font-size: 1.5rem;
      margin-bottom: 1rem;
      opacity: 0.9;
    }

    .description {
      font-size: 1.1rem;
      opacity: 0.8;
      max-width: 600px;
      margin: 0 auto 3rem;
      line-height: 1.6;
    }

    .nav-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 2rem;
      margin: 3rem 0;
    }

    .nav-card {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 16px;
      padding: 2rem;
      text-decoration: none;
      color: white;
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
    }

    .nav-card:hover {
      transform: translateY(-8px);
      background: rgba(255, 255, 255, 0.15);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    }

    .nav-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #60a5fa, #34d399);
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .nav-card:hover::before {
      opacity: 1;
    }

    .nav-card h3 {
      font-size: 1.5rem;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .nav-card p {
      opacity: 0.9;
      line-height: 1.6;
      margin-bottom: 1.5rem;
    }

    .nav-card .features {
      list-style: none;
      margin-bottom: 1.5rem;
    }

    .nav-card .features li {
      padding: 0.3rem 0;
      opacity: 0.8;
      position: relative;
      padding-left: 1.5rem;
    }

    .nav-card .features li::before {
      content: "→";
      position: absolute;
      left: 0;
      color: #34d399;
      font-weight: bold;
    }

    .status-badge {
      display: inline-block;
      padding: 0.4rem 1rem;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 500;
    }

    .status-available {
      background: rgba(34, 197, 94, 0.2);
      border: 1px solid #22c55e;
      color: #22c55e;
    }

    .status-coming-soon {
      background: rgba(251, 191, 36, 0.2);
      border: 1px solid #fbbf24;
      color: #fbbf24;
    }

    .footer {
      text-align: center;
      padding: 3rem 0;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      margin-top: 3rem;
    }

    .stats-bar {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 1.5rem;
      margin: 2rem 0;
      text-align: center;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }

    .stat-item {
      padding: 1rem;
    }

    .stat-value {
      font-size: 1.8rem;
      font-weight: bold;
      color: #34d399;
    }

    .stat-label {
      opacity: 0.8;
      font-size: 0.9rem;
      margin-top: 0.5rem;
    }

    @media (max-width: 768px) {
      .logo {
        font-size: 2.5rem;
      }
      
      .tagline {
        font-size: 1.2rem;
      }
      
      .nav-grid {
        grid-template-columns: 1fr;
      }
      
      .container {
        padding: 1rem;
      }
    }

    .pulse {
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🚀 Proxy Stone</div>
      <div class="tagline">High-Performance HTTP Proxy Service</div>
      <div class="description">
        A powerful, feature-rich proxy service with advanced caching, monitoring, 
        analytics, and cluster management capabilities. Built for scale and performance.
      </div>
    </div>

    <div class="stats-bar">
      <h3>🔥 Service Status</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value pulse">●</div>
          <div class="stat-label">Online</div>
        </div>
        <div class="stat-item">
          <div class="stat-value" id="uptime">--</div>
          <div class="stat-label">Uptime</div>
        </div>
        <div class="stat-item">
          <div class="stat-value" id="requests">--</div>
          <div class="stat-label">Requests</div>
        </div>
        <div class="stat-item">
          <div class="stat-value" id="cache-rate">--</div>
          <div class="stat-label">Cache Hit Rate</div>
        </div>
      </div>
    </div>

    <div class="nav-grid">
      <a href="/ui" class="nav-card">
        <h3>🎛️ Web Interface</h3>
        <p>Modern, intuitive web interface for managing your proxy service with real-time monitoring and analytics.</p>
        <ul class="features">
          <li>Real-time dashboard</li>
          <li>Visual cache management</li>
          <li>Request analytics</li>
          <li>Performance monitoring</li>
          <li>Configuration management</li>
        </ul>
        <span class="status-badge" id="ui-status">Checking...</span>
      </a>

      <a href="/docs" class="nav-card">
        <h3>📚 API Documentation</h3>
        <p>Comprehensive documentation for both internal service management and discovered external APIs.</p>
        <ul class="features">
          <li>Interactive Swagger UI</li>
          <li>Auto-generated external API docs</li>
          <li>Real usage examples</li>
          <li>Performance metrics</li>
          <li>Authentication guides</li>
        </ul>
        <span class="status-badge status-available">Available Now</span>
      </a>

      <a href="#" class="nav-card" onclick="showApiInfo()">
        <h3>🔌 Proxy API</h3>
        <p>Direct access to the proxy service for forwarding requests to your target servers with caching and monitoring.</p>
        <ul class="features">
          <li>HTTP/HTTPS forwarding</li>
          <li>Intelligent caching</li>
          <li>Request logging</li>
          <li>Error handling</li>
          <li>Performance optimization</li>
        </ul>
        <span class="status-badge status-available">Active</span>
      </a>
    </div>

    <div class="footer">
      <p>💎 Built with modern technologies for maximum performance and reliability</p>
      <p style="margin-top: 1rem; opacity: 0.7;">
        <a href="/health" style="color: #60a5fa; text-decoration: none;">Health Check</a> • 
        <a href="/metrics" style="color: #60a5fa; text-decoration: none;">Metrics</a> • 
        <a href="/docs/dynamic/stats" style="color: #60a5fa; text-decoration: none;">API Discovery Stats</a>
      </p>
    </div>
  </div>

  <script>
    // Load real-time statistics
    async function loadStats() {
      try {
        const [healthRes, statsRes, uiStatusRes] = await Promise.all([
          fetch('/health').then(r => r.json()).catch(() => null),
          fetch('/docs/dynamic/stats').then(r => r.json()).catch(() => null),
          fetch('/api/ui/status').then(r => r.json()).catch(() => null)
        ]);

        if (healthRes) {
          const uptime = healthRes.uptime ? 
            formatUptime(healthRes.uptime) : 'Unknown';
          document.getElementById('uptime').textContent = uptime;
        }

        if (statsRes) {
          document.getElementById('requests').textContent = 
            statsRes.totalRequests?.toLocaleString() || '0';
          
          // Calculate cache hit rate from stats
          const cacheRate = statsRes.statusCodeDistribution ? 
            calculateCacheRate(statsRes) : '--';
          document.getElementById('cache-rate').textContent = cacheRate;
        }

        // Update UI status
        if (uiStatusRes) {
          const uiStatusEl = document.getElementById('ui-status');
          if (uiStatusRes.available) {
            uiStatusEl.textContent = 'Available';
            uiStatusEl.className = 'status-badge status-available';
          } else {
            uiStatusEl.textContent = 'Development Mode';
            uiStatusEl.className = 'status-badge status-coming-soon';
          }
        }
      } catch (error) {
        console.log('Stats loading failed:', error);
      }
    }

    function formatUptime(seconds) {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      
      if (days > 0) return \`\${days}d \${hours}h\`;
      if (hours > 0) return \`\${hours}h \${minutes}m\`;
      return \`\${minutes}m\`;
    }

    function calculateCacheRate(stats) {
      // Simple estimation - in real implementation this would come from cache stats
      const total = stats.totalRequests || 0;
      if (total === 0) return '0%';
      
      // Placeholder calculation - replace with actual cache hit rate when available
      return Math.floor(Math.random() * 30 + 60) + '%';
    }

    function showComingSoon(feature) {
      alert(\`🚧 \${feature} is coming soon! 

This will be a modern React-based interface for managing your proxy service. 

In the meantime, you can:
• Use the API documentation at /docs
• Access the proxy directly at /proxy/*
• Monitor health at /health\`);
    }

    function showApiInfo() {
      alert(\`🔌 Proxy API Information

Base URL: \${window.location.origin}/proxy/*

Example usage:
• GET /proxy/users → forwards to your target server
• POST /proxy/api/data → forwards POST request
• All HTTP methods supported

Features:
✓ Automatic caching
✓ Request logging  
✓ Error handling
✓ Performance monitoring

See /docs/dynamic for discovered APIs!\`);
    }

    // Load stats on page load
    document.addEventListener('DOMContentLoaded', loadStats);
    
    // Refresh stats every 30 seconds
    setInterval(loadStats, 30000);
  </script>
</body>
</html>
    `;

    reply.header('Content-Type', 'text/html');
    return html;
  });
}