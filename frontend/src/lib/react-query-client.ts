import { QueryClient } from '@tanstack/react-query';

// Configure query client with caching settings optimized for COVENANT protocol
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes before becoming stale
      staleTime: 5 * 60 * 1000, // 5 minutes
      // Keep data in cache for 30 minutes
      cacheTime: 30 * 60 * 1000, // 30 minutes
      // Refetch on window focus if data is older than 30 seconds
      refetchOnWindowFocus: true,
      refetchInterval: false,
      // Retry failed requests up to 3 times
      retry: 3,
      // Use exponential backoff for retries
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});