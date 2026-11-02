import type { en } from './messages/en';

type DeepStringRecord<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringRecord<T[K]>;
};

/** Shape every locale must implement. Derived from the English messages. */
export type Messages = DeepStringRecord<typeof en>;

type Join<K extends string, P extends string> = `${K}.${P}`;

/** Union of all dot-separated message keys, e.g. `"reportStatus.resolved"`. */
export type MessageKey<T = Messages> = {
  [K in keyof T & string]: T[K] extends string ? K : Join<K, MessageKey<T[K]>>;
}[keyof T & string];
