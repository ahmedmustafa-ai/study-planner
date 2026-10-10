/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GoogleTokenClient {
  requestAccessToken(o?: { prompt?: string }): void;
}

declare namespace google {
  namespace accounts {
    namespace oauth2 {
      function initTokenClient(c: {
        client_id: string;
        scope: string;
        callback: (r: GoogleTokenResponse) => void;
        error_callback?: (e: { type?: string; message?: string }) => void;
      }): GoogleTokenClient;
      function revoke(token: string, done?: () => void): void;
    }
  }
}
