// tests/components/TemplatePrompts.test.jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import TemplatePrompts, { TEMPLATE_PROMPTS } from '../../src/components/Chat/TemplatePrompts'

describe('TemplatePrompts', () => {
  it('exposes four prompts', () => {
    expect(TEMPLATE_PROMPTS).toHaveLength(4)
    expect(TEMPLATE_PROMPTS[0]).toEqual({ label: "Today's transit read", text: 'Give me my transit read for today.' })
  })

  it('renders a chip per prompt', () => {
    render(<TemplatePrompts onPick={() => {}} />)
    expect(screen.getByRole('button', { name: "Today's transit read" })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Read my chart' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Current life phase' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Year ahead' })).toBeInTheDocument()
  })

  it('calls onPick with the prompt text when a chip is tapped', () => {
    const onPick = vi.fn()
    render(<TemplatePrompts onPick={onPick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Year ahead' }))
    expect(onPick).toHaveBeenCalledWith('What does the year ahead look like for me?')
  })
})
