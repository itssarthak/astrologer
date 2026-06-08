import { render, screen } from '@testing-library/react'
import { ProfilesContext, ProfilesProvider } from '../src/contexts/ProfilesContext'
import { useContext } from 'react'

function Consumer() {
  const { profiles, activeProfile } = useContext(ProfilesContext)
  return <div>{profiles.length === 0 ? 'empty' : activeProfile?.name}</div>
}

test('ProfilesProvider exposes empty profiles list by default', () => {
  localStorage.clear()
  render(<ProfilesProvider><Consumer /></ProfilesProvider>)
  expect(screen.getByText('empty')).toBeInTheDocument()
})
