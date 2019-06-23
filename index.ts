import * as React from 'react'

type AdapterFactory<T, HookProps extends {} = {}> = <Map extends MapProps<T> = MapProps<T, T>>
  (_?: Map, compare?: (props: ReturnType<Map>, nextProps: ReturnType<Map>) => boolean) =>
    <P extends Injected, Injected = ReturnType<Map>>(_: React.ComponentType<P>) => React.ComponentType<
      & HookProps
      & Options<Map>
      & Partial<Injected>
      & Pick<P, Exclude<keyof P, keyof Injected>>
    >

const debugId = ({ name = '', displayName }: any) => displayName || name

const createAdapterFactory = <T, P = {}>(hook: (_?: P) => T): AdapterFactory<T, P> =>
  (map = identity as any, propsAreEqual) => component => {
    const memoised = React.memo(component, propsAreEqual)

    return Object.assign(
      (props: P) => React.createElement(memoised, {
        ...map(hook(props), props),
        ...props
      }),
      { displayName: `${debugId(hook)}(${map.name || mapProps.name})` +
        `(${debugId(component)})`
      }
    )
  }

export const identity = <T>(_: T) => _

type MapProps<From = any, To = any, Props extends {} = {}> = (_: From, options?: Props) => To
type Options<A extends MapProps> = A extends MapProps<any, any, infer P> ? P : {}

type Mutations<T> = {
  [K in keyof T]: T[K] extends (..._) => any
    ? (..._: Parameters<T[K]>) => void
    : () => void
}

const createMutations = <T, M extends Updates<T>>(
  updates: M,
  dispatch: (_: Update<T>) => void
) => {
  const mutations: Partial<Mutations<M>> = {}
  for (const action in updates) {
    const update = updates[action]
    mutations[action] = ((...args) => dispatch(
      typeof update === 'function'
        ? (update as any)(...args)
        : update
    )) as any
  }

  return mutations as Mutations<M>
}

export type ProviderModule<T, P = {}> = {
  (): T // hook
  Adapter: AdapterFactory<T>
  Provider: React.ForwardRefExoticComponent<
    & React.PropsWithoutRef<ProviderProps<P>>
    & React.RefAttributes<T>
  >
}

type ProviderProps<P> = P & { children: React.ReactNode }

const useUnboundRef = <T>(value, ref?: React.Ref<T>) => {
  let functionRef = ref as (_: T | null) => void
  if (typeof ref !== 'function') {
    const mutableRef = ref as React.MutableRefObject<T>
    functionRef = (value: T = null) => mutableRef.current = value
  }

  React.useEffect(() => {
    if (!ref) return

    functionRef(value)
    return () => functionRef(null)
  }, [])
}

export const createStore = <
  State,
  UpdateFactories extends Updates<State>,
  Props extends {} = {},
>(
  factory: (_?: Props) => State,
  updates: UpdateFactories = {} as any
) => function useStore (initial: Props): State & Mutations<UpdateFactories> {
  const make = () => {
    const model = factory(initial)

    return Object.assign(model, createMutations(
      updates, update => dispatch(update) // dispatch to be lazily dereferenced
    ))
  }

  const [ value, dispatch ] = React.useReducer(
    reducer,
    React.useMemo(make, [])
  )

  return value
}

const createHook = <
  State,
  UpdateFactories extends Updates<State>,
  Props extends {} = {}
>(
  initial: (_?: Props) => State,
  updates: UpdateFactories = {} as any
) => {
  const context = React.createContext({})
  const useBoundContext = () => React.useContext(context)
  const Adapter = createAdapterFactory(useBoundContext)
  const useStore = createStore(initial, updates)

  type Service = ReturnType<typeof useStore>

  const Provider = React.forwardRef<Service, ProviderProps<Props>>((props, ref) => {
    const { children, ...providerProps } = props

    const value = useStore(providerProps as any)
    useUnboundRef(value, ref)

    return React.createElement(context.Provider, { children, value })
  })

  return Object.assign(useBoundContext, { Provider, Adapter }) as ProviderModule<Service, Props>
}

export default createHook

export type Service<T extends ProviderModule<any>> = ReturnType<T>

// for ergonomic reason, T should not be of function type
export type Update<T> = { (_: T): void | Partial<T> }

type Updates<T> = Record<string,
| ((..._) => Update<T>)
| Partial<T>
>

const reducer = <T>(state: T, update: Update<T>): T => {
  const nextState = typeof update === 'function'
    ? update(state)
    : update

  return nextState
    ? { ...state, ...nextState }
    : state
}

export const mapProps = <T, P>(
  map: (_: P) => T,
  compare?: (props: T, nextProps: T) => boolean
) => createAdapterFactory(map)(undefined, compare)
