// Money is stored as integer cents everywhere. Format only at the UI edge.
export function centsToUsd(cents) {
  if (cents == null) return ''
  const dollars = cents / 100
  return '$' + (Number.isInteger(dollars) ? dollars : dollars.toFixed(2))
}

export function initials(name = '') {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
