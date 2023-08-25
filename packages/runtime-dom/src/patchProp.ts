import { patchAttr } from "./modules/attr"
import { patchClass } from "./modules/class"
import { patchEvent } from "./modules/event"
import { patchStyle } from "./modules/style"

// 比较更新元素属性，attr、class、style、事件等
export const patchProp = (el, key, prevVal, nextVal) => {
  switch (key) {
    case 'class':
      patchClass(el, nextVal)
      break;
    case 'style':
      patchStyle(el, prevVal, nextVal)
      break;
    default:
      if (/^on[^a-z]/.test(key)) {
        patchEvent(el, key, nextVal)
      } else {
        patchAttr(el, key, nextVal)
      }
      break;
  }
}