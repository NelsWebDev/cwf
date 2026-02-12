import bodyParser from "body-parser";
import { Router } from "express";
import { CardManager } from "../CardManager";
import { socketManager } from "../singletons";
import { importDeck } from "../utils/cardImporter";

const routes = Router();
routes.use(bodyParser.json());

routes.use((_, res, next) => {
  res.header("request-id", crypto.randomUUID());
  next();
});


routes.post("/login", async ({ body }, res) => {
  try {
    if (!body || typeof body !== "object") {
      res.sendStatus(400);
      return;
    }

    // if logging in with id
    if ("id" in body) {
      const user = socketManager.gameUsers.get(body.id)?.toJSON();
      if (!user) {
        res.status(400).json({
          success: false,
          error: "Session expired. Please login again",
        });
        return;
      }
      res.json(user);
      return;
    }

    const { username, password } = body;
    if (!username) {
      res.status(400).json({ success: false, error: "Username is required" });
      return;
    }
    if (!password) {
      res.status(400).json({ success: false, error: "Password is required" });
      return;
    }
    if (password !== process.env.GAME_PASSWORD) {
      res.status(400).json({ success: false, error: "invalid" });
      return;
    }

    if (!socketManager.usernameAvailable(username)) {
      res
        .status(400)
        .json({ success: false, error: "Username already in use" });
      return;
    }
    const user = socketManager.registerUser(username).toJSON();
    res.json({ success: true, user });
  } catch (error) {
    console.error("Error in /login route:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

routes.get("/decks", async (req, res) => {
  try {
    const decks = await CardManager.fetchAllDecks();
    res.json(decks);
  } catch (error) {
    console.error("Error in /decks route:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

routes.post("/decks/import", async (req, res) => {
  if (!req.body || typeof req.body !== "object" || !req.body.deckId) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  try {
    const deck = await importDeck(req.body.deckId);
    res.json({ deck });
  } catch (error) {
    const message =
      error instanceof Error && error.message === "Deck already imported"
        ? "Deck already imported"
        : "Failed to import deck";

    res.status(500).json({ error: message });
  }
});


routes.get("/", async (_, res) => {
  res.redirect(process.env.FRONTEND_URL);
});

export default routes;
