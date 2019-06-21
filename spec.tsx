import * as React from 'react'
import createHook, { Service } from '.'
import { render } from '@testing-library/react'
import assert from 'assert'

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

const Test = jest.fn((viewModel: Service<typeof useService>) =>
  <>{ Object
      .keys(actions)
      .map(key =>
        <button id={key} key={key} onClick={() => viewModel[key]()} />
      )
    }
  </>
)

const lastProps = ({ mock }: jest.Mock) => {
  const [[ props ]] = mock.calls
  return props
}

const TestWithIdentityAdapter = useService.Adapter()(Test)

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
    const TestStatelessService = useStatelessService.Adapter()(Test)

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
  it('Should not rerender if viewModel is unchanged', () => {
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

  it('Should work with a custom mapProps function', () => {
    const ConsumeNamespaced = <NS extends string>(props:
      & Record<NS, Service<typeof useService>>
      & { namespace: NS }
      // @ts-ignore
    ) => <Test { ...props[props.namespace] } />

    const TestNamespaceAdapter = useService.Adapter(
      <NS extends string>(viewModel, props: { namespace: NS }) => ({ [props.namespace]: viewModel })
    )(ConsumeNamespaced)

    Test.mockClear()
    render(
      <useService.Provider>
        <TestNamespaceAdapter namespace='viewModel' />
      </useService.Provider>
    )

    expect(lastProps(Test)).toMatchObject({ isDisabled: false, isOn: false })
  })
})

describe('Provider', () => {
  type Instance = Service<typeof useService>

  describe('should foward Service instance', () => {
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
