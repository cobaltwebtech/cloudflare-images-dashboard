import { QueryClient } from "@tanstack/react-query";

export function getContext() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				// Treat data as fresh for 30s so navigating between routes
				// (and hover-preloads) hits the cache instead of refetching.
				staleTime: 30_000,
				// Keep unused data around for 10 min before garbage collection.
				gcTime: 10 * 60_000,
				// One quick retry, then surface the error.
				retry: 1,
				retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
				refetchOnWindowFocus: true,
				refetchOnReconnect: true,
			},
			mutations: {
				retry: 0,
			},
		},
	});

	return {
		queryClient,
	};
}
