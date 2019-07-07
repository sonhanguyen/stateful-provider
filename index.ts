import * as React from 'react'

type AdapterFactory = <Options extends {}, ToInject extends {}>(
  hook: (_?: Options) => ToInject,
  compare?: <P extends {}>(props: P, nextProps: P) => boolean
) => <P>(_: React.ComponentType<P>) => React.ComponentType<
  & Parameters<typeof compare>[0]
  & Options
  & Partial<ToInject>
  & Pick<P, Exclude<keyof P, keyof ToInject>>
>

export const createAdapter: AdapterFactory = (hook, propsAreEqual) => component => {
  const memoised = React.memo(component, propsAreEqual)

  return props => React.createElement(memoised, {
    ...hook(props), props,
    ...props
  } as any)
}

export const identity = <T>(_: T) => _

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
  (): T
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

export const createReader = <
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
  const useStore = createReader(initial, updates)

  type Service = ReturnType<typeof useStore>

  const Provider = React.forwardRef<Service, ProviderProps<Props>>((props, ref) => {
    const { children, ...providerProps } = props

    const value = useStore(providerProps as any)
    useUnboundRef(value, ref)

    return React.createElement(context.Provider, { children, value })
  })

  return Object.assign(useBoundContext, { Provider }) as ProviderModule<Service, Props>
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
