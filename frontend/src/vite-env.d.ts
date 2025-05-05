/// <reference types="vite/client" />
interface ImportMetaEnv {
  /**
   * @prop URL used for HTTP Server & Socket.io
   */
    readonly VITE_API_URL?: string
    // more env variables...

    /**
     * @prop username autofilled, Used for development purposes only
     */
    readonly VITE_AUTOFILL_USERNAME?: string

    /**
     * @prop password autofilled, Used for development purposes only
     */
    readonly VITE_AUTOFILL_PASSWORD?: string
  }