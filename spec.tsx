import * as React from 'react'
import createHook, { createAdapter, Service } from '.'
import { render, act } from '@testing-library/react'
import assert, { AssertionError } from 'assert'

const factory = jest.fn((props: { on?: true }) => ({
  isOn: !!props.on,
  isDisabled: false
}))

const actions = {
  on: { isOn: true },
  off: () => () => ({ isOn: false }),
  disable: (isOn: boolean = false) => () => ({ isOn, isDisabled: true })
}

const useService = createHook(factory, actions)

const Test = jest.fn(
  (props:
    & { children?: React.ReactNode }
    & Service<typeof useService>
  ) => Object
    .keys(actions)
    .map<React.ReactNode>(key =>
      <button id={key} key={key} onClick={() => props[key]()} />
    )
    .concat(props.children) as any
)

const lastProps = ({ mock }: jest.Mock) => {
  const [[ props ]] = mock.calls

  return props
}

const TestWithIdentityAdapter = createAdapter(useService)(Test)

describe('Stateless', () => {
  it('Should render', () => {
    Test.mockClear()
    render(
      <useService.Provider>
        <TestWithIdentityAdapter />
      </useService.Provider>
    )

    let props = lastProps(Test)
    expect(props).toMatchObject({ isDisabled: false, isOn: false })

    Test.mockClear()
    render(
      <useService.Provider on>
        <TestWithIdentityAdapter />
      </useService.Provider>
    )

    props = lastProps(Test)
    assert(props.isOn === true, 'render with provider props fails')
  })

  it('Should provide stateless service object if actions are not provided', () => {
    const useStatelessService = createHook(factory)
    const TestStatelessService = createAdapter(useStatelessService)(Test)

    Test.mockClear()
    render(
      <useStatelessService.Provider on>
        <TestStatelessService />
      </useStatelessService.Provider>
    )

    const props = lastProps(Test)
    expect(props).toMatchObject({ isDisabled: false, isOn: true })
  })
})

describe('Stateful', () => {
  it('Should rerender', () => {
    Test.mockClear()
    const { container } = render(
      <useService.Provider>
        <TestWithIdentityAdapter />
      </useService.Provider>
    )

    let button = container.querySelector<HTMLButtonElement>('#on')
    let props = lastProps(Test)
    expect(props).toMatchObject({ isDisabled: false, isOn: false })

    Test.mockClear()
    button.click()
    props = lastProps(Test)

    assert(
      props.isOn === true,
      'fails to account for constant state mutation (Partial<State>)'
    )

    button = container.querySelector<HTMLButtonElement>('#off')
    Test.mockClear()
    button.click()
    props = lastProps(Test)

    assert(
      props.isOn === false,
      'fails to account for mutaion that is function of previous state (() => (_: State) => Partial<State>)'
    )

    button = container.querySelector<HTMLButtonElement>('#disable')
    Test.mockClear()
    button.click()
    const { isOn, isDisabled } = lastProps(Test)

    assert(
      (isOn === false) && (isDisabled === true),
      'fails to account for mutaion that takes params ((..._) => (_: State) => Partial<State>)'
    )
  })
})

describe('hoc', () => {
  it('Should NOT rerender if viewModel is unchanged', () => {
    const { container } = render(
      <useService.Provider>
        <TestWithIdentityAdapter />
      </useService.Provider>
    )

    const button = container.querySelector<HTMLButtonElement>('#on')
    Test.mockClear()
    button.click()
    expect(Test).toBeCalledTimes(1)

    Test.mockClear()
    button.click()
    expect(Test).not.toBeCalled()
  })

  const ConsumeNamespaced = jest.fn((props: {
    viewModel: Service<typeof useService>
    children?: React.ReactNode
  }) =>
    <Test { ...props.viewModel }>
      {props.children}
    </Test>
  )

  const connect = () => {
    const viewModel = useService()
    return { viewModel }
  }

  const TestNamespaceAdapter = createAdapter(connect)(ConsumeNamespaced)

  it('Should pass props through along with injected props', () => {
    Test.mockClear()

    render(
      <useService.Provider>
        <TestNamespaceAdapter>
          Test
        </TestNamespaceAdapter>
      </useService.Provider>
    )

    expect(lastProps(Test)).toMatchObject({ isDisabled: false, isOn: false, children: 'Test' })
  })

  it('Should work with a custom props equality function', () => {
    const serviceInstance = React.createRef<Service<typeof useService>>()

    render(
      <useService.Provider ref={serviceInstance}>
        <TestNamespaceAdapter />
      </useService.Provider>
    )

    expect(lastProps(ConsumeNamespaced).viewModel.isOn).toBe(false)
    ConsumeNamespaced.mockClear()
    act(() => serviceInstance.current.off())
    expect(lastProps(ConsumeNamespaced).viewModel.isOn).toBe(false)
    assert(
      ConsumeNamespaced.mock.calls.length === 1,
      'rerender even though viewModel.isOn is unchanged'
    )

    const TestAdapterWithPropsEquality =
      createAdapter(connect, (props, nextProps) => {
        try { assert.deepStrictEqual(props, nextProps) }
        catch (e) {
          if ((e as AssertionError).code === 'ERR_ASSERTION') return false
          throw e
        }
        return true
      })(ConsumeNamespaced)

    render(
      <useService.Provider ref={serviceInstance}>
        <TestAdapterWithPropsEquality />
      </useService.Provider>
    )

    expect(lastProps(ConsumeNamespaced).viewModel.isOn).toBe(false)
    ConsumeNamespaced.mockClear()
    act(() => serviceInstance.current.off())
    assert(
      ConsumeNamespaced.mock.calls.length === 0,
      'should NOT rerender when viewModel is structurally unchanged'
    )

    act(() => serviceInstance.current.on())
    assert(
      ConsumeNamespaced.mock.calls.length === 1,
      'should rerender when viewModel.isOn changes'
    )
  })
})

describe('Provider', () => {
  type Instance = Service<typeof useService>

  describe('should forward Service instance', () => {
    const testOnMount = (ref: Instance) => {
      expect(
        Object.keys(ref).sort()
      ).toEqual(
        [ 'on', 'off', 'disable', 'isOn', 'isDisabled' ].sort()
      )
    }

    const testOnUnmount = ref => {
      assert(ref === null, 'should forward null on unmount')
    }

    it('via ref object', () => {
      const ref = React.createRef<Instance>()
      const { unmount } = render(<useService.Provider ref={ref} children={null} />)

      testOnMount(ref.current)
      unmount()
      testOnUnmount(ref.current)
    })

    it('via function ref', () => {
      const ref = jest.fn(testOnMount)
      const { unmount } = render(<useService.Provider ref={ref} children={null} />)

      expect(ref).toBeCalledTimes(1)
      ref.mockClear()
      ref.mockImplementationOnce(testOnUnmount)
      unmount()
      expect(ref).toBeCalledTimes(1)
    })
  })

  it('should NOT recreate instance when Provider\'s props are updated', () => {
    factory.mockClear()
    const { rerender } = render(<useService.Provider on children={null} />)
    expect(factory).toBeCalledWith({ on: true })

    factory.mockClear()
    rerender(<useService.Provider children={null} />)
    expect(factory).not.toBeCalled()
  })
})
