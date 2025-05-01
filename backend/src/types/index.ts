import { ClientEmittedEventFunctions, ServerEmittedEventFunctions } from "./shared";
import { User } from "../users/User";
import {Socket as IOSocket} from "socket.io";

export type Socket = IOSocket<ClientEmittedEventFunctions, ServerEmittedEventFunctions, {}, User>;
export * from "./shared";