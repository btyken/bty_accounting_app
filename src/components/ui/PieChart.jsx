import React from 'react'
import { fmt } from '../../utils/format'

export default function PieChart({ slices }) {
  const total = slices.reduce((s, d) => s + d.value, 0)
  if (!total) return null

  const r = 80, cx = 100, cy = 100
  let cumDeg = 0

  const toRad = (deg) => (deg - 90) * Math.PI / 180
  const arc = (startDeg, endDeg) => {
    const end = Math.min(endDeg, startDeg + 359.99)
    const x1 = cx + r * Math.cos(toRad(startDeg))
    const y1 = cy + r * Math.sin(toRad(startDeg))
    const x2 = cx + r * Math.cos(toRad(end))
    const y2 = cy + r * Math.sin(toRad(end))
    const large = (end - startDeg) > 180 ? 1 : 0
    return `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`
  }

  return (
    <svg viewBox="0 0 200 200" style={{ width: '100%', maxWidth: 220 }}>
      {slices.map((s) => {
        const deg = (s.value / total) * 360
        const start = cumDeg
        cumDeg += deg
        return (
          <path key={s.label} d={arc(start, cumDeg)} fill={s.color} stroke="#fff" strokeWidth={1.5}>
            <title>{s.label}: {fmt(s.value)} ({((s.value / total) * 100).toFixed(1)}%)</title>
          </path>
        )
      })}
    </svg>
  )
}
