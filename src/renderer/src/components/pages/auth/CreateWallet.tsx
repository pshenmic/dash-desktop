import { useState } from 'react';
import { Button, Input, Text } from "@renderer/components/dash-ui-kit-enxtended";
import { useTheme } from 'dash-ui-kit/react';
import { TypeUseCreateWallet } from '@renderer/hooks/useCreateWallet';
import { CreateWalletTexts, messages } from '@renderer/constants';
import { toast } from '@renderer/components/ui/Toast';

type CreateWalletData = Pick<
  CreateWalletTexts,
  'labelConfirmPassword' |
  'placeholderConfirmPassword' |
  'buttonNext' |
  'labelPassword' |
  'placeholderPassword'
>

type CreateWalletProps = Pick<TypeUseCreateWallet, 'password' | 'setPassword'> & {
  generateSeedPhrase?: TypeUseCreateWallet['generateSeedPhrase']
  createImportedWallet?: TypeUseCreateWallet['createImportedWallet']
  data: CreateWalletData
}

const MIN_WALLET_PASSWORD_LENGTH = 6
const MAX_WALLET_PASSWORD_LENGTH = 128
const HAS_LETTER = /[A-Za-z]/
const HAS_DIGIT = /\d/
const HAS_SPECIAL = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>\/?~`]/

const { createWallet: { passwordValidation: { minLength, maxLength, letterRequired, numberRequired, specialCharRequired, passwordsDoNotMatch },
  seedPhrase: { warning, errorMessage, errorTitle }
}} = messages

function getPasswordValidationError(password: string): string | null {
  const t = password.trim()
  if (t.length < MIN_WALLET_PASSWORD_LENGTH) {
    return minLength
  }
  if (t.length > MAX_WALLET_PASSWORD_LENGTH) {
    return maxLength
  }
  if (!HAS_LETTER.test(t)) {
    return letterRequired
  }
  if (!HAS_DIGIT.test(t)) {
    return numberRequired
  }
  if (!HAS_SPECIAL.test(t)) {
    return specialCharRequired
  }
  return null
}

export default function  CreateWallet({ password, setPassword, generateSeedPhrase, createImportedWallet, data } : CreateWalletProps): React.JSX.Element {
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { theme } = useTheme()
  const iconColor = theme === 'dark' ? '#ffffff' : ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const pwdError = getPasswordValidationError(password)
    if (pwdError !== null) {
      setError(pwdError)
      toast.error(pwdError)
      return
    }
    if (password !== confirmPassword) {
      const msg = passwordsDoNotMatch
      setError(msg)
      toast.error(msg)
      return
    }
    setLoading(true)
    try {
      if (createImportedWallet) {
        await createImportedWallet()
      } else {
        if (generateSeedPhrase) {
          await generateSeedPhrase()
        }
      }
      toast.error(warning)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : errorMessage
      setError(message)
      toast.error(errorTitle + " " + message)
    } finally {
      setLoading(false)
    }
  }

  const tooShortOrEmpty =
    !password.trim().length ||
    !confirmPassword.trim().length

  return (
    <form onSubmit={handleSubmit} className={"flex flex-col w-full gap-3.75"}>
      <div className={"grid grid-cols-2 gap-3.75"}>
        <div className={"flex flex-col gap-[.625rem]"}>
          <label htmlFor={"password-input"}>
            <Text as={"label"} size={16} weight={"medium"} color={"brand"} opacity={50}>
              {data.labelPassword}
            </Text>
          </label>
          <Input
            id={"password-input"}
            type={"password"}
            placeholder={data.placeholderPassword}
            value={password}
            variant={"outlined"}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            className={'h-full rounded-[1.25rem] bg-transparent'}
            iconColor={iconColor}
            colorScheme={error ? 'error' : 'primary'}
          />
        </div>
        <div className={"flex flex-col gap-[.625rem]"}>
          <label htmlFor={"confirm-password-input"}>
            <Text as={"label"} size={16} weight={"medium"} color={"brand"} opacity={50}>
              {data.labelConfirmPassword}
            </Text>
          </label>
          <Input
            id={"confirm-password-input"}
            type={"password"}
            placeholder={data.placeholderConfirmPassword}
            value={confirmPassword}
            variant={"outlined"}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setError('');
            }}
            className={'h-full rounded-[1.25rem] bg-transparent'}
            iconColor={iconColor}
            colorScheme={error ? 'error' : 'primary'}
          />
        </div>
      </div>
      <Button
        type={"submit"}
        colorScheme={"primary"}
        size={"md"}
        className={"rounded-[.9375rem] p-4.5"}
        disabled={tooShortOrEmpty || loading}
      >
        {data.buttonNext}
      </Button>
    </form>
  )
}
