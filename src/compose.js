/**
 * 从右到做运行单参数函数。最右边的函数可以接受多个参数，因为它返回复合函数的参数.
 *
 * @param {...Function} funcs 组合函数数组
 * @returns {Function} 获得 从右向左组合函数. 例如：compose(f, g, h) 的到 (...args) => f(g(h(...args)))
 */

export default function compose(...funcs) {
  if (funcs.length === 0) {
    return arg => arg
  }

  if (funcs.length === 1) {
    return funcs[0]
  }

  return funcs.reduce((a, b) => (...args) => a(b(...args)))
}
