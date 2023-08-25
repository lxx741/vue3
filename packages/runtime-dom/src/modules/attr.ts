
// 更新元素的属性
export const patchAttr = (el, key, nextVal) => {
  if (nextVal == null) { // 没有新值
    el.removeAttribute(key)
  } else { // 新旧值不等
    el.setAttribute(key, nextVal)
  }
}