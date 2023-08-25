import { isObject } from "@vue/shared"

import { reactiveHandler, shallowReactiveHandler, readonlyHandler, shallowReadonlyHandler } from './baseHandler'

// 创建代理对象
export function reactive(target) {
  return reacteReactiveObject(target, false, reactiveHandler)
}

// 创建浅的代理对象
export function shallowReactive(target) {
  return reacteReactiveObject(target, false, shallowReactiveHandler)
}

// 创建仅读代理对象
export function readonly(target) {
  return reacteReactiveObject(target, true, readonlyHandler)
}

// 创建浅的仅读代理对象
export function shallowReadonly(target) {
  return reacteReactiveObject(target, true, shallowReadonlyHandler)
}

const reactiveMap = new WeakMap // 缓存代理对象
const readonlyMap = new WeakMap // 缓存仅读代理对象
/**
 * 创建响应式对象
 * @param target 被代理对象
 * @param isReadonly 是否仅读
 * @param baseHandler 代理对象的处理器对象
 */
export function reacteReactiveObject(target, isReadonly, baseHandler) {
  if (!isObject(target)) return target // 被代理的数据需要是个对象，否则直接返回该数据
  let proxyMap = isReadonly ? readonlyMap : reactiveMap
  let existProxy = proxyMap.get(target)
  if (existProxy) return existProxy // 已经被代理过的对象直接返回
  let proxy = new Proxy(target, baseHandler)
  proxyMap.set(target, proxy)
  return proxy
}