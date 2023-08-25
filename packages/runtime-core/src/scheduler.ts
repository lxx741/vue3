
let queue = []
// 将副作用存储起来
export function queueJob(job) {
  if (!queue.includes(job)) {
    queue.push(job)
    queueFlush()
  }
}

let isFlushing = false
// 创建异步副作用函数
function queueFlush() {
  if (!isFlushing) {
    isFlushing = true
    Promise.resolve().then(flushJobs)
  }
}

// 刷新执行副作用函数
function flushJobs() {
  isFlushing = false
  queue.sort((a, b) => a.id - b.id)
  queue.forEach(job => job())
  queue.length = 0
} 
