import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from sync-bot folder or workspace root
const localEnv = path.resolve(__dirname, '../.env');
const rootEnv = path.resolve(__dirname, '../../../.env');
let activeEnv = localEnv;

if (dotenv.config({ path: localEnv }).error) {
  dotenv.config({ path: rootEnv });
  activeEnv = rootEnv;
}

export const config = {
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleRefreshToken: process.env.GOOGLE_REFRESH_TOKEN || '',
  redirectPort: Number(process.env.OAUTH_REDIRECT_PORT || '3000'),
  syncIntervalMinutes: Number(process.env.SYNC_INTERVAL_MINUTES || '15'),
  tokensPath: path.resolve(__dirname, '../tokens.json'),
  statePath: path.resolve(__dirname, '../sync-state.json'),
  envPath: activeEnv,
};

export const CLASSROOM_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
  'https://www.googleapis.com/auth/classroom.announcements.readonly',
];
