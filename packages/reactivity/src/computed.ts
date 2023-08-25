import { isFunction } from "@vue/shared"
import { effect, track, trigger } from "./effect"
import { TrackOpTypes, TriggerOpTypes } from "./operates"

class CompuntedRefImpl {
  public _dirty = true // 默认为true，脏的，做缓存
  public _value // 保存计算属性的值
  public effect // 副作用函数

  constructor(public getter, public setter) {
    // 默认创建一个effect
    this.effect = effect(getter, {
      lazy: true, // 懒执行
      scheduler: () => { // 自定义
        if (!this._dirty) {
          this._dirty = true
          trigger(this, TriggerOpTypes.SET, 'value') // 触发effect
        }
      }
    })
  }

  get value() {
    if (this._dirty) {
      this._value = this.effect()
      this._dirty = false
    }
    track(this, TrackOpTypes.GET, 'value') // 收集 effect
    return this._value
  }

  set value(newVal) {
    this.setter(newVal)
  }
}

// 计算属性，可能接收一个函数或一个对象(包括getter、setter)
export function computed(getterOrOptions) {
  let getter, setter

  if (isFunction(getterOrOptions)) {
    getter = getterOrOptions
    setter = () => { }
  } else {
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }

  // 创建一个计算属性的ref
  return new CompuntedRefImpl(getter, setter)
}