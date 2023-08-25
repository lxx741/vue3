import { isArray, isIntegerKey } from "@vue/shared"
import { TriggerOpTypes } from "./operates"

/**
 * 副作用函数
 * - 传入的回调函数中会使用响应式数据，即会触发代理对象的 get 方法
 * - 依赖收集：响应式属性和回调函数就会存在依赖关系（响应式对象的属性在回调中使用，回调函数中使用了响应式数据）
 * - 触发依赖：响应式数据变化会触发响应式对象的 set 方法
 * @param fn 回调函数
 * @param options 参数选项
 * @returns 响应式的effect
 */
export function effect(fn, options: any = {}) {
  const effect = createReactiveEffect(fn, options)
  if (!options.lazy) {
    effect()
  }
  return effect
}

let uid = 0
let activeEffect // 存储当前effect
const effectStack = [] // 解决effect嵌套调用问题
function createReactiveEffect(fn, options) {
  const effect = function reactiveEffect() {
    // 去重effect，不要存储相同的 effect
    if (!effectStack.includes(effect)) {
      try {
        effectStack.push(effect)
        activeEffect = effect
        return fn()
      } finally {
        effectStack.pop()
        activeEffect = effectStack[effectStack.length - 1]
      }
    }

  }
  effect.id = uid++
  effect._isEffect = true
  effect.raw = fn
  effect.options = options
  return effect
}

// 用来存储哪个对象(target)中的哪个属性(dep)对应的副作用(effect)
let targetMap = new WeakMap
// 收集依赖：将响应式数据与副作用函数关联起来
export function track(target, type, key) {
  // 响应式数据不在effect中使用就不用关联effect
  if (activeEffect == null) return
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map))
  }
  let effects = depsMap.get(key)
  if (!effects) {
    depsMap.set(key, (effects = new Set))
  }
  effects.add(activeEffect)
}


export function trigger(target, type, key?, newVal?, oldVal?) {
  let depsMap = targetMap.get(target)
  if (!depsMap) return // target 没有在 effect 中使用，直接返回

  let newEffects = new Set // 存储将要被执行的 effect
  const addEffect = (effects) => {
    if (effects) {
      effects.forEach(effect => newEffects.add(effect))
    }
  }
  // 修改的是 数组的 length 属性
  if (key == 'length' && isArray(target)) {
    depsMap.forEach((effects, key) => {
      if (key == 'length' || key > newVal) {
        // effect 中使用了数组的 length 属性或者数组的索引，改变的数组的长度小于使用的索引
        addEffect(effects)
      }
    });
  } else {
    if (key != null) { // 修改对象属性
      addEffect(depsMap.get(key))
    }

    // effect 中使用了数组本身(会收集每个索引和length属性)，修改了数组不存在的索引(新增了大于数组长度的索引)
    if (type == TriggerOpTypes.ADD && isArray(target) && isIntegerKey(key)) {
      addEffect(depsMap.get('length'))
    }
  }

  newEffects.forEach((effect: any) => {
    if (effect.options.scheduler) {
      effect.options.scheduler(effect)
    } else {
      effect()
    }
  })
}