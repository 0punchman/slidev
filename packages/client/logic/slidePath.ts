import type { SlideRoute } from '@slidev/types'

export function getSlideRoutePath(
  route: SlideRoute,
  presenter: boolean | 'remote',
  exporting: boolean = false,
) {
  const no = route.meta.slide?.frontmatter.routeAlias ?? route.no
  if (exporting)
    return `/export/${no}`
  if (presenter === 'remote')
    return `/remote/${no}`
  if (presenter)
    return `/presenter/${no}`
  return `/${no}`
}
