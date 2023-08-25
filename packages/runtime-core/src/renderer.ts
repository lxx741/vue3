import { effect } from "@vue/reactivity"
import { patchProp } from "packages/runtime-dom/src/patchProp"
import { createComponentInstance, setupComponent } from "./component"
import { createAppApi } from "./createAppApi"
import { queueJob } from "./scheduler"
import { ShapeFlags } from "./shapeFlag"
import { normallizeVNode, Text } from "./vnode"

// 创建一个渲染器
export function createRenderer(rendererOptions) {
  let {
    createElement: hostCreateElement,
    remove: hostRemove,
    insert: hostInsert,
    setElementText: hostSetElementText,
    querySelector: hostQuerySelector,
    createText: hostCreateText,
    setText: hostSetText,
    patchProp: hostPatchProp,
    nextSibling: hostNextSibling
  } = rendererOptions

  // 启动副作用函数
  let setupRendererEffect = (instance, container) => {
    // 初次渲染
    instance.update = effect(function componentEffect() {
      if (instance.isMounted) {
        // 更新
        let prevTree = instance.subTree
        let proxyToUse = instance.proxy
        let nextTree = instance.render.call(proxyToUse, proxyToUse)
        patch(prevTree, nextTree, container)
      } else {
        let proxyToUse = instance.proxy
        let subTree = instance.subTree = instance.render.call(proxyToUse, proxyToUse)
        patch(null, subTree, container)
        instance.isMounted = true
      }
    }, {
      scheduler: queueJob
    })
  }
  // 挂载组件
  let mountComponent = (vnode, container) => {
    // 创建实例
    let instance = (vnode.component = createComponentInstance(vnode))
    // 给实例赋值一系列属性
    setupComponent(instance)
    // 调用 render方法
    setupRendererEffect(instance, container)
  }
  // 处理组件
  let processComponent = (n1, n2, container) => {
    if (n1 == null) {
      // 组件初次渲染
      mountComponent(n2, container)
    } else {

      // 组件更新

    }
  }
  // 处理孩子
  let mountChildren = (children, container) => {
    for (let i = 0; i < children.length; i++) {
      let child = normallizeVNode(children[i])
      patch(null, child, container)
    }
  }
  // 挂载元素
  let mountElement = (vnode, container, anchor = null) => {
    let { type, props, children, shapeFlag } = vnode
    let el = vnode.el = hostCreateElement(type)
    if (props) {
      for (let key in props) {
        hostPatchProp(el, key, null, props[key])
      }
    }
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      hostSetElementText(el, children)
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      mountChildren(children, el)
    }
    hostInsert(el, container, anchor)
  }
  // 比对节点属性
  let patchProps = (oldProps, newProps, el) => {
    if (oldProps !== newProps) {
      for (let key in newProps) {
        let prev = oldProps[key]
        let next = newProps[key]
        if (prev !== next) { // 新老值不一样
          patchProp(el, key, prev, next)
        }
      }

      for (let key in oldProps) {
        if (!(key in newProps)) { // 老的里有  新的里没有  删除老的
          patchProp(el, key, oldProps[key], null)
        }
      }
    }
  }
  let unmountChildren = (children) => {
    children.forEach(child => unmount(child))
  }
  // 求解最长递增子序列
  function getSequence(arr) {
    let start, mid, end;
    let len = arr.length;
    let result = [0]; // 结果集：存放索引
    let p = arr.slice(0); // 每一项是当前位置的前一个的索引
    for (let i = 0; i < len; i++) {
      let arrI = arr[i];
      if (arrI != 0) {
        let lastResultIndex = result[result.length - 1];
        // 当前项的值(arrI)比结果集最后一项(索引)对应的值大，则将该项的索引添加到结果集中
        if (arr[lastResultIndex] < arrI) {
          p[i] = lastResultIndex; // 当前项的值大时,将结果集中的最后一项(即索引)放到该项的索引上
          result.push(i); // 当前项的值大时，将索引放到结果集中
          continue;
        }
        // 二分查找
        start = 0;
        end = result.length - 1;
        while (start < end) {
          mid = ((start + end) / 2) | 0; // 取整数
          if (arrI > arr[result[mid]]) {
            start = mid + 1;
          } else {
            end = mid;
          }
        }
        // 找到了 start = end
        if (arrI < arr[result[start]]) {
          if (start > 0) {
            p[i] = result[start - 1]; // 替换的时候，当前项的索引记住前一个的索引
          }
          result[start] = i;
        }
      }
    }
    let len1 = result.length;
    let last = result[len1 - 1];
    while (len1-- > 0) {
      result[len1] = last;
      last = p[last];
    }

    return result;
  }
  // 比较两个带key的数组
  let patchKeyedChildren = (c1, c2, container) => {
    let i = 0
    let e1 = c1.length - 1
    let e2 = c2.length - 1

    // sync from start
    while (i <= e1 && i <= e2) {
      let n1 = c1[i]
      let n2 = c2[i]
      if (isSameVNode(n1, n2)) {
        patch(n1, n2, container)
      } else {
        break
      }
      i++
    }

    // sync from end
    while (i <= e1 && i <= e2) {
      let n1 = c1[e1]
      let n2 = c2[e2]
      if (isSameVNode(n1, n2)) {
        patch(n1, n2, container)
      } else {
        break
      }
      e1--
      e2--
    }
    // 新的多，需要插入
    if (i > e1) {
      if (i <= e2) {
        let nexPos = e2 + 1
        let anchor = nexPos < c2.length ? c2[nexPos].el : null // 参照物，是往后插入还是往前插入
        while (i <= e2) {
          patch(null, c2[i], container, anchor)
          i++
        }
      }
    } else if (i > e2) { // 老的多，需要删除
      while (i <= e1) {
        unmount(c1[i])
        i++
      }
    } else {
      let s1 = i
      let s2 = i
      // 用新的做映射表
      let keyToNewIndexMap = new Map
      for (let i = s2; i <= e2; i++) {
        let vnode = c2[i]
        keyToNewIndexMap.set(vnode.key, i) // 新key => 新index
      }
      let toBePachted = e2 - s2 + 1 // 将要进行比对的节点总个数
      let newIndexToOldIndex = new Array(toBePachted).fill(0) // 做一个索引，数组项为0则没被比对过，应该插入

      // 循环旧节点找出可复用的节点
      for (let i = s1; i <= e1; i++) {
        let vnode = c1[i]
        let newIndex = keyToNewIndexMap.get(vnode.key)
        if (newIndex == undefined) { // 没在新列表中找到，则删除旧节点
          unmount(vnode)
        } else {
          newIndexToOldIndex[newIndex - s2] = i + 1 // 新老索引的关系
          patch(vnode, c2[newIndex], container) // 找到了，就比对
        }
      }

      let increasingNewIndexSequence = getSequence(newIndexToOldIndex) // [1,2]
      let j = increasingNewIndexSequence.length - 1
      // 从后往前插入  [5,3,4,0]
      for (let i = toBePachted - 1; i >= 0; i--) {
        let currentIndex = i + s2
        let vnode = c2[currentIndex]
        let anchor = currentIndex + 1 < c2.length ? c2[currentIndex + 1].el : null
        if (newIndexToOldIndex[i] == 0) { // 没被比对过，直接新建插入
          patch(null, vnode, container, anchor)
        } else { // 移动插入
          // i => 3 2 1 0
          // j => 1 0 
          if (i != increasingNewIndexSequence[j]) {
            hostInsert(vnode.el, container, anchor)
          } else {
            j--
          }
        }
      }
    }
  }
  // 比对孩子
  let patchChildren = (n1, n2, container) => {
    let c1 = n1.children
    let c2 = n2.children
    let prevShapeFlag = n1.shapeFlag
    let shapeFlag = n2.shapeFlag
    // 当前是文本
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // 之前孩子是数组
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        unmountChildren(c1)
      }
      // 前后文本不一样
      if (c1 !== c2) {
        hostSetElementText(container, c2)
      }
    } else {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // 前后都是数组
          patchKeyedChildren(c1, c2, container)
        } else {
          // 之前是数组现在是null
          unmountChildren(c1)
        }
      } else {
        // 之前是文本
        if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
          hostSetElementText(container, '')
        }
        // 当前是数组
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          mountChildren(c2, container)
        }
      }
    }
  }
  // 比对元素
  let patchElement = (n1, n2, container) => {
    let el = n2.el = n1.el // 复用旧节点
    let oldProps = n1.props || {}
    let newProps = n2.props || {}
    patchProps(oldProps, newProps, el)
    patchChildren(n1, n2, el)
  }
  // 处理元素
  let processElement = (n1, n2, container, anchor = null) => {
    if (n1 == null) {
      // 初次挂载
      mountElement(n2, container, anchor)
    } else {
      // 更新
      patchElement(n1, n2, container)
    }
  }
  // 处理文本
  let processText = (n1, n2, container) => {
    if (n1 == null) {
      hostInsert(n2.el = hostCreateText(n2.children), container)
    }
  }
  // 判断是否是相同的虚拟节点
  let isSameVNode = (n1, n2) => {
    return n1.type === n2.type && n1.key === n2.key
  }
  // 卸载组件
  let unmount = (vnode) => {
    hostRemove(vnode.el)
  }
  // 比对两个虚拟节点
  let patch = (n1, n2, container, anchor = null) => {
    let { shapeFlag, type } = n2
    if (n1 && !isSameVNode(n1, n2)) { // 不是相同节点
      anchor = hostNextSibling(n1.el)
      unmount(n1)
      n1 = null
    }
    switch (type) {
      case Text:
        processText(n1, n2, container) // 处理文本
        break;
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          processElement(n1, n2, container, anchor) // 处理元素
        } else if (shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
          processComponent(n1, n2, container) // 处理组件
        }
        break;
    }
  }
  // 将虚拟节点渲染到容器中
  let render = (vnode, container) => {
    patch(null, vnode, container)
  }
  return {
    createApp: createAppApi(render)
  }
}