# Cards With Friends

Cards With Friends is a real-time, browser-based multiplayer card game. Players join a shared game, submit cards to prompts, and take turns judging submissions as the card czar. The game also includes custom deck management.

## Architecture

The application is a pnpm monorepo:

- [`apps/web`](apps/web) contains the React, TypeScript, and Vite client.
- [`apps/server`](apps/server) contains the Express server, GraphQL API, game logic, and deck-management API.
- [`packages/shared`](packages/shared) contains types and rules shared by the client and server.
- PostgreSQL stores decks, cards, and deck-manager accounts. Active game and player state is held in memory by the server.

The server serves the web client and exposes GraphQL over HTTP at `/api/graphql` and GraphQL subscriptions over WebSockets at the same path. The client uses HTTP for queries and mutations, then WebSockets to receive live game updates. Player hands and profile updates are sent only to that player; public game and room events are broadcast to the room.

The current server setup uses one default room. See the [UML class and interaction diagrams](docs/architecture.md) for the main components and a typical update flow.

## Requirements

- Node.js compatible with the installed Vite and TypeScript versions
- pnpm `12.10.1` (the version declared by this repository)
- PostgreSQL

## Local development

1. Install dependencies:

   ```sh
   pnpm install
   ```

2. Create a root `.env` file from the example and set at least `DATABASE_URL` and a non-empty `GAME_PASSWORD`:

   ```sh
   cp .env.example .env
   ```

   `JWT_SECRET` is recommended so game-session tokens remain valid across server restarts. Google OAuth settings are needed only for Google sign-in in deck management; `DISCORD_WEBHOOK_URL` is optional.

3. Generate the Prisma client and apply database migrations:

   ```sh
   pnpm --filter @repo/server exec prisma generate
   pnpm --filter @repo/server exec prisma migrate deploy
   ```

4. (Optional) Import the bundled Cards Against Humanity card data and packs into the database:

   ```sh
   pnpm import:cah
   ```

   To play, the room needs a deck with enough cards selected in the game settings.

5. Start the application:

   ```sh
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000). The server uses port `3000` by default; set `HTTP_PORT` to override it. At least three connected players are required to start a game.

## Useful commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the server and the Vite development client |
| `pnpm build` | Build the web client and server |
| `pnpm start` | Build and start the production server |
| `pnpm test` | Run the server unit tests |
| `pnpm test:coverage` | Run server tests with coverage |
| `pnpm --filter @repo/web lint` | Lint the web client |
| `pnpm import:cah` | Import bundled card packs into the database |
| `pnpm setup:hooks` | Install this clone's Git hooks |

See [CONTRIBUTING.md](CONTRIBUTING.md) for the pre-push test hook.

## PostgreSQL integration tests

The regular `pnpm test` suite uses isolated unit-test doubles and does not connect to PostgreSQL. The optional integration suite exercises Prisma queries against a real PostgreSQL database:

1. Create a dedicated test database that is different from both the application database and Prisma's shadow database. For a local PostgreSQL server, for example:

   ```sh
   createdb cwf_test
   export TEST_DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/cwf_test"
   ```

2. Run the integration suite:

   ```sh
   pnpm test:integration
   ```

The command generates Prisma Client, syncs the current Prisma schema to `TEST_DATABASE_URL` with `prisma db push`, then runs the integration tests. It refuses to run if the test URL points at the same database as `DATABASE_URL` or `SHADOW_DATABASE_URL`. The repository's checked-in migrations are incremental changes to an existing schema, not a complete initial migration history, so `migrate deploy` cannot initialize a blank test database. `db push` prepares the database for these query tests; it does not test the migration history. It runs without `--force-reset` or `--accept-data-loss`.

The suite creates uniquely named test rows and removes only those rows afterward. Do not point it at Prisma's shadow database: Prisma may create and drop objects there while calculating migrations.
