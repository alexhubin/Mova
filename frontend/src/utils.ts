export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase() ?? '')
    .join('')
}

export function inviteURL(code: string): string {
  return `${window.location.origin}/r/${code}`
}

