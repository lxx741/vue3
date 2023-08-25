import { isArray, isObject } from "@vue/shared";
import { createVNode, isVnode } from "./vnode";

// 根据各种参数创建虚拟节点
export function h(type, propOrChildren, children) {
  let len = arguments.length

  // 类型 + 属性 --- h('div', {})
  // 类型 + 孩子 --- h('div','lxx')、h('div',['lxx','asd'])
  if (len == 2) {
    if (isObject(propOrChildren) && !isArray(propOrChildren)) {
      if (isVnode(propOrChildren)) { // h('div',h('p','lxx'))
        return createVNode(type, null, [propOrChildren])
      } else { // h('div', {}) 
        return createVNode(type, propOrChildren)
      }
    } else { // h('div',['lxx','asd'])
      return createVNode(type, null, propOrChildren)
    }
  } else {
    if (len > 3) {
      children = Array.prototype.slice.call(arguments, 2)
    } else if (len == 3 && isVnode(children)) {
      children = [children]
    }
    return createVNode(type, propOrChildren, children)
  }
}