import { json, Router } from "express";
import { CardManager } from "../CardManager";
import { socketManager } from "../singletons";
import { importDeck } from "../utils/cardImporter";

const routes = Router();

routes.use(json({
  limit: "5mb",
}));


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

routes.post("/decks", async (req, res) => {
  try {
    const newDeck = await CardManager.createDeck(req.body.name, req.body.description);
    res.status(201).json({ deck: newDeck });
  } catch (error) {
    console.log("Error parsing JSON: ", error);
    res.status(400).json({ error: error.message });
    return;
  }
});

routes.get("/decks/:deckId", async (req, res) => {
  try {
    const deck = await CardManager.fetchPopulatedDeck({
      id: req.params.deckId,
    });
    if (!deck) {
      res.status(404).json({ error: "Deck not found" });
      return;
    }
    res.json(deck);
  } catch (error) {
    console.error("Error in /decks/:deckId route:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

routes.post("/decks/import", async (req, res) => {
  if (!req.body || typeof req.body !== "object" || !req.body.deckId) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  try {
    let id = req.body.importedDeckId;
    if (!id || typeof id !== "string" || !id.startsWith("CAH-")) {
      throw new Error("Invalid imported deck ID");
    }
    const deck = await importDeck(id);
    res.json({ deck });
  }
  catch (error) {
    const message =
      error instanceof Error && error.message ? error.message : "Failed to import deck";

    res.status(500).json({ error: message });
  }
});

routes.post("/decks/:deckId", async (req, res) => {
  try {
    const updatedDeck = await CardManager.updateDeck({
      id: req.params.deckId,
      ...req.body,
    });
    if (!updatedDeck) {
      res.status(404).json({ error: "Deck not found" });
      return;
    }
    res.json({ deck: updatedDeck });
  }
  catch (error) {
    console.log("Error parsing JSON: ", error);
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }
});
routes.delete("/decks/:deckId", async (req, res) => {
  try {
    const success = await CardManager.deleteDeck(req.params.deckId);
    if (!success) {
      res.status(404).json({ error: "Deck not found" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    console.error("Error in DELETE /decks/:deckId route:", error);
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

routes.get("/health", async (req, res) => {
  console.log("Health check received");
  res.sendStatus(200);
});

routes.get("/", async (_, res) => {
  res.redirect(process.env.FRONTEND_URL);
});

export default routes;
