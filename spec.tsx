import * as React from 'react'
import createHook, { Update } from '.'
import { render } from '@testing-library/react'

type State = Record<'on' | 'off', { (): void }>

const mockFactory = (
  mergeState: (_: Update<State>) => void,
  initially: { on?: true }
): Partial<State> => {
  const on = () => mergeState({ on: undefined, off })
  const off = () => mergeState({ off: undefined, on })

  return initially.on ? { off } : { on }
}

const useService = createHook(
  mockFactory
)

const Test = () => {
  const service = useService()
  const next = (['on', 'off'] as const).find(it => service[it])

  return <button onClick={service[next]}>{next}</button>
}

describe('Stateless', () => {
  it('Should render', () => {
    expect(
      render(
        <useService.Provider>
          <Test />
        </useService.Provider>
      ).container.textContent
    ).toBe('on')
  })

  it('Should render with provider props', () => {
    expect(
      render(
        <useService.Provider on>
          <Test />
        </useService.Provider>
      ).container.textContent
    ).toBe('off')
  })
})

describe('Stateful', () => {
  it('Should rerender', () => {
    const { container } = render(
      <useService.Provider>
        <Test />
      </useService.Provider>
    )

    const [button] = container.getElementsByTagName('button')
    expect(button.textContent).toBe('on')
    button.click()
    expect(button.textContent).toBe('off')
  })
})