export type User = {
    id: string;
    username: string;
    email: string;
    createdAt: Date;
    updatedAt: Date;
}

type ClientEmittedEvents = {
    "kick": User['id'];
}

type ServerEmittedEvents = {
    "profile": User;
    "userJoined": User;
    "userLeft": User['id'];
}

export type ClientEmittedEventFunctions = {
    [K in keyof ClientEmittedEvents]: ClientEmittedEvents[K] extends void ? () => void : (arg: ClientEmittedEvents[K]) => void;
}

export type ServerEmittedEventFunctions = {
    [K in keyof ServerEmittedEvents]: ServerEmittedEvents[K] extends void ? () => void : (arg: ServerEmittedEvents[K]) => void;
}