import { useEffect, useReducer } from 'react'
import { API } from '../api'
import { SEND_PREVIEW_INITIAL_STATE } from '../constants/sendTransactionPreview'
import type { SendPreviewRequest, SendPreviewState } from '../types/SendTransactionPreview'
import { getErrorMessage } from '../utils/error'
import { mapSendTransactionPreview, sendPreviewReducer } from '../utils/sendTransactionPreview'

export function useSendTransactionPreview(request: SendPreviewRequest | null): SendPreviewState {
  const [state, dispatch] = useReducer(sendPreviewReducer, SEND_PREVIEW_INITIAL_STATE)
  useEffect(() => {
    if (request == null) {
      dispatch({type: 'reset'})
      return
    }
    let active = true
    dispatch({type: 'start', requestId: request.id})
    API.previewTransaction(request.walletId, request.operation, request.params)
      .then(preview => {
        if (active) dispatch({
          type: 'loaded', requestId: request.id,
          data: mapSendTransactionPreview({preview, operation: request.operation, from: request.from}),
        })
      })
      .catch(error => {
        if (active) dispatch({type: 'failed', requestId: request.id, error: getErrorMessage(error)})
      })
    return () => { active = false }
  }, [request])

  if (request == null) return SEND_PREVIEW_INITIAL_STATE
  if (state.requestId !== request.id) return {...SEND_PREVIEW_INITIAL_STATE, requestId: request.id, loading: true}
  return state
}
