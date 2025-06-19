declare namespace NodeJS {
    interface ProcessEnv {
        /**
         * @prop  The URL of the database
         */
        DATABASE_URL?: string;
        /**
         * @prop port for the http server
         */
        GOOGLE_SERVICE_ACCOUNT_JSON?: string;

        /**
         * @prop The ID of the Google Drive folder where backups will be stored
         */
        GOOGLE_DRIVE_FOLDER_ID?: string;

    }
}
