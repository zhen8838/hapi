import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ApiClient } from '@/api/client'
import type { SessionProfile } from '@/components/NewSession/preferences'
import { queryKeys } from '@/lib/query-keys'

export function useProfiles(api: ApiClient | null): {
    profiles: SessionProfile[]
    isLoading: boolean
    error: string | null
    saveProfile: (profile: SessionProfile) => Promise<void>
    deleteProfile: (profileId: string) => Promise<void>
    isSaving: boolean
    isDeleting: boolean
} {
    const queryClient = useQueryClient()

    const query = useQuery({
        queryKey: queryKeys.profiles,
        queryFn: async () => {
            if (!api) {
                throw new Error('API unavailable')
            }
            return await api.getProfiles()
        },
        enabled: Boolean(api),
    })

    const saveMutation = useMutation({
        mutationFn: async (profile: SessionProfile) => {
            if (!api) {
                throw new Error('API unavailable')
            }
            await api.saveProfile(profile)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.profiles })
        },
    })

    const deleteMutation = useMutation({
        mutationFn: async (profileId: string) => {
            if (!api) {
                throw new Error('API unavailable')
            }
            await api.deleteProfile(profileId)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.profiles })
        },
    })

    return {
        profiles: query.data ?? [],
        isLoading: query.isLoading,
        error: query.error instanceof Error ? query.error.message : query.error ? 'Failed to load profiles' : null,
        saveProfile: saveMutation.mutateAsync,
        deleteProfile: deleteMutation.mutateAsync,
        isSaving: saveMutation.isPending,
        isDeleting: deleteMutation.isPending,
    }
}
