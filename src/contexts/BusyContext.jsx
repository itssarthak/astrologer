import { createContext, useContext, useState, useEffect } from 'react'
import { setUpdateBusy } from '../lib/swUpdate'

// Tracks whether the active tab is mid-request (streaming / computing). Used to block
// profile switching while a response is in flight — switching mid-stream would land part
// of the response in the wrong profile's chat.
const BusyContext = createContext({ busy: false, setBusy: () => {} })

export function BusyProvider({ children }) {
  const [busy, setBusy] = useState(false)
  return <BusyContext.Provider value={{ busy, setBusy }}>{children}</BusyContext.Provider>
}

export function useBusy() {
  return useContext(BusyContext)
}

// A tab calls this with its in-flight state; it reports up and clears on unmount. Also feeds the
// service-worker updater's busy signal so a pending app update never reloads mid-stream.
export function useReportBusy(isBusy) {
  const { setBusy } = useContext(BusyContext)
  useEffect(() => {
    setBusy(isBusy)
    setUpdateBusy(isBusy)
    return () => { setBusy(false); setUpdateBusy(false) }
  }, [isBusy, setBusy])
}
