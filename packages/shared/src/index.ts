export const assign = Object.assign
export const isArray = Array.isArray
export const isObject = (val) => typeof val == 'object' && val != null
export const isFunction = val => typeof val == 'function'
export const isNumber = val => typeof val == 'number'
export const isString = val => typeof val == 'string'
export const isIntegerKey = val => parseInt(val) + '' == val
// export const hasOwn = (target, key) => Object.prototype.hasOwnProperty.call(target, key)
export const hasProperty = Reflect.has
export const hasChanged = (oldVal, newVal) => oldVal !== newVal