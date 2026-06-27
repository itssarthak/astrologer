import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ChatInput from '../../src/components/Chat/ChatInput'

// The merged Chat view fills the input from two sources with different semantics:
//   injectText — mic transcripts, which APPEND (you may dictate in pieces)
//   replaceText — tapped template prompts, which REPLACE (picking a chip overwrites)
describe('ChatInput fill behavior', () => {
  it('appends successive injectText transcripts with a space', () => {
    const { rerender } = render(<ChatInput onSend={() => {}} injectText="hello" />)
    rerender(<ChatInput onSend={() => {}} injectText="world" />)
    expect(screen.getByRole('textbox').value).toBe('hello world')
  })

  it('replaces the input with replaceText (does not append)', () => {
    const { rerender } = render(<ChatInput onSend={() => {}} replaceText={{ text: 'first prompt' }} />)
    expect(screen.getByRole('textbox').value).toBe('first prompt')
    rerender(<ChatInput onSend={() => {}} replaceText={{ text: 'second prompt' }} />)
    expect(screen.getByRole('textbox').value).toBe('second prompt')
  })

  it('re-fills on a fresh replaceText object even when the text is identical', () => {
    const { rerender } = render(<ChatInput onSend={() => {}} replaceText={{ text: 'same' }} />)
    const box = screen.getByRole('textbox')
    expect(box.value).toBe('same')
    // User clears the input, then re-picks the SAME chip (parent sends a new {text} object).
    fireEvent.change(box, { target: { value: '' } })
    expect(box.value).toBe('')
    rerender(<ChatInput onSend={() => {}} replaceText={{ text: 'same' }} />)
    expect(box.value).toBe('same')
  })
})
