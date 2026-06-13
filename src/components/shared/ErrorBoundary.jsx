import { Component } from 'react'

// Catches render-time errors in a subtree (e.g. an unexpected chart shape in a tab) so one bad
// tab can't white-screen the whole app. Reset it by changing `resetKey` (we key it on the
// active tab), which remounts the boundary and clears the error.
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm font-semibold text-text">Something went wrong on this tab.</p>
            <p className="text-xs text-muted max-w-xs">{this.state.error.message}</p>
            <button
              onClick={() => this.setState({ error: null })}
              className="px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors">
              Try again
            </button>
          </div>
        )
      )
    }
    return this.props.children
  }
}
