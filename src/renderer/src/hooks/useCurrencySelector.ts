import { useState, useEffect } from 'react'
import { DollarIcon, EuroIcon, IconProps } from '@renderer/components/dash-ui-kit-extended/icons'

export interface Currency {
  id: string
  icon: React.FC<IconProps>
}

const MOCK_CURRENCIES: Currency[] = [
  { id: 'usd', icon: DollarIcon },
  { id: 'eur', icon: EuroIcon },
]

export function useCurrencySelector() {
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string>(() => {
    const saved = localStorage.getItem(`currency-send`)
    return saved || MOCK_CURRENCIES[0].id
  })

  useEffect(() => {
    localStorage.setItem(`currency-send`, selectedCurrencyId)
  }, [selectedCurrencyId])

  const selectedCurrency = MOCK_CURRENCIES.find(c => c.id === selectedCurrencyId)

  const selectCurrency = (currencyId: string) => {
    setSelectedCurrencyId(currencyId)
  }

  return {
    selectedCurrency,
    currencies: MOCK_CURRENCIES,
    selectCurrency
  }
}
