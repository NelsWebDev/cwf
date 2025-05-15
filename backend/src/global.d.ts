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
  }
}
