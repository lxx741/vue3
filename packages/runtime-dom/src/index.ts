// runtime-dom主要用在浏览器端，操作节点和属性的操作

import { createRenderer } from "@vue/runtime-core";
import { assign } from "@vue/shared";
import { nodeOps } from "./nodeOps";
import { patchProp } from "./patchProp";

// 提供渲染时需要的节点和属性操作
const rendererOptions = assign(nodeOps, { patchProp })

export function createApp(rootComponent, rootProps = null) {
  // 使用 rendererOptions 创建一个渲染器，通过渲染器创建一个应用
  const app = createRenderer(rendererOptions).createApp(rootComponent, rootProps)
  let { mount } = app
  app.mount = (container) => {
    container = nodeOps.querySelector(container)
    container.innerHTML = ''
    mount(container)
  }
  return app
}

export * from '@vue/runtime-core'