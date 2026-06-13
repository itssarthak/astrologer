import { createContext, useContext, useState, useEffect } from 'react'

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

// A tab calls this with its in-flight state; it reports up and clears on unmount.
export function useReportBusy(isBusy) {
  const { setBusy } = useContext(BusyContext)
  useEffect(() => {
    setBusy(isBusy)
    return () => setBusy(false)
  }, [isBusy, setBusy])
}
