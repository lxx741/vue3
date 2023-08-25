import { hasProperty } from "@vue/shared"

// 创建实例的代理处理对象
export const publicInstanceProxyHandler = {
  get({ _: instance }, key) {
    if (key[0] == '$') return // 不能访问$开头的属性
    let { setupState, props, data } = instance
    if (hasProperty(setupState, key)) {
      return setupState[key]
    } else if (hasProperty(props, key)) {
      return props[key]
    } else if (hasProperty(data, key)) {
      return props[key]
    }
  },
  set({ _: instance }, key, val) {
    return true
  },
}