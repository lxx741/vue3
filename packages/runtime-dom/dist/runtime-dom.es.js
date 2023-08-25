const assign = Object.assign;
const isArray = Array.isArray;
const isObject = (val) => typeof val == 'object' && val != null;
const isFunction = val => typeof val == 'function';
const isString = val => typeof val == 'string';
const isIntegerKey = val => parseInt(val) + '' == val;
// export const hasOwn = (target, key) => Object.prototype.hasOwnProperty.call(target, key)
const hasProperty = Reflect.has;
const hasChanged = (oldVal, newVal) => oldVal !== newVal;

var TrackOpTypes;
(function (TrackOpTypes) {
    TrackOpTypes[TrackOpTypes["GET"] = 0] = "GET";
})(TrackOpTypes || (TrackOpTypes = {}));
var TriggerOpTypes;
(function (TriggerOpTypes) {
    TriggerOpTypes[TriggerOpTypes["ADD"] = 0] = "ADD";
    TriggerOpTypes[TriggerOpTypes["SET"] = 1] = "SET";
})(TriggerOpTypes || (TriggerOpTypes = {}));

/**
 * 副作用函数
 * - 传入的回调函数中会使用响应式数据，即会触发代理对象的 get 方法
 * - 依赖收集：响应式属性和回调函数就会存在依赖关系（响应式对象的属性在回调中使用，回调函数中使用了响应式数据）
 * - 触发依赖：响应式数据变化会触发响应式对象的 set 方法
 * @param fn 回调函数
 * @param options 参数选项
 * @returns 响应式的effect
 */
function effect(fn, options = {}) {
    const effect = createReactiveEffect(fn, options);
    if (!options.lazy) {
        effect();
    }
    return effect;
}
let uid = 0;
let activeEffect; // 存储当前effect
const effectStack = []; // 解决effect嵌套调用问题
function createReactiveEffect(fn, options) {
    const effect = function reactiveEffect() {
        // 去重effect，不要存储相同的 effect
        if (!effectStack.includes(effect)) {
            try {
                effectStack.push(effect);
                activeEffect = effect;
                return fn();
            }
            finally {
                effectStack.pop();
                activeEffect = effectStack[effectStack.length - 1];
            }
        }
    };
    effect.id = uid++;
    effect._isEffect = true;
    effect.raw = fn;
    effect.options = options;
    return effect;
}
// 用来存储哪个对象(target)中的哪个属性(dep)对应的副作用(effect)
let targetMap = new WeakMap;
// 收集依赖：将响应式数据与副作用函数关联起来
function track(target, type, key) {
    // 响应式数据不在effect中使用就不用关联effect
    if (activeEffect == null)
        return;
    let depsMap = targetMap.get(target);
    if (!depsMap) {
        targetMap.set(target, (depsMap = new Map));
    }
    let effects = depsMap.get(key);
    if (!effects) {
        depsMap.set(key, (effects = new Set));
    }
    effects.add(activeEffect);
}
function trigger(target, type, key, newVal, oldVal) {
    let depsMap = targetMap.get(target);
    if (!depsMap)
        return; // target 没有在 effect 中使用，直接返回
    let newEffects = new Set; // 存储将要被执行的 effect
    const addEffect = (effects) => {
        if (effects) {
            effects.forEach(effect => newEffects.add(effect));
        }
    };
    // 修改的是 数组的 length 属性
    if (key == 'length' && isArray(target)) {
        depsMap.forEach((effects, key) => {
            if (key == 'length' || key > newVal) {
                // effect 中使用了数组的 length 属性或者数组的索引，改变的数组的长度小于使用的索引
                addEffect(effects);
            }
        });
    }
    else {
        if (key != null) { // 修改对象属性
            addEffect(depsMap.get(key));
        }
        // effect 中使用了数组本身(会收集每个索引和length属性)，修改了数组不存在的索引(新增了大于数组长度的索引)
        if (type == TriggerOpTypes.ADD && isArray(target) && isIntegerKey(key)) {
            addEffect(depsMap.get('length'));
        }
    }
    newEffects.forEach((effect) => {
        if (effect.options.scheduler) {
            effect.options.scheduler(effect);
        }
        else {
            effect();
        }
    });
}

function createGetter(isReadonly = false, isShallow = false) {
    return function get(target, key, receiver) {
        let res = Reflect.get(target, key, receiver);
        if (!isReadonly) { // 不是仅读，可能会改，要收集依赖
            track(target, TrackOpTypes.GET, key); // effect中取了哪个对象中的哪个属性
        }
        if (isShallow)
            return res; // 是浅的直接返回第一层属性的值
        if (isObject(res)) { // 不是浅的且是对象进一步进行对象的代理，所以vue3是懒代理模式，而vue2是一上来就把data中的数据递归定义成响应式数据
            return isReadonly ? readonly(res) : reactive(res);
        }
        return res;
    };
}
function createSetter(isShallow = false) {
    return function set(target, key, val, receiver) {
        let oldVal = target[key];
        let hasKey = isArray(target) && isIntegerKey(key)
            ? Number(key) < target.length // 修改的key是数组的索引，并且已存在该索引，即为修改该索引上的值
            : hasProperty(target, key); // 对象上是否存在该属性，存在为修改，不存在为新增
        let res = Reflect.set(target, key, val, receiver);
        if (!hasKey) {
            // 新增：对象上没有该属性，数组上没有该索引
            trigger(target, TriggerOpTypes.ADD, key, val);
        }
        else if (hasChanged(oldVal, val)) {
            // 修改：对象上有该属性且值不相等，数组有该索引且值不相等
            trigger(target, TriggerOpTypes.SET, key, val);
        }
        return res;
    };
}
const reactiveGet = createGetter();
const shallowReactiveGet = createGetter(false, true);
const readonlyGet = createGetter(true);
const shallowReadonlyGet = createGetter(true, true);
const reactiveSet = createSetter();
const shallowReactiveSet = createSetter(true);
const reactiveHandler = {
    get: reactiveGet,
    set: reactiveSet
};
const shallowReactiveHandler = {
    get: shallowReactiveGet,
    set: shallowReactiveSet
};
const readonlyHandler = {
    get: readonlyGet,
    set(target) {
        console.warn(target, `为仅读对象，不可设置`);
    }
};
const shallowReadonlyHandler = {
    get: shallowReadonlyGet,
    set(target) {
        console.warn(target, `为仅读对象，不可设置`);
    }
};

// 创建代理对象
function reactive(target) {
    return reacteReactiveObject(target, false, reactiveHandler);
}
// 创建浅的代理对象
function shallowReactive(target) {
    return reacteReactiveObject(target, false, shallowReactiveHandler);
}
// 创建仅读代理对象
function readonly(target) {
    return reacteReactiveObject(target, true, readonlyHandler);
}
// 创建浅的仅读代理对象
function shallowReadonly(target) {
    return reacteReactiveObject(target, true, shallowReadonlyHandler);
}
const reactiveMap = new WeakMap; // 缓存代理对象
const readonlyMap = new WeakMap; // 缓存仅读代理对象
/**
 * 创建响应式对象
 * @param target 被代理对象
 * @param isReadonly 是否仅读
 * @param baseHandler 代理对象的处理器对象
 */
function reacteReactiveObject(target, isReadonly, baseHandler) {
    if (!isObject(target))
        return target; // 被代理的数据需要是个对象，否则直接返回该数据
    let proxyMap = isReadonly ? readonlyMap : reactiveMap;
    let existProxy = proxyMap.get(target);
    if (existProxy)
        return existProxy; // 已经被代理过的对象直接返回
    let proxy = new Proxy(target, baseHandler);
    proxyMap.set(target, proxy);
    return proxy;
}

function ref(rawVal) {
    return createRef(rawVal);
}
function shallowRef(rawVal) {
    return createRef(rawVal, true);
}
const convert = val => isObject(val) ? reactive(val) : val;
class RefImpl {
    rawValue;
    shallow;
    _value;
    __v_isRef = true;
    constructor(rawValue, shallow) {
        this.rawValue = rawValue;
        this.shallow = shallow;
        this._value = shallow ? rawValue : convert(rawValue);
    }
    get value() {
        track(this, TrackOpTypes.GET, 'value');
        return this._value;
    }
    set value(newVal) {
        if (hasChanged(newVal, this._value)) {
            this._value = this.shallow ? newVal : convert(newVal);
            trigger(this, TriggerOpTypes.SET, 'value', newVal);
        }
    }
}
function createRef(rawVal, shallow = false) {
    return new RefImpl(rawVal, shallow);
}
class ObjectRefImpl {
    target;
    key;
    __v_isRef = true;
    constructor(target, key) {
        this.target = target;
        this.key = key;
    }
    get value() {
        return this.target[this.key];
    }
    set value(newVal) {
        this.target[this.key] = newVal;
    }
}
// 将对象中的某个属性的值变成响应式的数据
function toRef(target, key) {
    return new ObjectRefImpl(target, key);
}
// 将对象中多个属性值批量变成响应式的数据
function toRefs(obj) {
    let res = isArray(obj) ? new Array(obj.length) : {};
    for (let key in obj) {
        res[key] = toRef(obj, key);
    }
    return res;
}

class CompuntedRefImpl {
    getter;
    setter;
    _dirty = true; // 默认为true，脏的，做缓存
    _value; // 保存计算属性的值
    effect; // 副作用函数
    constructor(getter, setter) {
        this.getter = getter;
        this.setter = setter;
        // 默认创建一个effect
        this.effect = effect(getter, {
            lazy: true,
            scheduler: () => {
                if (!this._dirty) {
                    this._dirty = true;
                    trigger(this, TriggerOpTypes.SET, 'value'); // 触发effect
                }
            }
        });
    }
    get value() {
        if (this._dirty) {
            this._value = this.effect();
            this._dirty = false;
        }
        track(this, TrackOpTypes.GET, 'value'); // 收集 effect
        return this._value;
    }
    set value(newVal) {
        this.setter(newVal);
    }
}
// 计算属性，可能接收一个函数或一个对象(包括getter、setter)
function computed(getterOrOptions) {
    let getter, setter;
    if (isFunction(getterOrOptions)) {
        getter = getterOrOptions;
        setter = () => { };
    }
    else {
        getter = getterOrOptions.get;
        setter = getterOrOptions.set;
    }
    // 创建一个计算属性的ref
    return new CompuntedRefImpl(getter, setter);
}

// 更新元素的属性
const patchAttr = (el, key, nextVal) => {
    if (nextVal == null) { // 没有新值
        el.removeAttribute(key);
    }
    else { // 新旧值不等
        el.setAttribute(key, nextVal);
    }
};

// 设置元素的类名
const patchClass = (el, val) => {
    if (val == null) {
        val = '';
    }
    el.className = val;
};

// 更新事件
const patchEvent = (el, key, nextVal) => {
    // 缓存元素上的事件
    let invokers = el._vei || (el._vei = {});
    let existFn = invokers[key]; // 是否已经绑定过事件
    if (nextVal && existFn) { // 绑定过则需要给元素更新绑定的事件
        existFn.fn = nextVal;
    }
    else {
        const eventName = key.slice(2).toLowerCase();
        if (nextVal) { // 第一次给元素绑定事件，并存到缓存中
            let invoker = invokers[key] = createInvoker(nextVal);
            el.addEventListener(eventName, invoker);
        }
        else { // 元素卸载事件
            el.removeEventListener(eventName, existFn);
            invokers[key] = null;
        }
    }
};
function createInvoker(fn) {
    const invoker = (e) => {
        invoker.fn(e);
    };
    invoker.fn = fn;
    return invoker;
}

// 比对设置style
const patchStyle = (el, prevVal, nextVal) => {
    const style = el.style;
    if (nextVal == null) { // 新的没有
        el.removeAttribute('style');
    }
    else {
        if (prevVal) {
            for (let key in prevVal) { // 老的有，新的没有，删掉老的
                if (nextVal[key] == null) {
                    style[key] = '';
                }
            }
        }
        // 将新的样式设置到元素上
        for (let key in nextVal) { // {style: {color: 'red'}}
            style[key] = nextVal[key];
        }
    }
};

// 比较更新元素属性，attr、class、style、事件等
const patchProp = (el, key, prevVal, nextVal) => {
    switch (key) {
        case 'class':
            patchClass(el, nextVal);
            break;
        case 'style':
            patchStyle(el, prevVal, nextVal);
            break;
        default:
            if (/^on[^a-z]/.test(key)) {
                patchEvent(el, key, nextVal);
            }
            else {
                patchAttr(el, key, nextVal);
            }
            break;
    }
};

// 创建实例的代理处理对象
const publicInstanceProxyHandler = {
    get({ _: instance }, key) {
        if (key[0] == '$')
            return; // 不能访问$开头的属性
        let { setupState, props, data } = instance;
        if (hasProperty(setupState, key)) {
            return setupState[key];
        }
        else if (hasProperty(props, key)) {
            return props[key];
        }
        else if (hasProperty(data, key)) {
            return props[key];
        }
    },
    set({ _: instance }, key, val) {
        return true;
    },
};

// 根据虚拟节点创建组件实例
function createComponentInstance(vnode) {
    let instance = {
        vnode,
        type: vnode.type,
        data: {},
        props: {},
        attrs: {},
        slots: {},
        setupState: {},
        isMounted: false,
        ctx: {},
        render: null
    };
    instance.ctx = { _: instance };
    return instance;
}
// 根据虚拟节点解析出实例上的各个属性
function setupComponent(instance) {
    let { props, children } = instance.vnode;
    instance.props = props;
    instance.children = children;
    let isStateful = instance.vnode.shapeFlag & 4 /* ShapeFlags.STATEFUL_COMPONENT */;
    if (isStateful) {
        setupStatefulComponent(instance);
    }
}
// 启动有状态的组件
function setupStatefulComponent(instance) {
    instance.proxy = new Proxy(instance.ctx, publicInstanceProxyHandler);
    let Component = instance.type;
    let { setup } = Component;
    if (setup) {
        let setupContext = createSetupContext(instance);
        let setupResult = setup(instance.props, setupContext);
        handleSetupResult(instance, setupResult);
    }
    else {
        finishComponentSetup(instance);
    }
}
// 处理setup的返回值
function handleSetupResult(instance, setupResult) {
    if (isFunction(setupResult)) {
        instance.render = setupResult;
    }
    else if (isObject(setupResult)) {
        instance.setupState = setupResult;
    }
    finishComponentSetup(instance);
}
// 完成组件的启动，即完善instance对象上的各个属性
function finishComponentSetup(instance) {
    let Component = instance.type;
    if (!instance.render) {
        if (!Component.render && Component.template) ;
        instance.render = Component.render;
    }
}
// 创建setup的上下文
function createSetupContext(instance) {
    return {
        attrs: instance.attrs,
        slots: instance.slots,
        emit: () => { },
        expose: () => { }
    };
}

/**
 * 创建虚拟节点
 * @param type 组件或元素
 * @param props 属性
 * @param children 孩子
 */
function createVNode(type, props, children = null) {
    let shapeFlag = isString(type) ? 1 /* ShapeFlags.ELEMENT */ : isObject(type) ? 4 /* ShapeFlags.STATEFUL_COMPONENT */ : 0;
    let vnode = {
        __v_isVnode: true,
        type,
        props,
        children,
        el: null,
        key: props && props.key,
        shapeFlag,
        component: null // 存放组件对应的实例
    };
    normallizeChildren(vnode, children);
    return vnode;
}
// 判断是否是虚拟节点
function isVnode(vnode) {
    return vnode.__v_isVnode;
}
// 标记虚拟节点及其孩子的类型
function normallizeChildren(vnode, children) {
    let type = 0;
    if (children == null) ;
    else if (isArray(children)) {
        type = 16 /* ShapeFlags.ARRAY_CHILDREN */;
    }
    else {
        type = 8 /* ShapeFlags.TEXT_CHILDREN */;
    }
    vnode.shapeFlag |= type;
}
const Text = Symbol('Text'); // 字符串文本类型
// 将字符串转换成一个虚拟节点
function normallizeVNode(child) {
    if (isObject(child))
        return child;
    return createVNode(Text, null, String(child));
}

// 创建应用的api
function createAppApi(render) {
    return function createApp(rootComponent, rootProps) {
        const app = {
            _props: rootProps,
            _component: rootComponent,
            _container: null,
            mount(container) {
                // 创建虚拟节点
                let vnode = createVNode(rootComponent, rootProps);
                // 将虚拟节点挂载到容器中
                render(vnode, container);
                app._container = container; // 挂载完之后给应用的容器赋值
            }
        };
        return app;
    };
}

let queue = [];
// 将副作用存储起来
function queueJob(job) {
    if (!queue.includes(job)) {
        queue.push(job);
        queueFlush();
    }
}
let isFlushing = false;
// 创建异步副作用函数
function queueFlush() {
    if (!isFlushing) {
        isFlushing = true;
        Promise.resolve().then(flushJobs);
    }
}
// 刷新执行副作用函数
function flushJobs() {
    isFlushing = false;
    queue.sort((a, b) => a.id - b.id);
    queue.forEach(job => job());
    queue.length = 0;
}

// 创建一个渲染器
function createRenderer(rendererOptions) {
    let { createElement: hostCreateElement, remove: hostRemove, insert: hostInsert, setElementText: hostSetElementText, querySelector: hostQuerySelector, createText: hostCreateText, setText: hostSetText, patchProp: hostPatchProp, nextSibling: hostNextSibling } = rendererOptions;
    // 启动副作用函数
    let setupRendererEffect = (instance, container) => {
        // 初次渲染
        instance.update = effect(function componentEffect() {
            if (instance.isMounted) {
                // 更新
                let prevTree = instance.subTree;
                let proxyToUse = instance.proxy;
                let nextTree = instance.render.call(proxyToUse, proxyToUse);
                patch(prevTree, nextTree, container);
            }
            else {
                let proxyToUse = instance.proxy;
                let subTree = instance.subTree = instance.render.call(proxyToUse, proxyToUse);
                patch(null, subTree, container);
                instance.isMounted = true;
            }
        }, {
            scheduler: queueJob
        });
    };
    // 挂载组件
    let mountComponent = (vnode, container) => {
        // 创建实例
        let instance = (vnode.component = createComponentInstance(vnode));
        // 给实例赋值一系列属性
        setupComponent(instance);
        // 调用 render方法
        setupRendererEffect(instance, container);
    };
    // 处理组件
    let processComponent = (n1, n2, container) => {
        if (n1 == null) {
            // 组件初次渲染
            mountComponent(n2, container);
        }
    };
    // 处理孩子
    let mountChildren = (children, container) => {
        for (let i = 0; i < children.length; i++) {
            let child = normallizeVNode(children[i]);
            patch(null, child, container);
        }
    };
    // 挂载元素
    let mountElement = (vnode, container, anchor = null) => {
        let { type, props, children, shapeFlag } = vnode;
        let el = vnode.el = hostCreateElement(type);
        if (props) {
            for (let key in props) {
                hostPatchProp(el, key, null, props[key]);
            }
        }
        if (shapeFlag & 8 /* ShapeFlags.TEXT_CHILDREN */) {
            hostSetElementText(el, children);
        }
        else if (shapeFlag & 16 /* ShapeFlags.ARRAY_CHILDREN */) {
            mountChildren(children, el);
        }
        hostInsert(el, container, anchor);
    };
    // 比对节点属性
    let patchProps = (oldProps, newProps, el) => {
        if (oldProps !== newProps) {
            for (let key in newProps) {
                let prev = oldProps[key];
                let next = newProps[key];
                if (prev !== next) { // 新老值不一样
                    patchProp(el, key, prev, next);
                }
            }
            for (let key in oldProps) {
                if (!(key in newProps)) { // 老的里有  新的里没有  删除老的
                    patchProp(el, key, oldProps[key], null);
                }
            }
        }
    };
    let unmountChildren = (children) => {
        children.forEach(child => unmount(child));
    };
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
                    }
                    else {
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
        let i = 0;
        let e1 = c1.length - 1;
        let e2 = c2.length - 1;
        // sync from start
        while (i <= e1 && i <= e2) {
            let n1 = c1[i];
            let n2 = c2[i];
            if (isSameVNode(n1, n2)) {
                patch(n1, n2, container);
            }
            else {
                break;
            }
            i++;
        }
        // sync from end
        while (i <= e1 && i <= e2) {
            let n1 = c1[e1];
            let n2 = c2[e2];
            if (isSameVNode(n1, n2)) {
                patch(n1, n2, container);
            }
            else {
                break;
            }
            e1--;
            e2--;
        }
        // 新的多，需要插入
        if (i > e1) {
            if (i <= e2) {
                let nexPos = e2 + 1;
                let anchor = nexPos < c2.length ? c2[nexPos].el : null; // 参照物，是往后插入还是往前插入
                while (i <= e2) {
                    patch(null, c2[i], container, anchor);
                    i++;
                }
            }
        }
        else if (i > e2) { // 老的多，需要删除
            while (i <= e1) {
                unmount(c1[i]);
                i++;
            }
        }
        else {
            let s1 = i;
            let s2 = i;
            // 用新的做映射表
            let keyToNewIndexMap = new Map;
            for (let i = s2; i <= e2; i++) {
                let vnode = c2[i];
                keyToNewIndexMap.set(vnode.key, i); // 新key => 新index
            }
            let toBePachted = e2 - s2 + 1; // 将要进行比对的节点总个数
            let newIndexToOldIndex = new Array(toBePachted).fill(0); // 做一个索引，数组项为0则没被比对过，应该插入
            // 循环旧节点找出可复用的节点
            for (let i = s1; i <= e1; i++) {
                let vnode = c1[i];
                let newIndex = keyToNewIndexMap.get(vnode.key);
                if (newIndex == undefined) { // 没在新列表中找到，则删除旧节点
                    unmount(vnode);
                }
                else {
                    newIndexToOldIndex[newIndex - s2] = i + 1; // 新老索引的关系
                    patch(vnode, c2[newIndex], container); // 找到了，就比对
                }
            }
            let increasingNewIndexSequence = getSequence(newIndexToOldIndex); // [1,2]
            let j = increasingNewIndexSequence.length - 1;
            // 从后往前插入  [5,3,4,0]
            for (let i = toBePachted - 1; i >= 0; i--) {
                let currentIndex = i + s2;
                let vnode = c2[currentIndex];
                let anchor = currentIndex + 1 < c2.length ? c2[currentIndex + 1].el : null;
                if (newIndexToOldIndex[i] == 0) { // 没被比对过，直接新建插入
                    patch(null, vnode, container, anchor);
                }
                else { // 移动插入
                    // i => 3 2 1 0
                    // j => 1 0 
                    if (i != increasingNewIndexSequence[j]) {
                        hostInsert(vnode.el, container, anchor);
                    }
                    else {
                        j--;
                    }
                }
            }
        }
    };
    // 比对孩子
    let patchChildren = (n1, n2, container) => {
        let c1 = n1.children;
        let c2 = n2.children;
        let prevShapeFlag = n1.shapeFlag;
        let shapeFlag = n2.shapeFlag;
        // 当前是文本
        if (shapeFlag & 8 /* ShapeFlags.TEXT_CHILDREN */) {
            // 之前孩子是数组
            if (prevShapeFlag & 16 /* ShapeFlags.ARRAY_CHILDREN */) {
                unmountChildren(c1);
            }
            // 前后文本不一样
            if (c1 !== c2) {
                hostSetElementText(container, c2);
            }
        }
        else {
            if (prevShapeFlag & 16 /* ShapeFlags.ARRAY_CHILDREN */) {
                if (shapeFlag & 16 /* ShapeFlags.ARRAY_CHILDREN */) {
                    // 前后都是数组
                    patchKeyedChildren(c1, c2, container);
                }
                else {
                    // 之前是数组现在是null
                    unmountChildren(c1);
                }
            }
            else {
                // 之前是文本
                if (prevShapeFlag & 8 /* ShapeFlags.TEXT_CHILDREN */) {
                    hostSetElementText(container, '');
                }
                // 当前是数组
                if (shapeFlag & 16 /* ShapeFlags.ARRAY_CHILDREN */) {
                    mountChildren(c2, container);
                }
            }
        }
    };
    // 比对元素
    let patchElement = (n1, n2, container) => {
        let el = n2.el = n1.el; // 复用旧节点
        let oldProps = n1.props || {};
        let newProps = n2.props || {};
        patchProps(oldProps, newProps, el);
        patchChildren(n1, n2, el);
    };
    // 处理元素
    let processElement = (n1, n2, container, anchor = null) => {
        if (n1 == null) {
            // 初次挂载
            mountElement(n2, container, anchor);
        }
        else {
            // 更新
            patchElement(n1, n2);
        }
    };
    // 处理文本
    let processText = (n1, n2, container) => {
        if (n1 == null) {
            hostInsert(n2.el = hostCreateText(n2.children), container);
        }
    };
    // 判断是否是相同的虚拟节点
    let isSameVNode = (n1, n2) => {
        return n1.type === n2.type && n1.key === n2.key;
    };
    // 卸载组件
    let unmount = (vnode) => {
        hostRemove(vnode.el);
    };
    // 比对两个虚拟节点
    let patch = (n1, n2, container, anchor = null) => {
        let { shapeFlag, type } = n2;
        if (n1 && !isSameVNode(n1, n2)) { // 不是相同节点
            anchor = hostNextSibling(n1.el);
            unmount(n1);
            n1 = null;
        }
        switch (type) {
            case Text:
                processText(n1, n2, container); // 处理文本
                break;
            default:
                if (shapeFlag & 1 /* ShapeFlags.ELEMENT */) {
                    processElement(n1, n2, container, anchor); // 处理元素
                }
                else if (shapeFlag & 4 /* ShapeFlags.STATEFUL_COMPONENT */) {
                    processComponent(n1, n2, container); // 处理组件
                }
                break;
        }
    };
    // 将虚拟节点渲染到容器中
    let render = (vnode, container) => {
        patch(null, vnode, container);
    };
    return {
        createApp: createAppApi(render)
    };
}

// 根据各种参数创建虚拟节点
function h(type, propOrChildren, children) {
    let len = arguments.length;
    // 类型 + 属性 --- h('div', {})
    // 类型 + 孩子 --- h('div','lxx')、h('div',['lxx','asd'])
    if (len == 2) {
        if (isObject(propOrChildren) && !isArray(propOrChildren)) {
            if (isVnode(propOrChildren)) { // h('div',h('p','lxx'))
                return createVNode(type, null, [propOrChildren]);
            }
            else { // h('div', {}) 
                return createVNode(type, propOrChildren);
            }
        }
        else { // h('div',['lxx','asd'])
            return createVNode(type, null, propOrChildren);
        }
    }
    else {
        if (len > 3) {
            children = Array.prototype.slice.call(arguments, 2);
        }
        else if (len == 3 && isVnode(children)) {
            children = [children];
        }
        return createVNode(type, propOrChildren, children);
    }
}

const nodeOps = {
    createElement: tarName => document.createElement(tarName),
    remove: (child) => {
        let parent = child.parentNode;
        if (parent) {
            parent.removeChild(child);
        }
    },
    // anchor 为 null 时为 appendChild
    insert: (child, parent, anchor) => {
        parent.insertBefore(child, anchor);
    },
    setElementText: (el, text) => {
        el.textContent = text;
    },
    querySelector: selector => document.querySelector(selector),
    createText: text => document.createTextNode(text),
    setText: (node, text) => node.nodeValue = text,
    nextSibling: node => node.nextSibling
};

// runtime-dom主要用在浏览器端，操作节点和属性的操作
// 提供渲染时需要的节点和属性操作
const rendererOptions = assign(nodeOps, { patchProp });
function createApp(rootComponent, rootProps = null) {
    // 使用 rendererOptions 创建一个渲染器，通过渲染器创建一个应用
    const app = createRenderer(rendererOptions).createApp(rootComponent, rootProps);
    let { mount } = app;
    app.mount = (container) => {
        container = nodeOps.querySelector(container);
        container.innerHTML = '';
        mount(container);
    };
    return app;
}

export { computed, createApp, createRenderer, effect, h, reactive, readonly, ref, shallowReactive, shallowReadonly, shallowRef, toRef, toRefs };
//# sourceMappingURL=runtime-dom.es.js.map
