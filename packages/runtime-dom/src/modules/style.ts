
// 比对设置style
export const patchStyle = (el, prevVal, nextVal) => {
  const style = el.style
  if (nextVal == null) { // 新的没有
    el.removeAttribute('style')
  } else {
    if (prevVal) {
      for (let key in prevVal) { // 老的有，新的没有，删掉老的
        if (nextVal[key] == null) {
          style[key] = ''
        }
      }
    }
    // 将新的样式设置到元素上
    for (let key in nextVal) { // {style: {color: 'red'}}
      style[key] = nextVal[key]
    }
  }
}