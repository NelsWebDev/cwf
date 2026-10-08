/// <reference types="vite/client" />
interface ImportMetaEnv {

    /**
     * @prop username autofilled, Used for development purposes only
     */
    readonly VITE_AUTOFILL_USERNAME?: string

    /**
     * @prop password autofilled, Used for development purposes only
     */
    readonly VITE_AUTOFILL_PASSWORD?: string

    readonly VITE_API_URL?: string

    /**
     * @prop GraphQL endpoint (http/https). Defaults to /api/graphql on the current origin
     */
    readonly VITE_GRAPHQL_URL?: string
  }