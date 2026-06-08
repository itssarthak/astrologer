import { createContext } from 'react'
import { usePyodide } from '../hooks/usePyodide'

export const PyodideContext = createContext(null)

export function PyodideProvider({ children }) {
  const pyodide = usePyodide()
  return (
    <PyodideContext.Provider value={pyodide}>
      {children}
    </PyodideContext.Provider>
  )
}
