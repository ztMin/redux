import compose from './compose'

/**
 * 创建一个 store 增强器（enhancer）， 将传进来的中间件（middleware）作用于 dispatch 方法。
 * 这种设计可实现改造dispatch的方法，如实现异步操作（action）、全局操作（action）记录控制等。
 *
 * `redux-thunk` npm包就是Redux中间件（middleware）的一个典型案例.
 *
 * 异步的中间件（middleware），应该放在 store 组合（composition）器的最左边，即第一个
 *
 * 注意每个中间件（middleware）都会被传入包含`dispatch`和`getState`方法的对象参数。
 *
 * @param {...Function} middlewares 中间件（middleware）数组队列。
 * @returns {Function} 组合中间件（middleware）的 store 增强器（enhancer）方法。
 */

// 使用案例（redux-thunk）
// function thunk (middlewareAPI) {
//   let { dispatch, getState } = middlewareAPI;
//   return function fnNext (storeDispatch) {
//     return function reducer (action) {
//       if (typeof action === 'function') {
//         return action(dispatch, getState, extraArgument)
//       }
//       return storeDispatch(action);
//     }
//   }
// }
// applyMiddleware(thunk, thunk)
export default function applyMiddleware(...middlewares) {
  //增强器（enhancer）方法
  return createStore => (...args) => {
    const store = createStore(...args); // 创建store，由 ./createStore.js 第35行 可见 args 有 reducer 和 preloadedState 两个参数
    // 初始化 dispatch 方法，抛出在创建中间件期间调用 dispatch 的异常信息！
    let dispatch = () => {
      throw new Error(
        `您在创建中间件（middleware）时调用了 dispatch。 ` +
        `其他中间件（middleware）不能调用此 dispatch，所以你应该把该中间件方在最左边，即第一位`
      )
    }

    const middlewareAPI = {
      getState: store.getState,
      dispatch: (...args) => dispatch(...args)
    }

    // 对所有中间件传入 middlewareAPI 对象，让其缓存 dispatch 和 getState方法
    const chain = middlewares.map(middleware => middleware(middlewareAPI)); // [fnNext]
    dispatch = compose(...chain)(store.dispatch); // 组合所有中间件（middleware），并获取出新的 dispatch
    // 由上两行代码可见，中间件（middleware）必须遵循的结构如： middlewareAPI => storeDispatch => action => action

    return {
      ...store,
      dispatch
    }
  }
}
