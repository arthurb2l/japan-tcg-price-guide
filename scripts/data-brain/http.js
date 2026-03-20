/**
 * HTTP helper - works in both WSL (curl) and GitHub Actions (https)
 */

const https = require('https');
const { execSync } = require('child_process');

// Detect environment
const USE_CURL = process.platform !== 'linux' || process.env.GITHUB_ACTIONS !== 'true';

function fetchJson(url, options = {}) {
  if (USE_CURL && !process.env.GITHUB_ACTIONS) {
    // WSL: use curl (more reliable)
    try {
      let cmd = `curl -s "${url}"`;
      if (options.headers?.Authorization) {
        cmd = `curl -s -H "Authorization: ${options.headers.Authorization}" "${url}"`;
      }
      const result = execSync(cmd, { encoding: 'utf8', timeout: 15000 });
      return Promise.resolve(JSON.parse(result));
    } catch (e) {
      return Promise.reject(new Error(`Fetch failed: ${e.message}`));
    }
  }
  
  // GitHub Actions: use https module
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 15000, headers: options.headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON'));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

module.exports = { fetchJson };
