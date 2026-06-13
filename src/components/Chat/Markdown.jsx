import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Renders an assistant reply as markdown, styled to sit inside a chat bubble. The model is
// instructed (soul.md) to use a bold lead line + bullets; this turns that into real formatting
// instead of literal asterisks. react-markdown escapes HTML by default, so this is XSS-safe.
const COMPONENTS = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }) => <p className="font-semibold mt-3 mb-1 first:mt-0">{children}</p>,
  h2: ({ children }) => <p className="font-semibold mt-3 mb-1 first:mt-0">{children}</p>,
  h3: ({ children }) => <p className="font-semibold mt-3 mb-1 first:mt-0">{children}</p>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline text-primary">{children}</a>
  ),
  code: ({ children }) => <code className="px-1 py-0.5 rounded bg-surface-2 text-[0.85em]">{children}</code>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-border pl-3 italic my-2">{children}</blockquote>,
  hr: () => <hr className="my-3 border-border" />,
}

export default function Markdown({ children }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
      {children}
    </ReactMarkdown>
  )
}
