- reactive: 创建一个响应式数据，主要针对引用类型的数据
- ref: 创建一个响应式数据，主要用于基本数据类型的数据
- effect: 创建一个副作用函数，回调中的响应式数据会跟该副作用函数一一对应，即依赖收集
- toRef: 将响应式对象的某个属性的值(一般是基本数据类型)转化成响应式对象
- toRefs: 将响应式对象中的所有属性的值(一般是基本数据类型)转化成响应式对象
- computed: 计算属性，是一个 effect，具有缓存效果
