import { gql, type DocumentNode, type TypedDocumentNode } from "@apollo/client";
import type { CardDeck, Game, GameRound, Rules, User, WhiteCard } from "@repo/shared/types";

const typed = <TData, TVariables extends Record<string, unknown> = Record<string, never>>(doc: DocumentNode) =>
  doc as TypedDocumentNode<TData, TVariables>;

/** Shapes returned by the API where they differ from the UI's domain types. */
export type GqlRound = Omit<GameRound, "plays" | "votesToSkip" | "winnerId"> & {
  winnerId?: string | null;
  plays: { userId: string; cards: WhiteCard[] }[];
  votesToSkip: { userId: string; vote: boolean }[];
};
export type GqlGame = Omit<Game, "currentRound"> & { currentRound?: GqlRound | null };

export const toRound = (round: GqlRound): GameRound => ({
  ...round,
  winnerId: round.winnerId ?? undefined,
  plays: Object.fromEntries(round.plays.map(({ userId, cards }) => [userId, cards])),
  votesToSkip: Object.fromEntries(round.votesToSkip.map(({ userId, vote }) => [userId, vote])),
});

export const toGame = (game: GqlGame): Game => ({
  ...game,
  currentRound: game.currentRound ? toRound(game.currentRound) : undefined,
});

const USER_FIELDS = gql`
  fragment UserFields on User {
    id
    username
    isActive
    points
    isCardCzar
  }
`;
const DECK_FIELDS = gql`
  fragment DeckFields on CardDeck {
    id
    name
    description
    numberOfWhiteCards
    numberOfBlackCards
    importedDeckId
    createdAt
    updatedAt
  }
`;
const RULES_FIELDS = gql`
  fragment RulesFields on Rules {
    pointsToWin
    pointsToWinBy
    canUndo
    numberOfCustomCards
    maxNumberOfPlayers
    allowMultipleAnswerBlackCards
    announceToDiscord
  }
`;
const WHITE_CARD_FIELDS = gql`
  fragment WhiteCardFields on WhiteCard {
    id
    deckIds
    text
    isCustom
    state
    createdAt
    updatedAt
  }
`;
const GAME_FIELDS = gql`
  ${DECK_FIELDS}
  ${RULES_FIELDS}
  ${USER_FIELDS}
  ${WHITE_CARD_FIELDS}
  fragment GameFields on Game {
    started
    decks {
      ...DeckFields
    }
    rules {
      ...RulesFields
    }
    players {
      ...UserFields
    }
    currentRound {
      id
      cardCzarId
      status
      winnerId
      blackCard {
        id
        deckIds
        text
        pick
        state
        createdAt
        updatedAt
      }
      plays {
        userId
        cards {
          ...WhiteCardFields
        }
      }
      votesToSkip {
        userId
        vote
      }
    }
  }
`;

// Queries
export const GAME_QUERY = typed<{ game: GqlGame }>(gql`
  ${GAME_FIELDS}
  query Game { game { ...GameFields } }
`);
export const GAME_PASSWORD_QUERY = typed<{ gamePassword: string }>(gql`
  query GamePassword { gamePassword }
`);
export const MY_HAND_QUERY = typed<{ myHand: WhiteCard[] }>(gql`
  ${WHITE_CARD_FIELDS}
  query MyHand { myHand { ...WhiteCardFields } }
`);
export const DECKS_QUERY = typed<{ decks: CardDeck[] }>(gql`
  ${DECK_FIELDS}
  query Decks { decks { ...DeckFields } }
`);

// Mutations
export const LOGIN_MUTATION = typed<{ login: User }, { username: string; password: string }>(gql`
  ${USER_FIELDS}
  mutation Login($username: String!, $password: String!) { login(username: $username, password: $password) { ...UserFields } }
`);
export const LOGOUT_MUTATION = typed<{ logout: boolean }>(gql`mutation Logout { logout }`);
export const KICK_PLAYER_MUTATION = typed<{ kickPlayer: boolean }, { userId: string }>(gql`
  mutation KickPlayer($userId: ID!) { kickPlayer(userId: $userId) }
`);
export const IMPORT_DECK_MUTATION = typed<{ importDeck: CardDeck }, { deckId: string }>(gql`
  ${DECK_FIELDS}
  mutation ImportDeck($deckId: String!) { importDeck(deckId: $deckId) { ...DeckFields } }
`);
export const ADD_DECK_MUTATION = typed<{ addDeck: boolean }, { deckId: string }>(gql`
  mutation AddDeck($deckId: ID!) { addDeck(deckId: $deckId) }
`);
export const REMOVE_DECK_MUTATION = typed<{ removeDeck: boolean }, { deckId: string }>(gql`
  mutation RemoveDeck($deckId: ID!) { removeDeck(deckId: $deckId) }
`);
export const UPDATE_RULES_MUTATION = typed<{ updateRules: Rules }, { rules: Partial<Rules> }>(gql`
  ${RULES_FIELDS}
  mutation UpdateRules($rules: RulesInput!) { updateRules(rules: $rules) { ...RulesFields } }
`);
export const START_GAME_MUTATION = typed<{ startGame: boolean }>(gql`mutation StartGame { startGame }`);
export const END_GAME_MUTATION = typed<{ endGame: boolean }>(gql`mutation EndGame { endGame }`);
export const PLAY_CARDS_MUTATION = typed<{ playCards: boolean }, { cards: Pick<WhiteCard, "id" | "text">[] }>(gql`
  mutation PlayCards($cards: [WhiteCardInput!]!) { playCards(cards: $cards) }
`);
export const UNDO_PLAY_MUTATION = typed<{ undoPlay: boolean }>(gql`mutation UndoPlay { undoPlay }`);
export const PICK_WINNER_MUTATION = typed<{ pickWinner: boolean }, { cardId: string }>(gql`
  mutation PickWinner($cardId: ID!) { pickWinner(cardId: $cardId) }
`);
export const SKIP_BLACK_CARD_MUTATION = typed<{ skipBlackCard: boolean }>(gql`mutation SkipBlackCard { skipBlackCard }`);
export const VOTE_TO_SKIP_MUTATION = typed<{ voteToSkipBlackCard: boolean }, { vote: boolean }>(gql`
  mutation VoteToSkip($vote: Boolean!) { voteToSkipBlackCard(vote: $vote) }
`);

// Subscriptions
export const MY_PROFILE_SUBSCRIPTION = typed<{ myProfile: User }>(gql`
  ${USER_FIELDS}
  subscription MyProfile { myProfile { ...UserFields } }
`);
export const MY_HAND_SUBSCRIPTION = typed<{ myHand: WhiteCard[] }>(gql`
  ${WHITE_CARD_FIELDS}
  subscription MyHandUpdated { myHand { ...WhiteCardFields } }
`);
export const GIVEN_CARDS_SUBSCRIPTION = typed<{ givenCards: WhiteCard[] }>(gql`
  ${WHITE_CARD_FIELDS}
  subscription GivenCards { givenCards { ...WhiteCardFields } }
`);
export const PLAYER_JOINED_SUBSCRIPTION = typed<{ playerJoined: User }>(gql`
  ${USER_FIELDS}
  subscription PlayerJoined { playerJoined { ...UserFields } }
`);
export const PLAYER_LEFT_SUBSCRIPTION = typed<{ playerLeft: string }>(gql`subscription PlayerLeft { playerLeft }`);
export const RULES_SUBSCRIPTION = typed<{ rules: Rules }>(gql`
  ${RULES_FIELDS}
  subscription RulesUpdated { rules { ...RulesFields } }
`);
export const DECKS_SUBSCRIPTION = typed<{ decks: CardDeck[] }>(gql`
  ${DECK_FIELDS}
  subscription DecksUpdated { decks { ...DeckFields } }
`);
export const GAME_SUBSCRIPTION = typed<{ game: GqlGame }>(gql`
  ${GAME_FIELDS}
  subscription GameUpdated { game { ...GameFields } }
`);
export const GAME_ENDED_SUBSCRIPTION = typed<{ gameEnded: string }>(gql`subscription GameEnded { gameEnded }`);
export const WINNER_SELECTED_SUBSCRIPTION = typed<{ winnerSelected: string }>(gql`subscription WinnerSelected { winnerSelected }`);
export const CLOSE_MODAL_SUBSCRIPTION = typed<{ closeModal: boolean }>(gql`subscription CloseModal { closeModal }`);
export const HOLD_GAME_SUBSCRIPTION = typed<{ holdGame: boolean }>(gql`subscription HoldGame { holdGame }`);
