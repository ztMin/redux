import ActionTypes from './utils/actionTypes'
import warning from './utils/warning'
import isPlainObject from './utils/isPlainObject'

/**
 * 获取异常状态（state）的错误信息
 * @param {any} key finalReducers 对应的key值
 * @param {any} action 当前执行的 action
 * @returns 
 */
function getUndefinedStateErrorMessage(key, action) {
  const actionType = action && action.type
  const actionDescription =
    (actionType && `action类型为"${String(actionType)}"`) || 'action'

  return (
    `在执行${actionDescription}时, "${key}"的reducer返回undefined。` +
    `如果要忽略${actionDescription}操作，则应该返回以前的状态（state）。 ` +
    `如果要清空当前状态（state），则应该返回 null 而不是 undefined。`
  )
}

/**
 * @description 获取异常状态（state）警告信息
 * @param {any} inputState Store根状态（state）
 * @param {any} reducers 过滤后的Reducer键值对，即 finalReducers
 * @param {any} action 当前Action操作
 * @param {any} unexpectedKeyCache 异常Reducer key缓存器
 * @returns 
 */
function getUnexpectedStateShapeWarningMessage(
  inputState,
  reducers,
  action,
  unexpectedKeyCache
) {
  const reducerKeys = Object.keys(reducers);
  const argumentName =
    action && action.type === ActionTypes.INIT
      ? '您传递给 createStore 的 preloadedState 参数为异常的数据类型'
      : '当前reducer接收到一个意外的状态（state）类型'

  if (reducerKeys.length === 0) {
    return (
      'Store没有有效的Reducer。请确保传递给combineReducers方法的对象是一个值为Reducer函数的对象，' +
      '即您传递给combineReducers方法的对象可能为空，或者 值 不是Reducer函数'
    )
  }

  if (!isPlainObject(inputState)) {
    return (
      `${argumentName}，类型为：` +
      {}.toString.call(inputState).match(/\s([a-z|A-Z]+)/)[1] +
      `"，您应该传入普通的 Object 类型； 当前有效的Reducer  ` +
      `keys有："${reducerKeys.join('", "')}"`
    )
  }

  // 找出状态（state）的有效key
  const unexpectedKeys = Object.keys(inputState).filter(
    key => !reducers.hasOwnProperty(key) && !unexpectedKeyCache[key]
  )

  unexpectedKeys.forEach(key => {
    unexpectedKeyCache[key] = true
  })

  if (action && action.type === ActionTypes.REPLACE) return

  if (unexpectedKeys.length > 0) {
    return (
      `${argumentName}，` +
      `异常的key为："${unexpectedKeys.join('", "')}"。` +
      `当前有效的 Reducer 有: ` +
      `"${reducerKeys.join('", "')}"`
    )
  }
}

/**
 * 检验reducers返回的状态（state）是否合法（即不能返回undefined）
 * @param {Object} reducers 
 */
function assertReducerShape(reducers) {
  Object.keys(reducers).forEach(key => {
    const reducer = reducers[key];
    const initialState = reducer(undefined, { type: ActionTypes.INIT })

    if (typeof initialState === 'undefined') {
      throw new Error(
        `"${key}" 的 Reducer 在初始化时返回 undefined. ` +
          `如果传递给 Reducer 的状态（state）为undefined，则应该返回初始的状态（state）` +
          `如不想设置值，可以用null 而不是 undefined`
      )
    }

    if (
      typeof reducer(undefined, {
        type: ActionTypes.PROBE_UNKNOWN_ACTION()
      }) === 'undefined'
    ) {
      throw new Error(
        `"${key}" 的 Reducer 用随机type的action检测时返回了 undefined ` +
          `不要针对 ${
            ActionTypes.INIT
          } 或者 actions type 为 "redux/*" 的命名空间。 ` +
          `针对未知 type 时应该返回当前状态（state），状态（stata）可为null而不能是 undefined.`
      )
    }
  })
}

/**
 * Reducer组合器
 * 将不同的 Reducer 键值对转组合一个 Reducer 函数；它会调用每个子 Reducer，
 * 并将它们的结果收集到一个单一的状态（state）树中，每个Reducer返回的状态（state）会存储到它的key中
 *
 * @param {Object} reducers Reducer键值对对象；可以用ES6的 import * as ./redurs 语法获取。
 * 对于任何Action操作Reducer都不能返回undefined。如果传递给他的状态（state）为undefined，它应该返回初始状态（state）；
 * 由上可得我们必须定义初始状态（state）。
 * 对于未能识别的Action操作则应该返回当前状态（state），案例如下：
 * {count: (state = null, action) => {
 *   switch (action.type) {
 *     case 'ADD':
 *       return state++
 *     default:
 *       return state
 *   }
 * }}
 *
 * @returns {Function} 组合后的Reducer函数，它调用传递进来的Reducer键值对中的每个Reducer函数；
 * 并构建一个具有相同状态（state）的对象
 */
{
  global: {user: {}},
  test: 0
}
{
  global: function (state, action) {},
  test: function () {}
}
export default function combineReducers(reducers) {
  const reducerKeys = Object.keys(reducers); // Reducer 键值对 key
  const finalReducers = {}; // 最终的 Reducer 键值对（主要用来过滤掉传入一些非函数值的key）
  for (let i = 0; i < reducerKeys.length; i++) {
    const key = reducerKeys[i]

    if (process.env.NODE_ENV !== 'production') {
      if (typeof reducers[key] === 'undefined') {
        warning(`"${key}" 的 reducer 值为 undefined`)
      }
    }
    // 过滤非函数的Reducer
    if (typeof reducers[key] === 'function') {
      finalReducers[key] = reducers[key]
    }
  }
  const finalReducerKeys = Object.keys(finalReducers); // 最终的 Reducer 键值对 key

  let unexpectedKeyCache; // 异常Reducer的key缓存器；针对非生产环境使用
  if (process.env.NODE_ENV !== 'production') {
    unexpectedKeyCache = {}
  }

  let shapeAssertionError; // 非法Reducer错误描述
  try {
    assertReducerShape(finalReducers); // 检查是否有非法的Reducer
  } catch (e) {
    shapeAssertionError = e
  }
  
  // 组合的Reducer方法
  return function combination(state = {}, action) {
    if (shapeAssertionError) { // 如果存在非法的 Reducer 则直接抛出异常
      throw shapeAssertionError
    }

    if (process.env.NODE_ENV !== 'production') { // 针对非生产环境获取异常状态（state）警告信息
      const warningMessage = getUnexpectedStateShapeWarningMessage(
        state,
        finalReducers,
        action,
        unexpectedKeyCache
      )
      if (warningMessage) { // 存在异常则抛出警告
        warning(warningMessage); // 输出警告信息
      }
    }

    let hasChanged = false; // 是否有改变
    const nextState = {}; // 改变后的状态（state）存储器
    for (let i = 0; i < finalReducerKeys.length; i++) { // 循环所有有效的Reducer
      const key = finalReducerKeys[i]; // 当前Reducer key
      const reducer = finalReducers[key]; // 当前Reducer方法
      const previousStateForKey = state[key]; // 当前Reducer方法对应的状态（state）
      const nextStateForKey = reducer(previousStateForKey, action); // 运行当前Reducer 获取新的状态（state）
      if (typeof nextStateForKey === 'undefined') { // 如果当前Reducer返回的状态（state）为 undefined 则抛出错误信息
        const errorMessage = getUndefinedStateErrorMessage(key, action); // 获取错误信息
        throw new Error(errorMessage); // 抛出错误信息
      }
      nextState[key] = nextStateForKey; // 缓存当前次新状态（state）
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey; // 判断状态（state）是否有改变；注意：只要有一个key改变都会认为改变
    }
    return hasChanged ? nextState : state; // 如果状态（state）有改变则返回新状态（state），否则返回原来的状态
  }
}
