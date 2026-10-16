declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV?: string;
    HTTP_PORT?: string;
    DATABASE_URL?: string;
    GAME_PASSWORD?: string;
    JWT_SECRET?: string;
    ADMIN_API_KEY?: string;
    APP_URL?: string;
    FRONTEND_URL?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    GOOGLE_REDIRECT_URI?: string;
    DISCORD_WEBHOOK_URL?: string;
    TEST_DATABASE_URL?: string;
    SHADOW_DATABASE_URL?: string;
  }
}
