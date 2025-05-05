/// <reference types="vite/client" />
interface ImportMetaEnv {
  /**
   * @prop URL used for HTTP Server & Socket.io
   */
    readonly VITE_API_URL?: string
    // more env variables...
  }