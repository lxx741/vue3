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
let arr = [2, 3, 1, 5, 6, 8, 7, 9, 4];
// [1, 3, 4, 6, 7, 9] value => arr'
// [2, 1, 8, 4, 6, 7] index => result
// [2, 0, 1, 1, 3, 4, 4, 6, 1] => p

let res = getSequence(arr);
console.log(res);
