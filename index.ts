import * as React from 'react'

type Props<C> = C extends React.ComponentType<infer P> ? P : {}
// for ergonomic reason, T should not be of function type
type Update<T> =
  | { (_: T): Partial<T> }
  | Partial<T>

const reducer = <T>(state: T, update: Update<T>): T => {
  const nextState = typeof update == 'function'
    ? update(state)
    : update

  return nextState
    ? { ...state, ...nextState }
    : state
}

const createAdapter = <T>(hook: (any) => T): StatefulProvider<T>['connect'] =>
  (map = (_ => _) as any, {
    getContext = hook,
    displayName
  } = map as any) => component => {
    const memoised = React.memo(component)

    return props => React.createElement(
      memoised as any,
      { ...props, ...map(getContext(props), props) }
    )
  }

type StatefulProvider<T, P = {}> =
& React.ComponentType<P & { children: React.ReactNode }>
& { connect<V, O = {}>(map?: (context: T, props: O) => V, options?: {
    getContext?: (props?: O) => T,
    displayName?: string
  }): <Props extends O>(_: React.ComponentType<Props>) => React.ComponentType<Props & V> }
& {
  context: React.Context<T> // maybe not expose this since it's leaky
  useService(): T } // the React team advises that all hooks' names should start with "use"

const StatefulProvider = <T, P = {}>(
  factory: (getNextToMerge: (updater: Update<T>) => void, providerProps: P) => T
): StatefulProvider<T, P> => {
  const context = React.createContext<T>({} as any)
  const useService = () => React.useContext(context)
  const connect: any = createAdapter(useService)

  const Provider = (props: Props<StatefulProvider<T, P>>) => {
    const { children, ...providerProps } = props

    const [ value, dispatch ] = React.useReducer(
      reducer,
      React.useMemo(
        () => factory(
          update => dispatch(update),
          providerProps as any,
        ),
        []
      )
    )

    return React.createElement(context.Provider, { children, value })
  }

  const { name } = factory

  return Object.assign(
    Provider,
    { connect, context, useService },
    name && { displayName: name }
  )
}

export default StatefulProvider
