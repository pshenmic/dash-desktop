import { createContext, useContext, useMemo, useReducer } from 'react'
import { createDashpayDemoState, dashpayDemoReducer } from '@renderer/utils/dashpayDemo'
import type { DashpayDemoContextValue, DemoChildrenProps } from '@renderer/types/dashpayDemo'

const DashpayDemoContext = createContext<DashpayDemoContextValue | null>(null)

export function DashpayDemoProvider({ children }: DemoChildrenProps): React.JSX.Element {
  const [state, dispatch] = useReducer(dashpayDemoReducer, 'ready', createDashpayDemoState)
  const value = useMemo<DashpayDemoContextValue>(() => ({
    state,
    identity: state.identities.find((identity) => identity.id === state.selectedIdentityId) ?? null,
    selectIdentity: (identityId) => dispatch({ type: 'selectIdentity', identityId }),
    setScenario: (scenario) => dispatch({ type: 'scenario', scenario }),
    createIdentity: () => dispatch({ type: 'createIdentity' }),
    registerName: (label) => dispatch({ type: 'registerName', label }),
    sendRequest: (personId) => dispatch({ type: 'sendRequest', personId }),
    acceptRequest: (personId) => dispatch({ type: 'acceptRequest', personId }),
    ignoreRequest: (personId) => dispatch({ type: 'ignoreRequest', personId }),
  }), [state])
  return <DashpayDemoContext.Provider value={value}>{children}</DashpayDemoContext.Provider>
}

export function useDashpayDemo(): DashpayDemoContextValue {
  const context = useContext(DashpayDemoContext)
  if (!context) throw new Error('DashPay demo requires DashpayDemoProvider')
  return context
}
