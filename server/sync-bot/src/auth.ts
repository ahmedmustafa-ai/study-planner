import http from 'node:http';
import { URL } from 'node:url';
import { OAuth2Client } from 'google-auth-library';
import { config, CLASSROOM_SCOPES } from './config.js';
import { saveTokens, loadTokens } from './storage.js';

export function createOAuth2Client() {
  if (!config.googleClientId || !config.googleClientSecret) {
    throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env');
  }

  const redirectUri = `http://localhost:${config.redirectPort}/oauth2callback`;
  return new OAuth2Client(
    config.googleClientId,
    config.googleClientSecret,
    redirectUri
  );
}

/**
 * Returns an authenticated OAuth2 client with automatically refreshed access token.
 */
export async function getAuthenticatedClient() {
  const oauth2Client = createOAuth2Client();
  const tokens = loadTokens();

  if (!tokens || !tokens.refresh_token) {
    throw new Error('Google Classroom not authenticated. Run "npm run auth" first.');
  }

  oauth2Client.setCredentials(tokens as any);

  // Automatically update tokens.json if google library triggers a token refresh
  oauth2Client.on('tokens', (newTokens) => {
    const merged = { ...tokens, ...newTokens };
    saveTokens(merged);
  });

  return oauth2Client;
}

/**
 * Interactive one-time OAuth authorization helper.
 * Starts a transient local HTTP server to receive the authorization code.
 */
export async function performInteractiveAuth(): Promise<void> {
  const oauth2Client = createOAuth2Client();

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Generates a refresh token
    prompt: 'consent',     // Forces consent prompt so refresh token is guaranteed
    scope: CLASSROOM_SCOPES,
  });

  console.log('\n===============================================================');
  console.log('🔗 GOOGLE CLASSROOM ONE-TIME AUTHORIZATION');
  console.log('===============================================================');
  console.log('\nPlease open this link in your browser to sign in:');
  console.log(`\n${authUrl}\n`);
  console.log('Waiting for approval via redirect to http://localhost:' + config.redirectPort + ' ...\n');

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        if (!req.url?.startsWith('/oauth2callback')) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
          return;
        }

        const reqUrl = new URL(req.url, `http://localhost:${config.redirectPort}`);
        const code = reqUrl.searchParams.get('code');
        const error = reqUrl.searchParams.get('error');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`<h2>Authorization Error</h2><p>${error}</p>`);
          server.close();
          return reject(new Error(`Google authorization error: ${error}`));
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h2>No code received</h2>');
          server.close();
          return reject(new Error('No authorization code received in callback.'));
        }

        const { tokens } = await oauth2Client.getToken(code);
        saveTokens(tokens);

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <div style="font-family: system-ui, sans-serif; max-width: 500px; margin: 40px auto; padding: 24px; border-radius: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534;">
            <h2 style="margin-top: 0;">🎉 Authorization Successful!</h2>
            <p>Your Google Classroom offline refresh token has been securely saved.</p>
            <p>You can close this tab and return to your terminal.</p>
          </div>
        `);

        console.log('✅ Tokens received and saved successfully!');
        server.close();
        resolve();
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Failed to exchange tokens.');
        server.close();
        reject(err);
      }
    });

    server.listen(config.redirectPort);
  });
}

// If executed directly with `tsx src/auth.ts` or `npm run auth`
performInteractiveAuth()
  .then(() => {
    console.log('Authentication complete. You can now run "npm run bot".');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Authentication failed:', err.message);
    process.exit(1);
  });
