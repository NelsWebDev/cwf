import { createContext } from "react";
import { AuthService, GameService, ModalService } from "../types";

export const ModalServiceContext = createContext<ModalService|undefined>(undefined);
export const AuthServiceContext = createContext<AuthService | undefined>(undefined);
export const GameServiceContext = createContext<GameService | undefined>(undefined);
