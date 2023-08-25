import { createVNode } from "./vnode"

// 创建应用的api
export function createAppApi(render) {
  return function createApp(rootComponent, rootProps) {
    const app = {
      _props: rootProps, // 应用对应的属性
      _component: rootComponent, // 应用对应的组件
      _container: null, // 应用的容器
      mount(container) { // 应用的挂载方法
        // 创建虚拟节点
        let vnode = createVNode(rootComponent, rootProps)
        // 将虚拟节点挂载到容器中
        render(vnode, container)
        app._container = container // 挂载完之后给应用的容器赋值
      }
    }
    return app
  }
}