
// 更新事件
export const patchEvent = (el, key, nextVal) => {
  // 缓存元素上的事件
  let invokers = el._vei || (el._vei = {})
  let existFn = invokers[key] // 是否已经绑定过事件
  if (nextVal && existFn) { // 绑定过则需要给元素更新绑定的事件
    existFn.fn = nextVal
  } else {
    const eventName = key.slice(2).toLowerCase()
    if (nextVal) { // 第一次给元素绑定事件，并存到缓存中
      let invoker = invokers[key] = createInvoker(nextVal)
      el.addEventListener(eventName, invoker)
    } else { // 元素卸载事件
      el.removeEventListener(eventName, existFn)
      invokers[key] = null
    }
  }
}

function createInvoker(fn) {
  const invoker = (e) => {
    invoker.fn(e)
  }
  invoker.fn = fn
  return invoker
}