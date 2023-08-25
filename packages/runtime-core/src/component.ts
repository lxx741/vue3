import { isFunction, isObject } from "@vue/shared"
import { publicInstanceProxyHandler } from "./componentPublicInstance"
import { ShapeFlags } from "./shapeFlag"

// 根据虚拟节点创建组件实例
export function createComponentInstance(vnode) {
  let instance = {
    vnode,
    type: vnode.type,
    data: {},
    props: {}, // 组件声明接收的属性
    attrs: {}, // 组件没声明接收的属性
    slots: {},
    setupState: {}, // 存储setup的返回值(对象类型)
    isMounted: false,
    ctx: {},
    render: null
  }
  instance.ctx = { _: instance }

  return instance
}

// 根据虚拟节点解析出实例上的各个属性
export function setupComponent(instance) {
  let { props, children } = instance.vnode

  instance.props = props
  instance.children = children

  let isStateful = instance.vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT
  if (isStateful) {
    setupStatefulComponent(instance)
  }
}

// 启动有状态的组件
function setupStatefulComponent(instance) {
  instance.proxy = new Proxy(instance.ctx, publicInstanceProxyHandler)
  let Component = instance.type
  let { setup } = Component

  if (setup) {
    let setupContext = createSetupContext(instance)
    let setupResult = setup(instance.props, setupContext)
    handleSetupResult(instance, setupResult)
  } else {
    finishComponentSetup(instance)
  }
}

// 处理setup的返回值
function handleSetupResult(instance, setupResult) {
  if (isFunction(setupResult)) {
    instance.render = setupResult
  } else if (isObject(setupResult)) {
    instance.setupState = setupResult
  }
  finishComponentSetup(instance)
}

// 完成组件的启动，即完善instance对象上的各个属性
function finishComponentSetup(instance) {
  let Component = instance.type
  if (!instance.render) {
    if (!Component.render && Component.template) {
      // 模板编译
    }
    instance.render = Component.render
  }
}

// 创建setup的上下文
function createSetupContext(instance) {
  return {
    attrs: instance.attrs,
    slots: instance.slots,
    emit: () => { },
    expose: () => { }
  }
}