import { useState, useEffect } from 'react'
import { getApiKey, subscribeApiKey } from '../lib/storage/keys'

// Reactive view of the stored API key. Re-renders consumers when the key is
// saved or cleared (including from another tab), so route guards and tool
// availability stay in sync instead of reading storage once at mount.
export function useApiKey() {
  const [keyData, setKeyData] = useState(getApiKey)
  useEffect(() => subscribeApiKey(() => setKeyData(getApiKey())), [])
  return keyData
}
