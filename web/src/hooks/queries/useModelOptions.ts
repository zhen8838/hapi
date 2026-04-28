import { useQuery } from '@tanstack/react-query'
import { getDefaultModelOptionsForFlavor, isKnownFlavor, type ModelOption } from '@hapi/protocol'
import type { ApiClient } from '@/api/client'
import { queryKeys } from '@/lib/query-keys'

export function useModelOptions(api: ApiClient | null, enabled: boolean): {
    getOptions: (flavor: string | null | undefined) => ModelOption[]
    isLoading: boolean
} {
    const query = useQuery({
        queryKey: queryKeys.modelOptions,
        queryFn: async () => {
            if (!api) {
                throw new Error('API unavailable')
            }
            return await api.getModelOptions()
        },
        enabled: Boolean(api && enabled),
        staleTime: 5 * 60 * 1000,
    })

    return {
        getOptions: (flavor) => {
            if (!isKnownFlavor(flavor)) return []
            return query.data?.options[flavor] ?? getDefaultModelOptionsForFlavor(flavor)
        },
        isLoading: query.isLoading,
    }
}
