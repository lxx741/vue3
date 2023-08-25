const isArray = Array.isArray;
const isObject = (val) => typeof val == 'object' && val != null;
const isFunction = val => typeof val == 'function';
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
    newEffects.forEach((effecf) => {
        if (effecf.options.scheduler) {
            effecf.options.scheduler();
        }
        else {
            effecf();
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

export { computed, effect, reactive, readonly, ref, shallowReactive, shallowReadonly, shallowRef, toRef, toRefs };
//# sourceMappingURL=reactivity.es.js.map
