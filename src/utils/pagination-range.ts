export type PaginationRangeItem = number | 'ellipsis'

const SIBLING_COUNT = 1
const BOUNDARY_COUNT = 1

export function getPaginationRange(currentPage: number, totalPages: number): PaginationRangeItem[] {
  const totalSlots = SIBLING_COUNT * 2 + BOUNDARY_COUNT * 2 + 3

  if (totalPages <= totalSlots) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const leftSibling = Math.max(currentPage - SIBLING_COUNT, BOUNDARY_COUNT + 1)
  const rightSibling = Math.min(currentPage + SIBLING_COUNT, totalPages - BOUNDARY_COUNT)
  const showLeftEllipsis = leftSibling > BOUNDARY_COUNT + 1
  const showRightEllipsis = rightSibling < totalPages - BOUNDARY_COUNT

  const range: PaginationRangeItem[] = []
  for (let page = 1; page <= BOUNDARY_COUNT; page += 1) {
    range.push(page)
  }

  if (showLeftEllipsis) {
    range.push('ellipsis')
  } else {
    for (let page = BOUNDARY_COUNT + 1; page < leftSibling; page += 1) {
      range.push(page)
    }
  }

  for (let page = leftSibling; page <= rightSibling; page += 1) {
    range.push(page)
  }

  if (showRightEllipsis) {
    range.push('ellipsis')
  } else {
    for (let page = rightSibling + 1; page <= totalPages - BOUNDARY_COUNT; page += 1) {
      range.push(page)
    }
  }

  for (let page = totalPages - BOUNDARY_COUNT + 1; page <= totalPages; page += 1) {
    range.push(page)
  }

  return range
}
