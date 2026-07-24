import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

import {
  DEFAULT_FEED_FILTER_STATE,
  type FeedFilterState,
} from '@/components/feed/feedFilters';

type FeedFilterContextValue = {
  filterState: FeedFilterState;
  setFilterState: Dispatch<SetStateAction<FeedFilterState>>;
  resetFilterState: () => void;
};

const FeedFilterContext = createContext<FeedFilterContextValue | null>(null);

/**
 * Shared Reviews ↔ My map ↔ My Gustra filter/sort state (in-memory, same session).
 */
export function FeedFilterProvider({ children }: { children: ReactNode }) {
  const [filterState, setFilterState] = useState<FeedFilterState>(
    DEFAULT_FEED_FILTER_STATE,
  );

  const resetFilterState = useCallback(() => {
    setFilterState(DEFAULT_FEED_FILTER_STATE);
  }, []);

  const value = useMemo(
    () => ({ filterState, setFilterState, resetFilterState }),
    [filterState, resetFilterState],
  );

  return (
    <FeedFilterContext.Provider value={value}>
      {children}
    </FeedFilterContext.Provider>
  );
}

export function useFeedFilter(): FeedFilterContextValue {
  const ctx = useContext(FeedFilterContext);
  if (!ctx) {
    throw new Error('useFeedFilter must be used within FeedFilterProvider');
  }
  return ctx;
}
