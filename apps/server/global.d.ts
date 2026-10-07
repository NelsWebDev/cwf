declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * @prop  The URL of the database
     */
    DATABASE_URL?: string;
    /**
     * @prop port for the http server
     */
    PORT?: string;
    /**
     * @prop Password for the game
     */
    GAME_PASSWORD?: string;

    /**
     * @prop The URL for the frontend of the application
     */
    FRONTEND_URL?: string;

    /**
     * @prop The URL for the backend of the application
     */
    BACKEND_URL?: string;

  }
}
