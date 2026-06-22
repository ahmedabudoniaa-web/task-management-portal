// Light pastel color per team, used consistently across tabs, cards, and icon tiles.
// Falls back to a neutral gray-blue if a team name isn't recognized.
const TEAM_COLORS = {
  Engineering: { dot: '#7FB8E8', tile: '#D5E9F8', icon: '#2B6CA3', card: '#EAF4FB' },
  Operations: { dot: '#F2B879', tile: '#FAE3C7', icon: '#B36B1E', card: '#FCF1E6' },
  'Health and Safety': { dot: '#F29DA8', tile: '#F8D4D9', icon: '#B33E54', card: '#FCEBED' },
  Property: { dot: '#A8D9B8', tile: '#D3EEDB', icon: '#2D7D4C', card: '#EDF7F0' },
  'People Service Hub': { dot: '#C9B8EC', tile: '#E1D9F4', icon: '#6B4FA8', card: '#F2EEFA' },
}

const FALLBACK = { dot: '#A9B4C4', tile: '#E4E8EF', icon: '#5C6B85', card: '#F2F4F7' }

export function teamColor(teamName) {
  return TEAM_COLORS[teamName] || FALLBACK
}

// Icon per team for task cards (Tabler icon class suffix)
const TEAM_ICONS = {
  Engineering: 'ti-cpu',
  Operations: 'ti-truck-delivery',
  'Health and Safety': 'ti-shield-check',
  Property: 'ti-home-2',
  'People Service Hub': 'ti-user-check',
}

export function teamIcon(teamName) {
  return TEAM_ICONS[teamName] || 'ti-checklist'
}
