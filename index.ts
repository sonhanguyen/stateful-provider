import * as React from 'react'

type Props<C> = C extends React.ComponentType<infer P> ? P : {}
// for ergonomic reason, T should not be of function type
export type Update<T> =
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

const createConnect = <T>(hook: () => T): ProviderModule<T>['connect'] =>
  (map = (_ => _) as any) => component => {
    const memoised = React.memo(component)

    return props => React.createElement(
      memoised as any,
      { ...props, ...map(hook(), props) }
    )
  }

type Adapter<T, P, V> = (context: T, props: P) => V

export type ProviderModule<T, P = {}> = {
  (): T // hook
  Provider: React.ComponentType<P & { children: React.ReactNode }>
  connect<V, O = {}>(map?: Adapter<T, O, V>):
    <Props extends O>(_: React.ComponentType<Props>) => React.ComponentType<Props & V>
}

const createHook = <T, P = {}>(
  factory: (getNextToMerge: (_: Update<T>) => void, providerProps: P) => T
): ProviderModule<T, P> => {
  const context = React.createContext<T>({} as any)
  const hook = () => React.useContext(context)
  const connect: any = createConnect(hook)

  const Provider = (props: Props<ProviderModule<T, P>['Provider']>) => {
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

  return Object.assign(hook, { Provider, connect })
}

export default createHook
