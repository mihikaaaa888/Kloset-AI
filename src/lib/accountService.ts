import { apiUrl } from '@/lib/apiUrl'

export async function deleteAccount(accessToken: string): Promise<void> {
  const response = await fetch(apiUrl('/api/account'), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const result = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(result.error || 'Could not delete your account. Please try again.')
}
