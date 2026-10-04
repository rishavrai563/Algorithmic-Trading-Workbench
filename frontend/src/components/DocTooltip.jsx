import { useState } from 'react'
import { docsDictionary } from '../data/docsData'

export default function DocTooltip({ termKey, children }) {
  const [show, setShow] = useState(false)
  const doc = docsDictionary[termKey]

  if (!doc) return <>{children}</>

  return (
    <span 
      className="doc-tooltip-wrapper"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="doc-tooltip-popup">
          <strong>{doc.title}</strong>
          <p>{doc.description}</p>
        </div>
      )}
    </span>
  )
}
