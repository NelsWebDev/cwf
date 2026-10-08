export const typeDefs = /* GraphQL */ `
  scalar DateTime

  enum RoundStatus {
    WAITING_FOR_PLAYERS
    SHOWING_WINNER
    SELECTING_WINNER
  }

  enum CardState {
    IN_USE
    PLAYED_PREVIOUSLY
    SKIPPED
    AVAILABLE
  }

  type User {
    id: ID!
    username: String!
    isActive: Boolean!
    points: Int!
    isCardCzar: Boolean!
    discordId: String
    newHandsRemaining: Int!
  }

  type CardDeck {
    id: ID!
    name: String!
    description: String
    numberOfWhiteCards: Int!
    numberOfBlackCards: Int!
    importedDeckId: String
    cahOfficial: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Rules {
    pointsToWin: Int!
    pointsToWinBy: Int!
    canUndo: Boolean!
    numberOfCustomCards: Int!
    newHandsPerGame: Int!
    maxNumberOfPlayers: Int!
    allowMultipleAnswerBlackCards: Boolean!
    announceToDiscord: Boolean!
  }

  input RulesInput {
    pointsToWin: Int
    pointsToWinBy: Int
    canUndo: Boolean
    numberOfCustomCards: Int
    newHandsPerGame: Int
    maxNumberOfPlayers: Int
    allowMultipleAnswerBlackCards: Boolean
    announceToDiscord: Boolean
  }

  type BlackCard {
    id: ID!
    deckIds: [ID!]!
    text: String!
    pick: Int!
    state: CardState!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type WhiteCard {
    id: ID!
    deckIds: [ID!]!
    text: String!
    isCustom: Boolean!
    state: CardState!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  input WhiteCardInput {
    id: ID!
    text: String!
  }

  type Play {
    userId: ID!
    cards: [WhiteCard!]!
  }

  type SkipVote {
    userId: ID!
    vote: Boolean!
  }

  type GameRound {
    id: ID!
    blackCard: BlackCard!
    cardCzarId: ID!
    status: RoundStatus!
    winnerId: ID
    plays: [Play!]!
    votesToSkip: [SkipVote!]!
    sittingOut: [ID!]!
  }

  type Game {
    started: Boolean!
    decks: [CardDeck!]!
    rules: Rules!
    players: [User!]!
    currentRound: GameRound
  }

  type Query {
    me: User!
    players: [User!]!
    game: Game!
    gamePassword: String!
    myHand: [WhiteCard!]!
    decks: [CardDeck!]!
  }

  type Mutation {
    login(username: String!, password: String!): User!
    logout: Boolean!
    updateUsername(username: String!): User!
    updateDiscordId(discordId: String!): User!
    kickPlayer(userId: ID!): Boolean!
    importDeck(deckId: String!): CardDeck!
    addDeck(deckId: ID!): Boolean!
    removeDeck(deckId: ID!): Boolean!
    updateRules(rules: RulesInput!): Rules!
    startGame: Boolean!
    endGame: Boolean!
    playCards(cards: [WhiteCardInput!]!): Boolean!
    undoPlay: Boolean!
    requestNewHand: Boolean!
    pickWinner(cardId: ID!): Boolean!
    shareRoundToDiscord: Boolean!
    skipBlackCard: Boolean!
    voteToSkipBlackCard(vote: Boolean!): Boolean!
  }

  type Subscription {
    myProfile: User!
    myHand: [WhiteCard!]!
    givenCards: [WhiteCard!]!
    playerJoined: User!
    playerLeft: ID!
    rules: Rules!
    decks: [CardDeck!]!
    game: Game!
    gameEnded: String!
    winnerSelected: ID!
    closeModal: Boolean!
    holdGame: Boolean!
  }
`;
