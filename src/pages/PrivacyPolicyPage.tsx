import { Link } from 'react-router-dom'
import { POLICY_BLOCKS, POLICY_DATES, type PolicyBlock } from '@/pages/privacyPolicyContent'

/** Renders the **bold** spans in a line of policy text. */
function Inline({ text }: { text: string }) {
  return <>{text.split('**').map((part, i) => i % 2 ? <strong key={i} className="font-medium text-text-primary">{part}</strong> : part)}</>
}

function PolicyTable({ rows }: { rows: string[][] }) {
  const [head, ...body] = rows
  return (
    <div className="my-5 overflow-x-auto rounded-xl border border-text-primary/10">
      <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
        <thead>
          <tr className="bg-text-primary/5">
            {head.map((cell, i) => <th key={i} scope="col" className="px-3 py-2.5 align-bottom text-xs font-medium text-text-primary">{cell}</th>)}
          </tr>
        </thead>
        <tbody>
          {body.map((row, r) => (
            <tr key={r} className="border-t border-text-primary/10 first:border-t-0">
              {row.map((cell, c) => <td key={c} className={c === 0 ? 'px-3 py-2.5 align-top font-medium text-text-primary' : 'px-3 py-2.5 align-top leading-relaxed text-text-muted'}><Inline text={cell} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Block({ block }: { block: PolicyBlock }) {
  switch (block.type) {
    case 'h2': return <h2 className="mt-10 border-t border-text-primary/10 pt-8 font-display text-2xl text-text-primary sm:text-3xl">{block.text}</h2>
    case 'h3': return <h3 className="mt-6 text-base font-medium text-text-primary">{block.text}</h3>
    case 'p': return <p className="mt-3 text-sm leading-relaxed text-text-muted"><Inline text={block.text} /></p>
    case 'ul': return <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-text-muted">{block.items.map((item) => <li key={item}><Inline text={item} /></li>)}</ul>
    case 'table': return <PolicyTable rows={block.rows} />
  }
}

export function PrivacyPolicyPage() {
  return <main className="min-h-screen bg-warm-cream px-5 pb-24 pt-24 text-text-primary lg:pt-32">
    <article className="mx-auto max-w-3xl">
      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Kloset</p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl">Privacy Policy</h1>
      <p className="mt-2 text-xs text-text-muted"><Inline text={POLICY_DATES} /></p>
      {POLICY_BLOCKS.map((block, i) => <Block key={i} block={block} />)}
      <Link to="/" className="mt-10 inline-block text-sm text-text-primary underline underline-offset-4">Back to Kloset</Link>
    </article>
  </main>
}
