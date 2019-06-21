import * as React from 'react'

type Adapter<T, HookProps extends {} = {}> = <Map extends MapProps<T> = MapProps<T, T>>(_?: Map) =>
  <P extends Injected, Injected = ReturnType<Map>>(_: React.ComponentType<P>) => React.ComponentType<
    & HookProps
    & Options<Map>
    & Partial<Injected>
    & Pick<P, Exclude<keyof P, keyof Injected>>
  >

const createAdapter = <T, P = {}>(hook: (_?: P) => T): Adapter<T, P> =>
  (map = (_ => _) as any) => component => {
    const memoised = React.memo(component)

    return (props: P) => React.createElement(
      memoised as any,
      { ...map(hook(props), props), ...props }
    )
  }

type MapProps<From = any, To = any, Props extends {} = {}> = (_: From, options?: Props) => To
type Options<A extends MapProps> = A extends MapProps<any, any, infer P> ? P : {}


type Mutations<T> = {
  [K in keyof T]: T[K] extends (..._) => any
    ? (..._: Parameters<T[K]>) => void
    : () => void
}

const createMutations = <T, M extends Updates<T>>(
  updates: M,
  dispatch: (_ :Update<T>) => void
) => {
  const mutations: Partial<Mutations<M>> = {}
  for (const action in updates) {
    const update = updates[action]
    mutations[action] = ((...args) => dispatch(
      typeof update === 'function'
        ? update(...args)
        : update
    )) as any
  }

  return mutations as Mutations<M>
}

export type ProviderModule<T, P = {}> = {
  (): T // hook
  Adapter: Adapter<T>
  Provider: React.ForwardRefExoticComponent<ProviderProps<T, P>>
}

type ProviderProps<T, P> = P & {
  ref?: React.Ref<T>
  children: React.ReactNode
}

const useUnboundRef = <T>(value, ref?: React.Ref<T>) => {
  if (!ref) return

  let functionRef = ref as (_?: T) => void
  if (typeof ref !== 'function') {
    const mutableRef = ref as React.MutableRefObject<T>
    functionRef = (value: T = null) => mutableRef.current = value
  }

  React.useEffect(() => {
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
) => (initial: Props): State & Mutations<UpdateFactories> => {
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
): ProviderModule<State & Mutations<UpdateFactories>, Props> => {
  const context = React.createContext({})
  const hook = () => React.useContext(context)
  const Adapter = createAdapter(hook)
  const useStore = createStore(initial, updates)

  type Service = ReturnType<typeof useStore>

  const Provider = React.forwardRef<Service, ProviderProps<Props, Service>>((props, ref) => {
    const { children, ...providerProps } = props

    const value = useStore(providerProps as any)
    useUnboundRef(value, ref)

    return React.createElement(context.Provider, { children, value })
  })

  return Object.assign(hook, { Provider, Adapter })
}

export default createHook

export type Service<T extends ProviderModule<any>> = ReturnType<T>

// for ergonomic reason, T should not be of function type
export type Update<T> = { (_: T): void | Partial<T> }


type Updates<T> = Record<string,
| ((..._) => Update<T> )
| Partial<T>
>

const reducer = <T>(state: T, update: Update<T>): T => {
  const nextState = typeof update == 'function'
    ? update(state)
    : update

  return nextState
    ? { ...state, ...nextState }
    : state
}

export const mapProps = <T, P>(hook: (_: P) => T) => createAdapter(hook)()
// shorthand
