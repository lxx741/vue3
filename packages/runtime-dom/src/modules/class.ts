// 设置元素的类名
export const patchClass = (el, val) => {
  if (val == null) {
    val = ''
  }
  el.className = val
}