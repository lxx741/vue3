import { hasChanged, isArray, isObject } from "@vue/shared"
import { track, trigger } from "./effect"
import { TrackOpTypes, TriggerOpTypes } from "./operates"
import { reactive } from "./reactivity"

export function ref(rawVal) {
  return createRef(rawVal)
}

export function shallowRef(rawVal) {
  return createRef(rawVal, true)
}

const convert = val => isObject(val) ? reactive(val) : val
class RefImpl {
  public _value
  public __v_isRef = true
  constructor(public rawValue, public shallow) {

    this._value = shallow ? rawValue : convert(rawValue)
  }

  get value() {
    track(this, TrackOpTypes.GET, 'value')
    return this._value
  }
  set value(newVal) {
    if (hasChanged(newVal, this._value)) {
      this._value = this.shallow ? newVal : convert(newVal)
      trigger(this, TriggerOpTypes.SET, 'value', newVal)
    }
  }
}

export function createRef(rawVal, shallow = false) {
  return new RefImpl(rawVal, shallow)
}

class ObjectRefImpl {
  public __v_isRef = true
  constructor(public target, public key) { }
  get value() {
    return this.target[this.key]
  }
  set value(newVal) {
    this.target[this.key] = newVal
  }
}

// 将对象中的某个属性的值变成响应式的数据
export function toRef(target, key) {
  return new ObjectRefImpl(target, key)
}

// 将对象中多个属性值批量变成响应式的数据
export function toRefs(obj) {
  let res = isArray(obj) ? new Array(obj.length) : {}
  for (let key in obj) {
    res[key] = toRef(obj, key)
  }
  return res
}