import { hasChanged, hasProperty, isArray, isIntegerKey, isObject } from "@vue/shared"
import { track, trigger } from "./effect";
import { TrackOpTypes, TriggerOpTypes } from "./operates";
import { reactive, readonly } from "./reactivity"


function createGetter(isReadonly = false, isShallow = false) {
  return function get(target, key, receiver) {  // 当给代理对象上的属性设置值时会走 set 方法
    let res = Reflect.get(target, key, receiver)
    if (!isReadonly) { // 不是仅读，可能会改，要收集依赖
      track(target, TrackOpTypes.GET, key) // effect中取了哪个对象中的哪个属性
    }
    if (isShallow) return res // 是浅的直接返回第一层属性的值
    if (isObject(res)) { // 不是浅的且是对象进一步进行对象的代理，所以vue3是懒代理模式，而vue2是一上来就把data中的数据递归定义成响应式数据
      return isReadonly ? readonly(res) : reactive(res)
    }
    return res
  }
}

function createSetter(isShallow = false) {
  return function set(target, key, val, receiver) { // 当访问代理对象上的属性时会走 get 方法
    let oldVal = target[key]
    let hasKey = isArray(target) && isIntegerKey(key)
      ? Number(key) < target.length // 修改的key是数组的索引，并且已存在该索引，即为修改该索引上的值
      : hasProperty(target, key) // 对象上是否存在该属性，存在为修改，不存在为新增
    let res = Reflect.set(target, key, val, receiver)
    if (!hasKey) {
      // 新增：对象上没有该属性，数组上没有该索引
      trigger(target, TriggerOpTypes.ADD, key, val)
    } else if (hasChanged(oldVal, val)) {
      // 修改：对象上有该属性且值不相等，数组有该索引且值不相等
      trigger(target, TriggerOpTypes.SET, key, val, oldVal)
    }
    return res
  }
}

const reactiveGet = createGetter()
const shallowReactiveGet = createGetter(false, true)
const readonlyGet = createGetter(true)
const shallowReadonlyGet = createGetter(true, true)

const reactiveSet = createSetter()
const shallowReactiveSet = createSetter(true)

export const reactiveHandler = {
  get: reactiveGet,
  set: reactiveSet
}
export const shallowReactiveHandler = {
  get: shallowReactiveGet,
  set: shallowReactiveSet
}
export const readonlyHandler = {
  get: readonlyGet,
  set(target) {
    console.warn(target, `为仅读对象，不可设置`);
  }
}
export const shallowReadonlyHandler = {
  get: shallowReadonlyGet,
  set(target) {
    console.warn(target, `为仅读对象，不可设置`);
  }
}