import $$observable from 'symbol-observable'

import ActionTypes from './utils/actionTypes'
import isPlainObject from './utils/isPlainObject'

/**
 * 创建 Redux 的 store 存储器，将状态（state）树存储在内存中.
 * `dispatch()` 方法是唯一可以修改状态（state）树的方法.
 *
 * 建议应用中只有一个store
 * 可以使用 combineReducers 将 reducer 组合成一个 reducer 函数.
 *
 * @param {Function} reducer 在`dispatch`方法调用获取下一个状态（state）树
 *
 * @param {any} [preloadedState] 初始化状态（state）树
 * 如使用 `combineReducers` 管理reducer，
 * 则初始状态（state）树应与combineReducers的键值对匹配
 *
 * @param {Function} [enhancer] store增强器. 你可以使用该增强器实现一些中间件，Redux提供的增强器有 applyMiddleware
 *
 * @returns {Store} 返回 Redux 的 store 对象, 可以使用 getState 获取 状态（state）树，使用 dispatch 方法执行 actions 修改 状态（state）树；
 * 还可以使用 subscribe 方法监听状态（state）树变动
 */
export default function createStore(reducer, preloadedState, enhancer) {
  if (typeof preloadedState === 'function' && typeof enhancer === 'undefined') {
    enhancer = preloadedState
    preloadedState = undefined
  }

  if (typeof enhancer !== 'undefined') {
    if (typeof enhancer !== 'function') {
      throw new Error('您传的增强器不是函数')
    }

    return enhancer(createStore)(reducer, preloadedState)
  }

  if (typeof reducer !== 'function') {
    throw new Error('您传的reducer不是函数')
  }

  let currentReducer = reducer; // 当前reducer缓存器（执行action修改状态（state）树动作的函数）
  let currentState = preloadedState; // 当前状态（state）树缓存器
  let currentListeners = []; // 当前监听函数缓存器
  let nextListeners = currentListeners; // 下一步监听函数缓存器
  let isDispatching = false; // 是否是在执行reducer中

  function ensureCanMutateNextListeners() {
    if (nextListeners === currentListeners) {
      nextListeners = currentListeners.slice()
    }
  }

  /**
   * 读取当前的状态（state）树
   *
   * @returns {any} 当前的状态（state）树
   */
  function getState() {
    if (isDispatching) { //运行reducer方法时已经传入状态（state）树，避免使用store.getState方法调用
      throw new Error(
        '执行 reducer 时不能调用 `getState` 方法，' +
          'state 已经注入到 reducer 中' +
          '请从 reducer 中读取，而不是 store.'
      )
    }

    return currentState
  }

  /**
   * Adds a change listener. It will be called any time an action is dispatched,
   * and some part of the state tree may potentially have changed. You may then
   * call `getState()` to read the current state tree inside the callback.
   *
   * You may call `dispatch()` from a change listener, with the following
   * caveats:
   *
   * 1. The subscriptions are snapshotted just before every `dispatch()` call.
   * If you subscribe or unsubscribe while the listeners are being invoked, this
   * will not have any effect on the `dispatch()` that is currently in progress.
   * However, the next `dispatch()` call, whether nested or not, will use a more
   * recent snapshot of the subscription list.
   *
   * 2. The listener should not expect to see all state changes, as the state
   * might have been updated multiple times during a nested `dispatch()` before
   * the listener is called. It is, however, guaranteed that all subscribers
   * registered before the `dispatch()` started will be called with the latest
   * state by the time it exits.
   *
   * @param {Function} listener A callback to be invoked on every dispatch.
   * @returns {Function} A function to remove this change listener.
   */
  function subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('您传的监听器不是函数')
    }

    if (isDispatching) {
      throw new Error(
        '在执行 reducer 期间，不能添加监听器 ' +
          'If you would like to be notified after the store has been updated, subscribe from a ' +
          'component and invoke store.getState() in the callback to access the latest state. ' +
          'See https://redux.js.org/api-reference/store#subscribe(listener) for more details.'
      )
    }

    let isSubscribed = true

    ensureCanMutateNextListeners()
    nextListeners.push(listener)

    return function unsubscribe() {
      if (!isSubscribed) {
        return
      }

      if (isDispatching) {
        throw new Error(
          '在 执行 reducer 期间，不能删除 listener（监听器）； '
        )
      }

      isSubscribed = false

      ensureCanMutateNextListeners()
      const index = nextListeners.indexOf(listener)
      nextListeners.splice(index, 1)
    }
  }

  /**
   * 执行action操作；这是改变状态（state）树的唯一途径.
   *
   * 调用 `reducer` 方法，传入 当前状态（state）树 和 action，
   * `reducer` 方法返回的值作为下一个状态（state）树；
   * 并循环listeners执行监听器通知
   *
   * The base implementation only supports plain object actions. If you want to
   * dispatch a Promise, an Observable, a thunk, or something else, you need to
   * wrap your store creating function into the corresponding middleware. For
   * example, see the documentation for the `redux-thunk` package. Even the
   * middleware will eventually dispatch plain object actions using this method.
   *
   * @param {Object} action A plain object representing “what changed”. It is
   * a good idea to keep actions serializable so you can record and replay user
   * sessions, or use the time travelling `redux-devtools`. An action must have
   * a `type` property which may not be `undefined`. It is a good idea to use
   * string constants for action types.
   *
   * @returns {Object} For convenience, the same action object you dispatched.
   *
   * Note that, if you use a custom middleware, it may wrap `dispatch()` to
   * return something else (for example, a Promise you can await).
   */
  function dispatch(action) {
    if (!isPlainObject(action)) {
      throw new Error(
        'Action 必须是普通的 Object 对象； ' +
          '可以使用自定义的中间件实现异步 Action 操作.'
      )
    }

    if (typeof action.type === 'undefined') {
      throw new Error(
        'Action必须有type熟悉. '
      )
    }

    if (isDispatching) {
      throw new Error('不能同时执行多个 Action.')
    }

    try {
      isDispatching = true
      currentState = currentReducer(currentState, action)
    } finally {
      isDispatching = false
    }

    const listeners = (currentListeners = nextListeners)
    for (let i = 0; i < listeners.length; i++) {
      const listener = listeners[i]
      listener()
    }

    return action; // 返回action为了实现多个中间件组合运行
  }

  /**
   * reducer替换器
   *
   * You might need this if your app implements code splitting and you want to
   * load some of the reducers dynamically. You might also need this if you
   * implement a hot reloading mechanism for Redux.
   *
   * @param {Function} nextReducer The reducer for the store to use instead.
   * @returns {void}
   */
  function replaceReducer(nextReducer) {
    if (typeof nextReducer !== 'function') {
      throw new Error('新的Reducer不是函数')
    }

    currentReducer = nextReducer
    dispatch({ type: ActionTypes.REPLACE })
  }

  /**
   * Interoperability point for observable/reactive libraries.
   * @returns {observable} A minimal observable of state changes.
   * For more information, see the observable proposal:
   * https://github.com/tc39/proposal-observable
   */
  function observable() {
    const outerSubscribe = subscribe
    return {
      /**
       * The minimal observable subscription method.
       * @param {Object} observer Any object that can be used as an observer.
       * The observer object should have a `next` method.
       * @returns {subscription} An object with an `unsubscribe` method that can
       * be used to unsubscribe the observable from the store, and prevent further
       * emission of values from the observable.
       */
      subscribe(observer) {
        if (typeof observer !== 'object' || observer === null) {
          throw new TypeError('Expected the observer to be an object.')
        }

        function observeState() {
          if (observer.next) {
            observer.next(getState())
          }
        }

        observeState()
        const unsubscribe = outerSubscribe(observeState)
        return { unsubscribe }
      },

      [$$observable]() {
        return this
      }
    }
  }

  // When a store is created, an "INIT" action is dispatched so that every
  // reducer returns their initial state. This effectively populates
  // the initial state tree.
  dispatch({ type: ActionTypes.INIT })

  return {
    dispatch,
    subscribe,
    getState,
    replaceReducer,
    [$$observable]: observable
  }
}
