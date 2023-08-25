export const nodeOps = {
  createElement: tarName => document.createElement(tarName),
  remove: (child) => {
    let parent = child.parentNode
    if (parent) {
      parent.removeChild(child)
    }
  },
  // anchor 为 null 时为 appendChild
  insert: (child, parent, anchor) => {
    parent.insertBefore(child, anchor)
  },
  setElementText: (el, text) => {
    el.textContent = text
  },
  querySelector: selector => document.querySelector(selector),
  createText: text => document.createTextNode(text),
  setText: (node, text) => node.nodeValue = text,
  nextSibling: node => node.nextSibling
}