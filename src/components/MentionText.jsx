import { renderMentionSegments } from '../lib/dependencies'

export default function MentionText({ text, people }) {
  const segments = renderMentionSegments(text, people || [])
  return (
    <>
      {segments.map((seg, i) =>
        seg.isMention ? (
          <span key={i} style={styles.mention}>{seg.text}</span>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  )
}

const styles = {
  mention: { color: 'var(--bupa-blue)', fontWeight: 700, background: 'var(--info-light)', padding: '1px 4px', borderRadius: 4 },
}
