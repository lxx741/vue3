export const enum ShapeFlags {
  ELEMENT = 1, // 元素
  FUNCTION_COMPONENT = 1 << 1, // 无状态组件（函数组件）
  STATEFUL_COMPONENT = 1 << 2, // 有状态组件
  TEXT_CHILDREN = 1 << 3, // 文本类型的孩子
  ARRAY_CHILDREN = 1 << 4, // 数组类型的孩子
  SLOTS_CHILDREN = 1 << 5, // 插槽类型的孩子
  TELEPORT = 1 << 6, // 传送框
  SUSPENSE = 1 << 7, // 异步组件
  COMPONENT_SHOULD_KEEP_ALIVE = 1 << 8, // 是否应该缓存组件
  COMPONENT_KEPT_ALIVE = 1 << 9, // 缓存的组件
  COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTION_COMPONENT // 组件（无状态组件、有状态组件）
}