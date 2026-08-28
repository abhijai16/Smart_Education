const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // /api/* always belongs to the node backend (port 8000). The Centralized_Database
  // server lives on 8001 and exposes different routes — the previous setup read the
  // port from REACT_APP_NODE_PORT, but that variable is also used by the React app
  // to point at the central DB (see serverDiscovery.js), which sent /api/node_info/
  // to the wrong server and made discovery hang.
  const nodePort = '8000';
  app.use(
    '/api',
    createProxyMiddleware({
      target: `http://localhost:${nodePort}`,
      changeOrigin: true,
    })
  );
};
