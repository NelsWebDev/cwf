import { EventHandlers, Socket } from "../types";
import { GamePlayEventHandlers } from "./GamePlayEvents";
import { SettingEventHandlers } from "./SettingEvents";
import { UserEventHandlers } from "./UserEvents";

export const AllEventHandlers : EventHandlers = {
    ...UserEventHandlers,
    ...SettingEventHandlers,
    ...GamePlayEventHandlers,
}

export default AllEventHandlers;