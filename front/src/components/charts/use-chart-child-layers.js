import { Children, cloneElement, isValidElement } from 'react'
import {
  isClipExcludedComponent,
  isPostOverlayComponent,
  isUnderlayComponent,
  resolveChartChildElement,
} from './chart-child-passthrough'
import { isGradientDefComponent, isPatternDefComponent } from './chart-defs'

function ensureChildKey(child, index) {
  if (child.key != null) {
    return child
  }
  return cloneElement(child, { key: `chart-child-${index}` })
}

export function useChartChildLayers(children) {
  const layers = {
    defsChildren: [],
    clipExcludedChildren: [],
    underlayChildren: [],
    preOverlayChildren: [],
    postOverlayChildren: [],
  }

  Children.forEach(children, (child, index) => {
    if (!isValidElement(child)) {
      return
    }

    const resolvedChild = resolveChartChildElement(ensureChildKey(child, index))

    if (isGradientDefComponent(resolvedChild)) {
      layers.defsChildren.push(resolvedChild)
    } else if (isPatternDefComponent(resolvedChild)) {
      layers.preOverlayChildren.push(resolvedChild)
    } else if (isPostOverlayComponent(resolvedChild)) {
      layers.postOverlayChildren.push(resolvedChild)
    } else if (isClipExcludedComponent(resolvedChild)) {
      layers.clipExcludedChildren.push(resolvedChild)
    } else if (isUnderlayComponent(resolvedChild)) {
      layers.underlayChildren.push(resolvedChild)
    } else {
      layers.preOverlayChildren.push(resolvedChild)
    }
  })

  return layers
}
