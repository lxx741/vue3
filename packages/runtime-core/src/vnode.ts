import { isArray, isObject, isString } from "@vue/shared"
import { ShapeFlags } from "./shapeFlag"

/**
 * 创建虚拟节点
 * @param type 组件或元素
 * @param props 属性
 * @param children 孩子
 */
export function createVNode(type, props, children = null) {
  let shapeFlag = isString(type) ? ShapeFlags.ELEMENT : isObject(type) ? ShapeFlags.STATEFUL_COMPONENT : 0
  let vnode = {
    __v_isVnode: true, // 是否是虚拟节点
    type, // 类型（字符串、对象）
    props, // 属性
    children, // 孩子
    el: null, // 对应真实节点
    key: props && props.key, // 唯一标识，用来diff
    shapeFlag, // 节点和孩子的类型
    component: null // 存放组件对应的实例
  }
  normallizeChildren(vnode, children)

  return vnode
}

// 判断是否是虚拟节点
export function isVnode(vnode) {
  return vnode.__v_isVnode
}

// 标记虚拟节点及其孩子的类型
function normallizeChildren(vnode, children) {
  let type = 0
  if (children == null) {

  } else if (isArray(children)) {
    type = ShapeFlags.ARRAY_CHILDREN
  } else {
    type = ShapeFlags.TEXT_CHILDREN
  }

  vnode.shapeFlag |= type
}
export const Text = Symbol('Text') // 字符串文本类型
// 将字符串转换成一个虚拟节点
export function normallizeVNode(child) {
  if (isObject(child)) return child
  return createVNode(Text, null, String(child))
}