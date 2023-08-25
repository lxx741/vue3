function sum(a, b, c, d, e) {
  return a + b + c + d + e;
}

const currying = (fn, arr = []) => {
  let len = fn.length;
  return (...args) => {
    arr = [...arr, ...args];
    if (arr.length < len) {
      return currying(fn, arr);
    } else {
      return fn(...arr);
    }
  };
};

let r = currying(sum)(1, 2)(3, 4)(5);
console.log(r);
