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

  /**
   * 确保可以改变下次监听器队列时不影响当前监听器队列
  */
  function ensureCanMutateNextListeners() {
    if (nextListeners === currentListeners) {
      nextListeners = currentListeners.slice(); // 将当前监听器队列拷贝一份作为下次的监听器队列
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
   * 注册一个监听器（listener）。 他将会在执行调度（dispatch）行为（action）时执行；
   * 此时状态树（state tree）可能已经发生了变更。你可以通过 `getState()` 方法来获获取当前状态输（state tree）。
   *
   * 您可以监听执行 `dispatch()`的变更，请注意以下事项:
   *
   * 1、 每个监听器（listener）必须在执行`dispatch()`之前加入。
   * 如果您在调用之前取消监听器，这对当前正在执行的`dispatch()`没有任何影响。
   * 然而下次调用`dispatch()`，无论是否属于嵌套； 都将会使用最新的监听器队列；
   * 具体原因可以看 dispatch 方法源码的倒数第 7 行； const listeners = (currentListeners = nextListeners)
   *
   * 2、监听器（listener）不应该期望能监听到所有的状态（state）变更；
   * 因为在调用监听器（listener）之前，执行多层嵌套Reduce的调度`dispatch()`方法是状态树（state）可能已经发生了多次改变。
   * 但是，可以保证在执行调度`dispatch()`方法之前注册的监听器（listener）在调用是都可以获取到最新的状态树（state）
   *
   * @param {Function} listener 一个在执行调度（dispatch）后的回调函数。
   * @returns {Function} 一个删除监听器的（change listener）的函数。
   */
  function subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('您传的监听器不是函数')
    }

    if (isDispatching) {
      throw new Error(
        '正在执行 reducer 操作，暂不能添加监听器！' +
          '如果您希望store更新后通知您， 可以在订阅（subscribe）组件回调中执行 store.getState()方法获取最新的状态树（state）。' +
          '更多细节请参考：https://redux.js.org/api-reference/store#subscribe(listener)'
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
   * 实现只支持纯 object 对象的 action。
   * 如果您想实现一个Promise的异步调度（dispatch），一个Observable, 一个thunk, 或者something；
   * 您可以在创建 store 时传入增强器（enhancer）中间件（middleware），如：`redux-thunk`。
   * 甚至中间件（middleware）也会对调度（dispatch）的 action 普通对象进行操作（如检验action结构、type值，甚至改造action等）。
   *
   * @param {Object} action 一个普通的object对象，表示当前行为。
   * 保持 action 可序列号，是一个好想法，这样您就可以记录和重放用户的回话；可以使用`redux-devtools工具`查看。
   * 每个 action 必须有一个 `type` 属性，并且值不能是 `undefined`。
   * 将 action 的 types 值设为字符串常量是一个很不错的做法。
   *
   * @returns {Object} 为了方便实现compose多个中间件（middleware）执行调度（dispatch）时都能操作action
   *
   * 请注意： 如果您使用中间件（middleware），它可能会封装一层调度（dispatch）来返回其他东西，(例如：返回Promise对象实现异步操作）。
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

    const listeners = (currentListeners = nextListeners); // 将下次监听队列赋给当前监听队列
    for (let i = 0; i < listeners.length; i++) {
      const listener = listeners[i]
      listener()
    }

    return action; // 返回action为了实现多个中间件组合运行
  }

  /**
   * reducer替换器
   *
   * 如果你的应用程序实现了reducer拆分，并希望动态加载 reducer ；为您的Redux实现热加载 reducer 机制；则需要该方法实现
   *
   * @param {Function} nextReducer 该 reducer方法 将替换当前 store 的 currentReducer 方法！
   * @returns {void}
   */
  function replaceReducer(nextReducer) {
    if (typeof nextReducer !== 'function') {
      throw new Error('新的Reducer不是函数')
    }

    currentReducer = nextReducer
    dispatch({ type: ActionTypes.REPLACE }); // 每次替换reducer函数都会执行一次替换的调度（dispatch）行为（action）
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
