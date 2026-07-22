export type DeleteFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type OpenSwipeableEntry = {
  id: string;
  close: () => void;
  onDelete: () => void;
  deleteFrame: DeleteFrame | null;
};

type Listener = () => void;

let current: OpenSwipeableEntry | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeOpenSwipeable(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getOpenSwipeableSnapshot() {
  return current;
}

/** Close any other open row, then register this one as open. */
export function registerOpenSwipeable(entry: OpenSwipeableEntry) {
  if (current && current.id !== entry.id) {
    current.close();
  }
  current = entry;
  emit();
}

export function updateOpenSwipeableFrame(id: string, deleteFrame: DeleteFrame) {
  if (!current || current.id !== id) return;
  current = { ...current, deleteFrame };
  emit();
}

export function clearOpenSwipeable(id: string) {
  if (current?.id === id) {
    current = null;
    emit();
  }
}

/**
 * Dismiss the open delete action.
 * @returns `true` if a swipe was open and got closed (caller should ignore the tap).
 */
export function dismissOpenSwipeable(): boolean {
  if (!current) return false;
  current.close();
  current = null;
  emit();
  return true;
}

export function performOpenSwipeableDelete() {
  const entry = current;
  if (!entry) return;
  entry.close();
  current = null;
  emit();
  entry.onDelete();
}
