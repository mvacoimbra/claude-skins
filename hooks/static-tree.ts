// A tree another mod can draw: plain data, so a press, a field or a surface module, whose
// closures stay in this mod, becomes its label as text, and every function is left out.
export function staticTree(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(staticTree)
  }

  if (node === null || typeof node !== 'object') {
    return typeof node === 'function' ? undefined : node
  }

  const element = node as { type?: unknown; props?: Record<string, unknown>; children?: unknown }

  if (element.type === 'Button' || element.type === 'Input' || element.type === 'Select' || element.type === 'Client') {
    const label = String(element.props?.label ?? element.props?.placeholder ?? element.props?.key ?? '')

    return { type: 'Text', props: element.props?.dimColor === true ? { dimColor: true } : {}, children: [element.type === 'Button' ? `[ ${label} ]` : label] }
  }

  return Object.fromEntries(
    Object.entries(element)
      .filter(([key, value]) => key !== 'press' && typeof value !== 'function')
      .map(([key, value]) => [key, key === 'props' && value !== null && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([, prop]) => typeof prop !== 'function')) : staticTree(value)]),
  )
}
